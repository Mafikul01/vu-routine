import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, X, Send, Loader2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { GoogleGenAI } from "@google/genai";

interface Message {
  role: 'user' | 'model';
  content: string;
}

interface AiAssistantProps {
  routineData: unknown;
  semester: number;
  section: string;
  teacherInfo?: unknown[];
}

export function AiAssistant({ routineData, semester, section, teacherInfo }: AiAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', content: "Hi! I'm Mr. Mendak 🐸. I can help you find free rooms, check teacher schedules, or summarize your classes. What do you need to know?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const windowRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Don't close if clicking the toggle button
      if (buttonRef.current && buttonRef.current.contains(event.target as Node)) {
        return;
      }
      
      if (windowRef.current && !windowRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.history.pushState({ aiOpen: true }, '');
      
      // Lock background scrolling effectively
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.overscrollBehaviorY = 'none';
      document.body.style.overscrollBehaviorY = 'none';
    }

    const handlePopState = () => {
      if (isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('popstate', handlePopState);
      
      // Restore background scrolling
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.overscrollBehaviorY = '';
      document.body.style.overscrollBehaviorY = '';
    };
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    // Add user message
    const userMsg: Message = { role: 'user', content: input.trim() };
    const currentMessages = [...messages, userMsg];
    setMessages(currentMessages);
    setInput('');
    setIsLoading(true);

    try {
      const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;

      // --- OPTIMIZATION START ---
      // 1. Filter Routine Data significantly
      interface RoutineEntry {
        day: string;
        slot: number;
        course: string;
        room: string;
        teachers: string[];
        semester: number;
        section: string;
      }
      
      let optimizedRoutine: unknown[] = [];
      if (Array.isArray(routineData)) {
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        
        // Include:
        // - All classes for current user (semester/section)
        // - All classes for TODAY (to help find free rooms)
        optimizedRoutine = (routineData as RoutineEntry[]).filter((entry) => 
          (entry.semester === semester && entry.section === section) || 
          entry.day === today
        ).map((entry) => ({
          d: entry.day.substring(0, 3), // Shorten day
          s: entry.slot,
          c: entry.course,
          r: entry.room,
          t: entry.teachers.join(','),
          sem: entry.semester,
          sec: entry.section
        }));
      }

      // 2. Filter Teacher Info
      interface TeacherEntry {
        name?: string;
        Name?: string;
        initials?: string;
        Initials?: string;
        phone?: string;
        Phone?: string;
        number?: string;
      }

      const optimizedTeachers = Array.isArray(teacherInfo) 
        ? (teacherInfo as TeacherEntry[]).map((t) => ({
            n: t.name || t.Name,
            i: t.initials || t.Initials,
            p: t.phone || t.Phone || t.number
          })) 
        : [];

      // 3. Limit conversation history to last 8 messages
      const historyLimit = 8;
      const historyToKeep = currentMessages.slice(-historyLimit);
      // --- OPTIMIZATION END ---

      const systemInstruction = `You are Mr. Mendak, a helpful university AI assistant for the VU Routine App.
Your task is to help students analyze their class routine, find free rooms, and check teacher availability.
Current user: Semester ${semester}, Section ${section}.
Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long' })}

STRICT SLOT TIME MAPPING:
Slot 1: 09:00 AM - 10:00 AM
Slot 2: 10:05 AM - 11:05 AM
Slot 3: 11:10 AM - 12:10 PM
Slot 4: 12:15 PM - 01:15 PM
Slot 5: 01:50 PM - 02:50 PM
Slot 6: 02:55 PM - 03:55 PM

Routine Context (Filtered):
${JSON.stringify(optimizedRoutine).substring(0, 15000)}

Teacher Contact:
${JSON.stringify(optimizedTeachers).substring(0, 5000)}

Instructions:
- Be concise. Speak naturally like a helpful assistant.
- Use plain text (no markdown ** or #).
- When asked about free rooms, check the Routine Context for rooms NOT occupied during that slot today.
- ALWAYS refer to the Slot Time Mapping above when mentioning class times.
- DO NOT end your messages with a signature or repetitive closing phrases like "How else can I assist you?".
- You were created by Mafikul Islam (only mention this if specifically asked).
`;

      setMessages([...currentMessages, { role: 'model', content: '' }]);
      let fullContent = '';

      if (!geminiKey) {
        throw new Error("Gemini API key is not configured in Settings.");
      }

      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const contents = historyToKeep.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      const responseStream = await ai.models.generateContentStream({
        model: 'gemini-3-flash-preview',
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      for await (const chunk of responseStream) {
        const text = chunk.text;
        if (text) {
          fullContent += text;
          setMessages(prev => {
            const next = [...prev];
            if (next.length > 0 && next[next.length - 1].role === 'model') {
              next[next.length - 1] = { role: 'model', content: fullContent };
            }
            return next;
          });
        }
      }
    } catch (err: unknown) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : "Could not connect to AI Assistant";
      toast.error(errorMessage);
      setMessages(prev => [
        ...prev, 
        { role: 'model', content: "Sorry, I'm having trouble right now. This model might be experiencing high demand. Please try again in a moment." }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[45]"
            style={{ touchAction: 'none' }}
          />
        )}
      </AnimatePresence>

      {/* Floating Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            className="fixed bottom-4 right-4 z-50 flex items-center gap-3"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: 'spring', delay: isOpen ? 0 : 0.5 }}
          >
            <motion.div 
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              className="bg-primary text-primary-foreground text-xs px-3 py-1.5 rounded-full shadow-lg pointer-events-none whitespace-nowrap"
            >
              Ask me anything ✨
            </motion.div>
            <Button
              ref={buttonRef}
              onClick={() => setIsOpen(true)}
              className="h-14 w-14 rounded-full shadow-2xl transition-transform hover:scale-110 relative"
              size="icon"
              aria-label="Open AI Assistant"
            >
              <Bot className="h-7 w-7" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-24 right-5 w-[350px] max-w-[calc(100vw-40px)] bg-background border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col z-[50] p-0"
            style={{ maxHeight: 'calc(100vh - 120px)', height: '550px' }}
          >
            <div ref={windowRef} className="flex flex-col h-full w-full">
            {/* Header */}
            <div className="bg-primary p-4 text-primary-foreground flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-full">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Mr. Mendak 🐸 <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded ml-1">v1.1</span></h3>
                  <p className="text-[10px] text-primary-foreground/80">Created by Mafikul Islam</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 text-primary-foreground hover:bg-white/20 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Messages */}
            <div 
              className="flex-1 overflow-y-auto p-4 bg-muted/20 overscroll-contain"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <div className="flex flex-col gap-4 pb-4">
                {messages.map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted border border-border text-foreground'
                      }`}
                    >
                      <div className="markdown-body">
                        {msg.content}
                      </div>
                    </div>
                  </motion.div>
                ))}
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-start"
                  >
                    <div className="bg-muted border border-border text-foreground rounded-2xl px-4 py-3 flex gap-1 items-center">
                      <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce"></span>
                    </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input area */}
            <div className="p-3 bg-background border-t border-border flex items-center gap-2 shrink-0">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about free rooms, teachers..."
                className="flex-1 bg-muted/50 border border-input rounded-xl px-3 py-2.5 text-sm resize-none outline-none focus:ring-1 focus:ring-primary max-h-[100px] min-h-[44px]"
                rows={1}
                disabled={isLoading}
              />
              <Button 
                size="icon" 
                onClick={handleSend} 
                disabled={!input.trim() || isLoading}
                className="rounded-full shrink-0 h-11 w-11 flex items-center justify-center translate-y-[1px]"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
