'use client';

import { useState, useRef, useEffect } from 'react';
import { sendChatMessage, ChatMessage } from '@/lib/api';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  placeId?: number;
  placeName?: string;
}

export function ChatPanel({ isOpen, onClose, placeId, placeName }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset messages when place changes
  useEffect(() => {
    setMessages([]);
    setModel('');
  }, [placeId]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const response = await sendChatMessage({
        message: userMessage,
        placeId,
        includeVideos: true,
        history: messages.slice(-10), // Keep last 10 messages for context
      });

      setMessages(prev => [...prev, { role: 'assistant', content: response.response }]);
      setModel(response.model);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${errorMessage}. Please try again.`
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Quick suggestion buttons
  const suggestions = placeId
    ? [
        'Is tomorrow good for photos here?',
        'Best time for golden hour?',
        'What should I photograph?'
      ]
    : [
        'Which place has best weather?',
        'Where should I go tomorrow?',
        'Any dramatic sky opportunities?'
      ];

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full sm:w-96 bg-zinc-900 border-l border-zinc-700
                      flex flex-col shadow-2xl z-50 animate-slide-in">
        {/* Header */}
        <div className="p-4 border-b border-zinc-700 flex justify-between items-center shrink-0">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <span className="text-xl">⚡</span>
              Photo Day AI
            </h3>
            {placeName && (
              <p className="text-xs text-zinc-400 mt-0.5">Discussing: {placeName}</p>
            )}
            {model && (
              <p className="text-xs text-zinc-500 mt-0.5">
                Powered by {model === 'workers-ai' ? 'Llama 3.3' : 'Claude'}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">📸</div>
              <p className="text-zinc-400 text-sm mb-4">
                Ask me about weather conditions, best shooting times, or photography tips!
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {suggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(suggestion)}
                    className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-full
                               text-zinc-300 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-2xl rounded-br-md'
                  : 'bg-zinc-800 text-zinc-100 rounded-2xl rounded-bl-md'
              } px-4 py-2.5`}>
                <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-zinc-800 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-zinc-700 shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about weather, places..."
              disabled={loading}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5
                         text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500
                         disabled:opacity-50 placeholder-zinc-500"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600
                         px-4 py-2.5 rounded-lg text-sm font-medium transition-colors
                         flex items-center justify-center min-w-[70px]"
            >
              {loading ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                'Send'
              )}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in {
          animation: slide-in 0.2s ease-out;
        }
      `}</style>
    </>
  );
}
