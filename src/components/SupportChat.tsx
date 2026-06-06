import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { apiPost } from '../lib/api';
import { company } from '../lib/company';

export default function SupportChat() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'model'; text: string; timestamp: Date }[]>([
    { role: 'model', text: `Hi, you are through to BLM support. How can we help with your booking, touring, car hire, pickup, or cross-border trip?`, timestamp: new Date() }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage, timestamp: new Date() }]);
    setIsTyping(true);

    try {
      const { data } = await apiPost('/api/ai/generate', {
        prompt: userMessage,
        context: `Support chat for ${user?.email || 'Guest'}`
      });
      const aiText = data.text || "I am having trouble getting a response. Please try again.";
      
      setMessages(prev => [...prev, { role: 'model', text: aiText, timestamp: new Date() }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'model', text: `Connection error. Please try again, call ${company.phoneDisplay}, or email ${company.email}.`, timestamp: new Date() }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Toggle Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-md border border-white bg-primary text-white shadow-lg transition-colors hover:bg-primary-container md:bottom-8 md:right-8"
        aria-label={isOpen ? 'Close support chat' : 'Open support chat'}
      >
        <span className="material-symbols-outlined text-2xl">
          {isOpen ? 'close' : 'support_agent'}
        </span>
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.8 }}
            className="fixed bottom-24 right-4 z-50 flex h-[500px] max-h-[calc(100vh-7rem)] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-outline bg-white shadow-2xl md:bottom-28 md:right-8 md:w-[400px]"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 bg-on-surface p-4 text-white sm:p-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary">
                   <span className="material-symbols-outlined text-lg">headset_mic</span>
                </div>
                <div className="min-w-0">
                   <h3 className="text-sm font-bold leading-none">BLM support</h3>
                   <span className="safe-text text-xs font-medium text-white/70">Bookings, touring, and tracking</span>
                </div>
              </div>
              <div className="flex gap-2">
                 <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar bg-surface-container/40">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`safe-text max-w-[86%] rounded-lg p-4 text-sm leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-primary text-white' 
                      : 'bg-white border border-outline shadow-sm font-medium'
                  }`}>
                    {msg.text}
                    <p className={`text-[10px] mt-2 opacity-60 font-semibold ${msg.role === 'user' ? 'text-right' : ''}`}>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                   <div className="bg-white border border-outline p-4 rounded-lg flex gap-1">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.2s]" />
                      <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.4s]" />
                   </div>
                </div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-4 bg-white border-t border-outline">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your question..."
                  className="w-full bg-surface-container border border-outline rounded-md p-4 pr-14 text-sm font-medium focus:ring-2 focus:ring-primary/30 focus:border-transparent transition-all outline-none"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isTyping}
                  className="absolute right-2 w-10 h-10 bg-primary text-white rounded-md flex items-center justify-center disabled:opacity-50 transition-all hover:bg-black"
                  aria-label="Send message"
                >
                  <span className="material-symbols-outlined text-lg">send</span>
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
