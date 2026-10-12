import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { aiApi, type ChatMessage } from '@/lib/aiApi';
import { clsx } from 'clsx';
import { Send, Bot, User, Sparkles, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// ── Suggested prompts ──────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'How did my shop perform today?',
  'Which products are running low on stock?',
  'What are my top expenses this month?',
  'Do I have any overdue credit payments?',
  'How can I improve my profit margin?',
  'Which products are selling the most?',
];

// ── Message bubble ─────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div className={clsx('flex gap-3 items-start', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div
        className={clsx(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white',
          isUser ? 'bg-orange-600' : 'bg-slate-700 dark:bg-slate-600',
        )}
      >
        {isUser ? <User size={15} /> : <Bot size={15} />}
      </div>

      {/* Bubble */}
      <div
        className={clsx(
          'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'bg-orange-600 text-white rounded-tr-sm'
            : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-sm shadow-sm border border-slate-100 dark:border-slate-700',
        )}
      >
        {isUser ? (
          <span>{msg.text}</span>
        ) : (
          <ReactMarkdown
            components={{
              h1: ({ children }) => <p className="font-bold text-base mb-1">{children}</p>,
              h2: ({ children }) => <p className="font-bold text-sm mb-1 mt-2">{children}</p>,
              h3: ({ children }) => <p className="font-semibold text-sm mb-1 mt-2">{children}</p>,
              p:  ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
              li: ({ children }) => <li className="leading-snug">{children}</li>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
              code: ({ children }) => (
                <code className="bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded text-xs font-mono">{children}</code>
              ),
              hr: () => <hr className="border-slate-200 dark:border-slate-600 my-2" />,
            }}
          >
            {msg.text}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}

// ── Typing indicator ───────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-3 items-start">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-700 dark:bg-slate-600 flex items-center justify-center text-white">
        <Bot size={15} />
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function AiPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const sendMutation = useMutation({
    mutationFn: ({ message, history }: { message: string; history: ChatMessage[] }) =>
      aiApi.chat(message, history),
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: 'model', text: data.reply }]);
    },
    onError: (err) => {
      setMessages((prev) => [
        ...prev,
        { role: 'model', text: `Sorry, something went wrong: ${(err as Error).message}` },
      ]);
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sendMutation.isPending]);

  const handleSend = (text = input.trim()) => {
    if (!text || sendMutation.isPending) return;

    const userMsg: ChatMessage = { role: 'user', text };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput('');

    // Send history without the current message (it's the new message)
    sendMutation.mutate({ message: text, history: messages });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    setMessages([]);
    setInput('');
    inputRef.current?.focus();
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">BERT</h1>
            <p className="text-xs text-slate-400">AI Business Assistant</p>
          </div>
        </div>
        {!isEmpty && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw size={13} />
            New chat
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-4">
        {isEmpty ? (
          /* Welcome state */
          <div className="flex flex-col items-center justify-center h-full text-center gap-6">
            <div>
              <div className="w-16 h-16 rounded-2xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mx-auto mb-4">
                <Sparkles size={32} className="text-orange-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Hey, I'm BERT</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                Your AI business assistant. Ask me about your sales, stock, expenses — or anything about running your shop better.
              </p>
            </div>

            {/* Suggestion chips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="text-left text-sm px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 dark:hover:border-orange-700 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} />
            ))}
            {sendMutation.isPending && <TypingIndicator />}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-700 px-4 md:px-6 py-4">
        <div className="flex items-end gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 focus-within:border-orange-400 dark:focus-within:border-orange-500 transition-colors shadow-sm">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask BERT anything about your shop…"
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none min-h-[24px] max-h-32"
            style={{ height: 'auto' }}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = 'auto';
              t.style.height = `${Math.min(t.scrollHeight, 128)}px`;
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || sendMutation.isPending}
            className={clsx(
              'flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors',
              input.trim() && !sendMutation.isPending
                ? 'bg-orange-600 text-white hover:bg-orange-700'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed',
            )}
          >
            <Send size={15} />
          </button>
        </div>
        <p className="text-[10px] text-slate-400 text-center mt-2">
          BERT uses live shop data · {50} messages/day
        </p>
      </div>
    </div>
  );
}
