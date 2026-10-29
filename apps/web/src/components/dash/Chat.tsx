"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Flag,
  Paperclip,
  Phone,
  Send,
  ShieldBan,
  Video,
} from "lucide-react";
import { formatDate, type Conversation } from "@edukhata/contracts";
import { Avatar, Card } from "@/components/ui";
import { useToast } from "@/components/ui/client";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";

/**
 * Chat UI preview. Phase 3 replaces the local state with the WAN chat-messaging module
 * (@chat-module/react): realtime delivery, read receipts, signed file links.
 */
export function ChatView({ conversations }: { conversations: Conversation[] }) {
  const params = useSearchParams();
  const { lang } = useT();
  const toast = useToast();
  const [convs, setConvs] = useState(conversations);
  const [active, setActive] = useState<string | null>(params.get("c") ?? null);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const cur = convs.find((c) => c.id === active);
  const desktopCur = cur ?? convs[0];

  useEffect(() => endRef.current?.scrollIntoView({ block: "end" }), [active, convs]);

  function send() {
    const text = draft.trim();
    if (!text || !desktopCur) return;
    setConvs((cs) =>
      cs.map((c) =>
        c.id === desktopCur.id
          ? {
              ...c,
              lastMessage: text,
              at: new Date().toISOString(),
              messages: [...c.messages, { from: "me", text, at: new Date().toISOString() }],
            }
          : c,
      ),
    );
    setDraft("");
  }

  const call = (kind: string) =>
    toast({
      tone: "info",
      title: `${kind} call`,
      body: "1:1 calls connect through the WAN calling module in Phase 3. Calls are not recorded.",
    });

  return (
    <Card className="grid h-[calc(100vh-190px)] min-h-[480px] overflow-hidden md:grid-cols-[300px_1fr]">
      <aside className={cn("flex min-h-0 flex-col border-r border-line", cur && "hidden md:flex")}>
        <div className="border-b border-line p-3">
          <input
            className="input h-9"
            placeholder="Search conversations"
            aria-label="Search conversations"
          />
        </div>
        <ul className="flex-1 overflow-y-auto">
          {convs.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => (
                  setActive(c.id),
                  setConvs((cs) => cs.map((x) => (x.id === c.id ? { ...x, unread: 0 } : x)))
                )}
                className={cn(
                  "flex w-full items-center gap-3 border-b border-line px-3 py-3 text-left hover:bg-slate-50",
                  desktopCur?.id === c.id && "md:bg-[var(--color-accent-50)]",
                )}
              >
                <span className="relative">
                  <Avatar name={c.peer} hue={c.peerHue} size={40} />
                  {c.online && (
                    <span
                      className="absolute right-0 bottom-0 h-3 w-3 rounded-full bg-success ring-2 ring-white"
                      aria-label="Online"
                    />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{c.peer}</span>
                    <span className="shrink-0 text-[10px] text-muted">
                      {formatDate(c.at, lang)}
                    </span>
                  </span>
                  {c.orderCode && (
                    <span className="block text-[11px] font-semibold text-[var(--color-accent)]">
                      {c.orderCode}
                    </span>
                  )}
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-muted">{c.lastMessage}</span>
                    {c.unread > 0 && (
                      <span className="rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">
                        {c.unread}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      {desktopCur && (
        <section
          className={cn("flex min-h-0 flex-col", !cur && "hidden md:flex")}
          aria-label={`Conversation with ${desktopCur.peer}`}
        >
          <header className="flex items-center gap-3 border-b border-line px-4 py-3">
            <button
              className="rounded-lg p-1 md:hidden"
              aria-label="Back to conversations"
              onClick={() => setActive(null)}
            >
              <ArrowLeft size={20} />
            </button>
            <Avatar name={desktopCur.peer} hue={desktopCur.peerHue} size={38} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{desktopCur.peer}</p>
              <p className="truncate text-[11px] text-muted">
                {desktopCur.online ? "Online" : "Offline"} · {desktopCur.title}
              </p>
            </div>
            <button
              aria-label="Audio call"
              onClick={() => call("Audio")}
              className="rounded-lg p-2 text-muted hover:bg-slate-100 hover:text-ink"
            >
              <Phone size={18} />
            </button>
            <button
              aria-label="Video call"
              onClick={() => call("Video")}
              className="rounded-lg p-2 text-muted hover:bg-slate-100 hover:text-ink"
            >
              <Video size={18} />
            </button>
            <button
              aria-label="Report conversation"
              onClick={() => toast({ tone: "info", title: "Report sent to support (demo)" })}
              className="hidden rounded-lg p-2 text-muted hover:bg-slate-100 hover:text-danger sm:block"
            >
              <Flag size={18} />
            </button>
            <button
              aria-label="Block user"
              onClick={() =>
                toast({
                  tone: "info",
                  title: "Blocking uses the chat module's block list (Phase 3)",
                })
              }
              className="hidden rounded-lg p-2 text-muted hover:bg-slate-100 hover:text-danger sm:block"
            >
              <ShieldBan size={18} />
            </button>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/60 p-4">
            <p className="mx-auto w-fit rounded-full bg-white px-3 py-1 text-[11px] text-muted ring-1 ring-line">
              Keep payments and contact details on EduKhata to stay protected.
            </p>
            {desktopCur.messages.map((m, i) => (
              <div
                key={i}
                className={cn("flex", m.from === "me" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
                    m.from === "me"
                      ? "rounded-br-md bg-[var(--color-accent)] text-white"
                      : "rounded-bl-md bg-white text-ink",
                  )}
                >
                  {m.file && (
                    <p
                      className={cn(
                        "mb-1 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold",
                        m.from === "me" ? "bg-white/15" : "bg-slate-100",
                      )}
                    >
                      <Paperclip size={13} /> {m.file}
                    </p>
                  )}
                  <p className="whitespace-pre-line">{m.text}</p>
                  <p
                    className={cn(
                      "mt-0.5 flex items-center justify-end gap-1 text-[10px]",
                      m.from === "me" ? "text-white/75" : "text-muted",
                    )}
                  >
                    {new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {m.from === "me" &&
                      (i === desktopCur.messages.length - 1 ? (
                        <Check size={12} />
                      ) : (
                        <CheckCheck size={12} />
                      ))}
                  </p>
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <form
            className="flex items-end gap-2 border-t border-line p-3"
            onSubmit={(e) => (e.preventDefault(), send())}
          >
            <label
              className="cursor-pointer rounded-lg p-2 text-muted hover:bg-slate-100"
              aria-label="Attach file"
            >
              <Paperclip size={20} />
              <input
                type="file"
                className="sr-only"
                onChange={(e) =>
                  e.target.files?.[0] &&
                  toast({
                    tone: "info",
                    title: `Attached ${e.target.files[0].name}`,
                    body: "Uploads go to private storage in Phase 3.",
                  })
                }
              />
            </label>
            <textarea
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
              placeholder="Type a message…"
              aria-label="Message"
              className="input max-h-32 min-h-10 flex-1 resize-none"
            />
            <button
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-white disabled:opacity-40"
              aria-label="Send"
              disabled={!draft.trim()}
            >
              <Send size={17} />
            </button>
          </form>
        </section>
      )}
    </Card>
  );
}
