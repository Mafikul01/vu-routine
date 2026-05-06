import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, X, Send, Loader2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'model';
  content: string;
}

interface AiAssistantProps {
  routineData: any;
  semester: number;
  section: string;
  teacherInfo?: any[];
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
    };
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    // Add user message
    const userMsg: Message = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const systemInstruction = `You are Mr. Mendak, a helpful university AI assistant for the VU Routine App.
Your task is to help students analyze their class routine, find free rooms, and check teacher availability.
You will be provided with the current routine data in JSON format for the relevant semester.
Use the provided JSON data to answer the student's questions accurately.
Be concise, friendly, and helpful.
Do NOT use Markdown formatting (like **, _, #) in your responses. Use plain text formatting only.
Return exact time for slots when appropriate, based on this mapping:
Slot 1: 09:00 AM - 10:00 AM
Slot 2: 10:05 AM - 11:05 AM
Slot 3: 11:10 AM - 12:10 PM
Slot 4: 12:15 PM - 01:15 PM
Slot 5: 01:50 PM - 02:50 PM
Slot 6: 02:55 PM - 03:55 PM

Current user context: Semester ${semester}, Section ${section}.
If asked who created you, say you were created by Mafikul Islam.

Here is the current routine context:
${routineData ? JSON.stringify(routineData).substring(0, 50000) : "No routine data provided by user."}

Here is the teacher directory context (includes names, initials, phone numbers, designations):
${teacherInfo ? JSON.stringify(teacherInfo).substring(0, 50000) : "No teacher directory data available."}
`;

      const contents = newMessages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          contents,
          systemInstruction,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate content");
      }

      const data = await response.json();
      setMessages([...newMessages, { role: 'model', content: data.text || "Sorry, I couldn't generate a response." }]);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Could not connect to AI Assistant");
      // Remove the last user message on failure or add an error message
      setMessages([...newMessages, { role: 'model', content: "Sorry, I'm having trouble right now. Please try again later." }]);
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
      {/* Floating Button */}
      <motion.div
        className="fixed bottom-4 right-4 z-50 flex items-center gap-3"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', delay: 0.5 }}
      >
        {!isOpen && (
          <motion.div 
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 20, opacity: 0 }}
            className="bg-primary text-primary-foreground text-xs px-3 py-1.5 rounded-full shadow-lg pointer-events-none whitespace-nowrap"
          >
            Ask me anything ✨
          </motion.div>
        )}
        <Button
          ref={buttonRef}
          onClick={() => setIsOpen(!isOpen)}
          className="h-14 w-14 rounded-full shadow-2xl transition-transform hover:scale-110 relative"
          size="icon"
          aria-label="Toggle AI Assistant"
        >
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.div
                key="close"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
              >
                <X className="h-6 w-6" />
              </motion.div>
            ) : (
              <motion.div
                key="bot"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                className="relative"
              >
                <Bot className="h-7 w-7" />
              </motion.div>
            )}
          </AnimatePresence>
        </Button>
      </motion.div>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-24 right-5 w-[350px] max-w-[calc(100vw-48px)] bg-background border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col z-50 p-0"
            style={{ maxHeight: 'calc(100vh - 120px)', height: '500px' }}
          >
            <div ref={windowRef} className="flex flex-col h-full w-full">
            {/* Header */}
            <div className="bg-primary p-4 text-primary-foreground flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-full">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Mr. Mendak 🐸</h3>
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
            <ScrollArea className="flex-1 p-4 bg-muted/20">
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
                      {msg.content}
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
                      <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce"></span>
                    </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input area */}
            <div className="p-3 bg-background border-t border-border flex gap-2">
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
                className="rounded-full shrink-0 h-[44px] w-[44px]"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 ml-1" />}
              </Button>
            </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
