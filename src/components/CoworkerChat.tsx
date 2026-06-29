import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Send, 
  Sparkles, 
  Users, 
  ArrowRight, 
  Loader2, 
  MessageSquare,
  HelpCircle,
  FileText,
  Mail,
  AlertTriangle
} from 'lucide-react';
import { Issue } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface CoworkerChatProps {
  isOpen: boolean;
  onClose: () => void;
  issues: Issue[];
  stats: any;
}

const SUGGESTIONS = [
  {
    text: "Which category has the highest open issues and why?",
    icon: AlertTriangle,
    label: "Analyze Open Issues"
  },
  {
    text: "Draft an urgent status email to the Ward Council regarding active drainage or water hazard issues.",
    icon: Mail,
    label: "Draft Municipal Email"
  },
  {
    text: "Summarize community upvotes and list the top 3 high-interest citizen posts.",
    icon: MessageSquare,
    label: "Community Interest"
  },
  {
    text: "Create a formal internal notification for residents about ongoing road repairs.",
    icon: FileText,
    label: "Draft Resident Notice"
  }
];

export default function CoworkerChat({ isOpen, onClose, issues, stats }: CoworkerChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hello colleague! Casey here, Senior Community Liaison. I've synced up with our live Civic Pulse dashboard. I have full access to all reported community posts, citizen upvotes, comment histories, and ward metric scores.\n\nWhat are we tackling today? Ask me to analyze active trends, draft a municipal update, or identify high-priority issues."
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  if (!isOpen) return null;

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    const newMsg: Message = { role: 'user', content: textToSend };
    const updatedMessages = [...messages, newMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/coworker-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          issues,
          stats
        })
      });
      const data = await response.json();
      setMessages([...updatedMessages, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      console.error("Coworker chat failed", err);
      setMessages([...updatedMessages, { 
        role: 'assistant', 
        content: "I ran into a connection error with the community database, partner. Let's try that prompt again in a moment!" 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to render custom styled content with simple bolding and bullet points
  const formatMessageText = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      let content: React.ReactNode = line;
      
      // Handle bullets
      const isBullet = line.trim().startsWith('-') || line.trim().startsWith('*') || line.trim().startsWith('•');
      const isNumbered = /^\d+\.\s/.test(line.trim());
      
      let lineText = line;
      if (isBullet) {
        lineText = line.replace(/^[-*•]\s*/, '');
      } else if (isNumbered) {
        lineText = line.replace(/^\d+\.\s*/, '');
      }

      // Simple markdown bold parsing
      const boldRegex = /\*\*(.*?)\*\*/g;
      const parts = [];
      let lastIndex = 0;
      let match;

      while ((match = boldRegex.exec(lineText)) !== null) {
        if (match.index > lastIndex) {
          parts.push(lineText.substring(lastIndex, match.index));
        }
        parts.push(<strong key={match.index} className="font-bold text-slate-800">{match[1]}</strong>);
        lastIndex = boldRegex.lastIndex;
      }
      if (lastIndex < lineText.length) {
        parts.push(lineText.substring(lastIndex));
      }

      const finalLineContent = parts.length > 0 ? parts : lineText;

      if (isBullet) {
        return (
          <div key={idx} className="flex items-start gap-1.5 pl-3.5 my-1 text-left">
            <span className="text-beach-coral font-bold select-none mt-1 text-[10px]">●</span>
            <span className="flex-1 leading-normal text-xs text-slate-700">{finalLineContent}</span>
          </div>
        );
      }

      if (isNumbered) {
        return (
          <div key={idx} className="flex items-start gap-1.5 pl-3.5 my-1 text-left">
            <span className="text-beach-coral font-bold select-none text-xs">{idx + 1}.</span>
            <span className="flex-1 leading-normal text-xs text-slate-700">{finalLineContent}</span>
          </div>
        );
      }

      return (
        <p key={idx} className={`leading-relaxed text-xs text-slate-700 ${line.trim() === '' ? 'h-2' : 'my-1 text-left'}`}>
          {finalLineContent}
        </p>
      );
    });
  };

  return (
    <div id="coworker-chat-panel" className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        id="coworker-chat-card"
        className="w-full max-w-md bg-beach-sand h-[80vh] max-h-[620px] rounded-3xl border border-beach-cream flex flex-col shadow-2xl relative overflow-hidden"
      >
        {/* Top Header Card */}
        <div className="bg-white border-b border-beach-cream px-4 py-3.5 flex items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center gap-2.5 text-left">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-beach-coral/10 border border-beach-coral/25 flex items-center justify-center">
                <Users className="w-5 h-5 text-beach-coral" />
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold text-beach-driftwood">Casey</h2>
                <span className="px-1.5 py-0.5 bg-beach-coral/10 text-beach-coral border border-beach-coral/25 rounded text-[8px] font-extrabold uppercase tracking-wide">
                  AI Coworker
                </span>
              </div>
              <p className="text-[10px] text-slate-400">Co-managing Ward Issues &amp; Metrics</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-xl transition-all cursor-pointer border border-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Context Indicator Banner */}
        <div className="bg-amber-500/10 border-b border-amber-500/15 py-1.5 px-4 text-left flex items-center justify-between text-[10px] text-amber-800 font-medium shrink-0">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Casey has loaded {issues.length} active posts &amp; stats metrics</span>
          </div>
          <span className="text-[9px] px-1 bg-amber-500/20 rounded font-bold border border-amber-500/20">LIVE DATABASE</span>
        </div>

        {/* Messages Scrollable Panel */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        >
          {messages.map((m, idx) => {
            const isUser = m.role === 'user';
            return (
              <div 
                key={idx} 
                className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'} animate-scale-up`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-full bg-beach-coral/10 border border-beach-coral/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Users className="w-3.5 h-3.5 text-beach-coral" />
                  </div>
                )}
                
                <div 
                  className={`max-w-[85%] p-3.5 rounded-2xl border text-left shadow-sm ${
                    isUser 
                      ? 'bg-beach-coral text-white border-beach-coral/40 rounded-tr-none' 
                      : 'bg-white text-slate-800 border-beach-cream/80 rounded-tl-none'
                  }`}
                >
                  {isUser ? (
                    <p className="text-xs leading-relaxed font-medium">{m.content}</p>
                  ) : (
                    <div className="space-y-1">
                      {formatMessageText(m.content)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-2.5 justify-start animate-pulse">
              <div className="w-7 h-7 rounded-full bg-beach-coral/10 border border-beach-coral/20 flex items-center justify-center shrink-0">
                <Users className="w-3.5 h-3.5 text-beach-coral animate-spin" />
              </div>
              <div className="p-3 bg-white text-slate-400 border border-beach-cream/80 rounded-2xl rounded-tl-none flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin text-beach-coral" />
                <span className="text-[10px] font-bold">Casey is analyzing live database...</span>
              </div>
            </div>
          )}
        </div>

        {/* Suggestion Prompt Chips */}
        {messages.length === 1 && (
          <div className="px-4 py-2 bg-white/40 border-t border-beach-cream/60 shrink-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left mb-2 flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" /> Consult Suggestions:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {SUGGESTIONS.map((s, idx) => {
                const Icon = s.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSend(s.text)}
                    className="p-2 bg-white hover:bg-beach-coral/5 border border-beach-cream/80 hover:border-beach-coral/30 rounded-xl text-left transition-all group cursor-pointer shadow-xs flex flex-col justify-between h-16"
                  >
                    <Icon className="w-4 h-4 text-beach-coral mb-1 group-hover:scale-110 transition-transform" />
                    <div className="flex justify-between items-center w-full">
                      <span className="text-[9px] font-bold text-slate-700 leading-tight line-clamp-1">{s.label}</span>
                      <ArrowRight className="w-2.5 h-2.5 text-slate-300 group-hover:text-beach-coral group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer Input Form */}
        <div className="p-4 bg-white border-t border-beach-cream shrink-0">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            className="flex items-center gap-2"
          >
            <input 
              type="text"
              placeholder="Ask Casey to draft memos, analyze posts, stats..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              className="flex-1 bg-slate-50 border border-beach-cream rounded-2xl px-4 py-2.5 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-beach-coral focus:ring-1 focus:ring-beach-coral transition-all"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className={`p-2.5 rounded-2xl flex items-center justify-center transition-all ${
                input.trim() && !isLoading 
                  ? 'bg-beach-coral hover:bg-beach-coral/90 text-white shadow-md active:scale-95' 
                  : 'bg-slate-100 text-slate-300 border border-slate-200'
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <p className="text-[8px] text-slate-400 mt-2 text-center">
            Casey synthesizes real data in compliance with municipal regulations.
          </p>
        </div>
      </div>
    </div>
  );
}
