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
  const [vvHeight, setVvHeight] = useState('100dvh');
  const [vvOffsetTop, setVvOffsetTop] = useState(0);
  const [kbHeight, setKbHeight] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const windowRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  useEffect(() => {
    if (!window.visualViewport) return;
    
    const handleResize = () => {
      if (window.visualViewport) {
        setVvHeight(`${window.visualViewport.height}px`);
        setVvOffsetTop(window.visualViewport.offsetTop);
        setKbHeight(window.innerHeight - window.visualViewport.height);
        scrollToBottom();
      }
    };

    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);
    // Initial calculation
    handleResize();

    // Set up rapid polling when the input is focused/blurred to ensure smooth, immediate update
    let pollInterval: NodeJS.Timeout | null = null;
    const startPolling = () => {
      if (pollInterval) clearInterval(pollInterval);
      pollInterval = setInterval(handleResize, 33); // ~30 fps updates for fluid tracking
      setTimeout(() => {
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      }, 1500); // Poll for 1.5s during keyboard layout animation
    };

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) {
        startPolling();
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) {
        startPolling();
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
        window.visualViewport.removeEventListener('scroll', handleResize);
      }
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

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
      
      document.body.classList.add('ai-assistant-open');
      
      // Lock background scrolling effectively
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.overscrollBehavior = 'none';
      document.body.style.overscrollBehavior = 'none';
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
      
      document.body.classList.remove('ai-assistant-open');
      
      // Restore background scrolling
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.overscrollBehavior = '';
      document.body.style.overscrollBehavior = '';
    };
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const lowerInput = input.trim().toLowerCase();

    // Add user message
    const userMsg: Message = { role: 'user', content: input.trim() };
    const currentMessages = [...messages, userMsg];
    setMessages(currentMessages);
    setInput('');
    setIsLoading(true);

    // --- QUICK CACHE / SHORTCUT RESPONSES ---
    // Handle very common questions without hitting the AI model to save limit
    const quickResponses: { keywords: string[], text: string }[] = [
      {
        keywords: ["student id", "my id", "what is my id", "my student id"],
        text: "Your student ID is 232311070."
      },
      {
        keywords: ["who created you", "who is your developer", "who made you", "your creator"],
        text: "I was created by Mafikul Islam (Student ID: 232311070, 33rd - 7th B). GitHub: https://github.com/mafikul01. WhatsApp: +8801788302771."
      },
      {
        keywords: ["slot 1 time", "when is slot 1", "what time is slot 1"],
        text: "Slot 1 is from 09:00 AM to 10:00 AM."
      },
      {
         keywords: ["slot 2 time", "when is slot 2", "what time is slot 2"],
         text: "Slot 2 is from 10:05 AM to 11:05 AM."
      },
      {
         keywords: ["slot 3 time", "when is slot 3", "what time is slot 3"],
         text: "Slot 3 is from 11:10 AM to 12:10 PM."
      },
      {
         keywords: ["slot 4 time", "when is slot 4", "what time is slot 4"],
         text: "Slot 4 is from 12:15 PM to 01:15 PM."
      },
      {
         keywords: ["slot 5 time", "when is slot 5", "what time is slot 5"],
         text: "Slot 5 is from 01:50 PM to 02:50 PM."
      },
      {
         keywords: ["slot 6 time", "when is slot 6", "what time is slot 6"],
         text: "Slot 6 is from 02:55 PM to 03:55 PM."
      },
      {
        keywords: ["who are you", "what is your name", "what can you do"],
        text: "I am Mr. Mendak, a helpful university AI assistant for the VU Routine App. I can help you analyze your class routine, find free rooms, and check teacher availability."
      }
    ];

    let cachedResponse = null;
    
    // Check if the input exactly matches or contains mainly the keywords
    for (const qr of quickResponses) {
      if (qr.keywords.some(kw => lowerInput.includes(kw))) {
        // Prevent matching "id" inside a long sentence by making sure it's a short query
        // or an exact match for longer queries.
        if (lowerInput.length < 50 || lowerInput === qr.keywords[0]) {
           cachedResponse = qr.text;
           break;
        }
      }
    }

    if (cachedResponse) {
      setTimeout(() => {
         setMessages(prev => [...prev, { role: 'model', content: cachedResponse }]);
         setIsLoading(false);
      }, 500); // Simulate network delay slightly for natural feel
      return;
    }

    try {
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

      // 3. Filter data locally to save tokens
      const userMsgLower = userMsg.content.toLowerCase();
      const filteredRoutine = optimizedRoutine.filter(entry => 
        userMsgLower.includes(entry.course.toLowerCase()) ||
        entry.teachers.some(t => userMsgLower.includes(t.toLowerCase())) ||
        (userMsgLower.includes('free') && entry.room.toLowerCase().includes(userMsgLower.split(' ').pop() || ''))
      );
      
      const filteredTeachers = optimizedTeachers.filter(t => 
        userMsgLower.includes(t.toLowerCase())
      );
      
      const historyToKeep = [userMsg];
      // --- OPTIMIZATION END ---
      
      const systemInstruction = `You are Mr. Mendak, a helpful university AI assistant.
Help students with their class routine, free rooms, and teacher availability.

Routine Data (Relevant only):
${JSON.stringify(filteredRoutine)}

Teacher Contacts (Relevant only):
${JSON.stringify(filteredTeachers)}

Instructions:
- Be concise and direct.
- Use plain text.
- If asked for teacher's number, provide it directly.
- If asked for general questions, answer simply.
- Do not summarize previous topics.
`;

      setMessages([...currentMessages, { role: 'model', content: 'Thinking...' }]);
      
      const contents = historyToKeep.map(msg => ({
        role: 'user',
        parts: [{ text: msg.content }]
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction,
          model: 'gemini-3.5-flash'
        })
      });

      if (!response.ok) {
        let errorMsg = "Server Error: Unable to complete your request. Please try again later.";
        try {
          const errorData = await response.json();
          if (errorData.error) errorMsg = errorData.error;
        } catch (e) {
          // fallback to default error
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      const aiText = data.text;

      setMessages(prev => {
        const next = [...prev];
        if (next.length > 0 && next[next.length - 1].role === 'model') {
          next[next.length - 1] = { role: 'model', content: aiText };
        }
        return next;
      });

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
            <motion.button 
              id="tour-ai-chat-btn"
              initial={{ x: 20, opacity: 0 }}
              animate={{ 
                x: 0, 
                opacity: 1
              }}
              exit={{ x: 20, opacity: 0 }}
              onClick={() => setIsOpen(true)}
              className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 rounded-full shadow-lg whitespace-nowrap cursor-pointer hover:bg-primary/90 hover:scale-105 active:scale-95 flex items-center gap-1.5"
            >
              <div className="flex items-center">
                {"Ask me anything".split("").map((char, index) => (
                  <motion.span
                    key={index}
                    animate={{ y: [0, -3, 0] }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: index * 0.05,
                    }}
                  >
                    {char === " " ? "\u00A0" : char}
                  </motion.span>
                ))}
              </div>
              <motion.span
                animate={{ rotate: [0, 15, -10, 0], scale: [1, 1.2, 1] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                ✨
              </motion.span>
            </motion.button>
            <Button
              ref={buttonRef}
              onClick={() => setIsOpen(true)}
              className="h-14 w-14 rounded-full shadow-2xl transition-transform hover:scale-110 relative"
              size="icon"
              aria-label="Open AI Assistant"
            >
              <Bot className="h-11 w-11" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={isMobile ? { opacity: 0, y: 100 } : { opacity: 0, y: 20, scale: 0.95 }}
            animate={isMobile ? { opacity: 1, y: 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={isMobile ? { opacity: 0, y: 100 } : { opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`fixed bg-background overflow-hidden flex flex-col z-[50] p-0 shadow-2xl ${
              isMobile 
                ? "inset-x-0 w-full rounded-t-2xl border-t border-border" 
                : "bottom-24 right-5 w-[380px] border border-border rounded-2xl"
            }`}
            style={
              isMobile 
                ? {
                    height: kbHeight > 50 
                      ? `calc(${vvHeight} * 0.90)`
                      : `${vvHeight}`,
                    maxHeight: kbHeight > 50 
                      ? `calc(${vvHeight} * 0.90)` 
                      : `${vvHeight}`,
                    bottom: '0px',
                    left: '0px',
                    top: window.visualViewport 
                      ? `${vvOffsetTop + (kbHeight > 50 ? (window.visualViewport.height * 0.10) : 0)}px` 
                      : '0px',
                  }
                : { 
                    maxHeight: kbHeight > 50 
                      ? `calc((${vvHeight} * 0.8) - 32px)` 
                      : `calc(${vvHeight} - 32px)`, 
                    height: '700px',
                    bottom: `calc(max(16px, env(safe-area-inset-bottom)) + ${kbHeight}px)`
                  }
            }
          >
            <div ref={windowRef} className="flex flex-col h-full w-full min-h-0">
            {/* Header */}
            <div className="bg-primary p-4 text-primary-foreground flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-full">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Mr. Mendak 🐸 <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded ml-1">v1.5</span></h3>
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
                      className={`max-w-[85%] rounded-2xl px-4 py-2 text-xs whitespace-pre-wrap ${
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
