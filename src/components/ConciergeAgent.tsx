import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { MessageCircle, X, Send, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Msg = { role: "user" | "assistant"; content: string };

const STORAGE_KEY = "5io-concierge-chat";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const FN_URL = `${SUPABASE_URL}/functions/v1/concierge-chat`;

const QUICK_ACTIONS = [
  "List my company on the map",
  "Find the right state program",
  "Post a job at my startup",
  "Submit an upcoming event",
];

const GREETING: Msg = {
  role: "assistant",
  content:
    "Hi 👋 I'm the **5iO Concierge**. I can help you list your startup on the map, find the right state program, post a job, or submit an event.\n\nWhat brings you here today?",
};

export default function ConciergeAgent() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>(() => {
    if (typeof window === "undefined") return [GREETING];
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Msg[]) : null;
      return parsed && parsed.length > 0 ? parsed : [GREETING];
    } catch {
      return [GREETING];
    }
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
    } catch {}
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  const send = async (text: string) => {
    const value = text.trim();
    if (!value || streaming) return;
    const next: Msg[] = [...msgs, { role: "user", content: value }];
    setMsgs([...next, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    try {
      const r = await fetch(FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!r.ok || !r.body) throw new Error(`status ${r.status}`);
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let acc = "";
      while (true) {
        const { value: chunk, done } = await reader.read();
        if (done) break;
        buf += dec.decode(chunk, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const data = t.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          try {
            const j = JSON.parse(data);
            const delta = j?.choices?.[0]?.delta?.content;
            if (delta) {
              acc += delta;
              setMsgs((m) => {
                const copy = [...m];
                copy[copy.length - 1] = { role: "assistant", content: acc };
                return copy;
              });
            }
          } catch {}
        }
      }
    } catch (e) {
      setMsgs((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "assistant",
          content:
            "Sorry — I hit a snag. You can also explore [the Map](/map), [Navigator](/navigator), or [list your company](/map/add-company) directly.",
        };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-2xl shadow-primary/30 transition hover:scale-105"
        aria-label="Open Concierge"
      >
        <Sparkles className="h-4 w-4" />
        Need help? Ask the Concierge
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex h-[560px] w-[380px] max-w-[calc(100vw-1.5rem)] max-h-[calc(100vh-1.5rem)] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
      {/* header */}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-primary px-4 py-3 text-primary-foreground">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
            <MessageCircle className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">5iO Concierge</p>
            <p className="text-[10px] uppercase tracking-widest text-white/70">Live · AI assistant</p>
          </div>
        </div>
        <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-1 hover:bg-white/10">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm">
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-primary-foreground"
                  : "max-w-[90%] rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-foreground"
              }
            >
              {m.role === "assistant" ? (
                <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-a:text-primary prose-a:font-semibold">
                  <ReactMarkdown
                    components={{
                      a: ({ href, children }) => {
                        const isInternal = href && href.startsWith("/");
                        if (isInternal) {
                          return (
                            <a
                              href={href}
                              className="my-1 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground no-underline hover:opacity-90"
                            >
                              {children} →
                            </a>
                          );
                        }
                        return (
                          <a href={href} target="_blank" rel="noreferrer" className="text-primary underline">
                            {children}
                          </a>
                        );
                      },
                    }}
                  >
                    {m.content || (streaming && i === msgs.length - 1 ? "…" : "")}
                  </ReactMarkdown>
                </div>
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}
        {streaming && msgs[msgs.length - 1]?.content === "" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> thinking…
          </div>
        )}
      </div>

      {/* quick actions */}
      {msgs.length <= 1 && (
        <div className="flex flex-wrap gap-1.5 border-t border-border px-3 py-2">
          {QUICK_ACTIONS.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              className="rounded-full border border-border bg-background px-3 py-1 text-[11px] hover:border-primary hover:text-primary"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-border bg-background p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything…"
          className="flex-1 rounded-full border border-border bg-card px-4 py-2 text-sm focus:border-primary focus:outline-none"
          disabled={streaming}
        />
        <Button type="submit" size="icon" className="h-9 w-9 rounded-full" disabled={streaming || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}