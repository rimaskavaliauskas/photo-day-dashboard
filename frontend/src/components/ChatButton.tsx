'use client';

import { useState } from 'react';
import { ChatPanel } from './ChatPanel';

export function ChatButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700
                   rounded-full shadow-lg flex items-center justify-center z-30
                   transition-all hover:scale-110 hover:shadow-xl
                   group"
        title="Ask AI about photography conditions"
        aria-label="Open AI chat"
      >
        <span className="text-2xl group-hover:scale-110 transition-transform">⚡</span>

        {/* Pulse animation */}
        <span className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-20" />
      </button>

      {/* Chat Panel */}
      <ChatPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
