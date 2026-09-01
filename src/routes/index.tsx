import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Loader2, Minus, Plus, Search, Send, Sparkles, Square, Star, Trash2, TrendingUp } from "lucide-react";
import Markdown from "react-markdown";
import { askReviews, scrapeReviews } from "@/lib/reviews.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PlayPulse — AI User Research from Google Play Reviews" },
      {
        name: "description",
        content:
          "Pull Google Play reviews and chat with them. Instant themes, sentiment and evidence-backed answers powered by Gemini.",
      },
      { property: "og:title", content: "PlayPulse — AI User Research from App Reviews" },
      {
        property: "og:description",
        content:
          "Scrape Google Play reviews and ask anything: themes, complaints, sentiment trends — answered with real user quotes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Review = {
  id: string;
  userName: string;
  score: number;
  content: string;
  at: string;
  thumbsUp: number;
  version: string | null;
};

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What are the top complaints?",
  "What do users love most?",
  "Any recurring bugs or crashes?",
  "Summarise sentiment in 3 bullets",
];

function Index() {
  const scrape = useServerFn(scrapeReviews);
  const ask = useServerFn(askReviews);

  const [appId, setAppId] = useState("com.whatsapp");
  const [count, setCount] = useState(300);
  const [countRaw, setCountRaw] = useState("300");
  const [loadingScrape, setLoadingScrape] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadedApp, setLoadedApp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const stats = useMemo(() => {
    if (reviews.length === 0) return null;
    const avg = reviews.reduce((s, r) => s + r.score, 0) / reviews.length;
    const positive = reviews.filter((r) => r.score >= 4).length;
    const negative = reviews.filter((r) => r.score <= 2).length;
    const dist = [5, 4, 3, 2, 1].map((n) => ({
      star: n,
      count: reviews.filter((r) => r.score === n).length,
    }));
    return { avg, positive, negative, dist, total: reviews.length };
  }, [reviews]);

  async function handleScrape() {
    setLoadingScrape(true);
    setError(null);
    try {
      const res = await scrape({ data: { appId: appId.trim(), count, lang: "en", country: "us" } });
      setReviews(res.reviews);
      setLoadedApp(res.appId);
      setMessages([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while fetching reviews.");
    } finally {
      setLoadingScrape(false);
    }
  }

  async function handleAsk(q: string) {
    const trimmed = q.trim();
    if (!trimmed || thinking || reviews.length === 0) return;
    setQuestion("");

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const history = messages.slice(-6);
    setMessages((m) => [...m, { role: "user", content: trimmed }]);
    setThinking(true);
    try {
      const res = await ask(
        { data: { question: trimmed, appId: loadedApp ?? appId, reviews, history } },
        { signal: controller.signal }
      );
      setMessages((m) => [...m, { role: "assistant", content: res.answer }]);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: "_Request cancelled by user._" },
        ]);
      } else {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: e instanceof Error ? e.message : "The AI request failed." },
        ]);
      }
    } finally {
      setThinking(false);
      abortControllerRef.current = null;
    }
  }

  function handleStop() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setThinking(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="glass-panel flex size-11 items-center justify-center rounded-2xl">
            <Sparkles className="size-5 text-primary" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              <span className="text-gradient">PlayPulse</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              AI user research on real Google Play reviews
            </p>
          </div>
        </div>
      </header>

      <section className="glass-panel p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="appId" className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Google Play app ID
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-glass-border bg-glass px-3 py-2.5">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                id="appId"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="com.whatsapp"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <div className="sm:w-44">
            <label htmlFor="count" className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Reviews to pull
            </label>
            <div className="flex items-center rounded-xl border border-glass-border bg-glass">
              <button
                type="button"
                aria-label="Decrease count"
                onClick={() => {
                  const next = Math.max(10, count - 50);
                  setCount(next);
                  setCountRaw(String(next));
                }}
                className="flex size-9 shrink-0 items-center justify-center rounded-l-xl text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
              >
                <Minus className="size-3.5" />
              </button>
              <input
                id="count"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={countRaw}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, "");
                  setCountRaw(raw);
                  const n = parseInt(raw, 10);
                  if (!isNaN(n)) setCount(Math.max(10, n));
                }}
                onBlur={() => {
                  const clamped = Math.max(10, count);
                  setCount(clamped);
                  setCountRaw(String(clamped));
                }}
                className="w-full bg-transparent py-2.5 text-center text-sm outline-none"
              />
              <button
                type="button"
                aria-label="Increase count"
                onClick={() => {
                  const next = count + 50;
                  setCount(next);
                  setCountRaw(String(next));
                }}
                className="flex size-9 shrink-0 items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
          </div>
          <button
            onClick={handleScrape}
            disabled={loadingScrape}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {loadingScrape ? <Loader2 className="size-4 animate-spin" /> : <TrendingUp className="size-4" />}
            {loadingScrape ? "Fetching…" : "Analyze"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </section>

      {stats && (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Reviews analysed" value={String(stats.total)} />
          <StatCard
            label="Average rating"
            value={stats.avg.toFixed(2)}
            icon={<Star className="size-4 text-primary" />}
          />
          <StatCard
            label="Positive (4–5★)"
            value={`${Math.round((stats.positive / stats.total) * 100)}%`}
          />
          <StatCard
            label="Negative (1–2★)"
            value={`${Math.round((stats.negative / stats.total) * 100)}%`}
          />
          <div className="glass-panel col-span-2 flex flex-col gap-2 p-4 lg:col-span-4">
            {stats.dist.map((d) => (
              <div key={d.star} className="flex items-center gap-3 text-xs">
                <span className="w-7 shrink-0 text-muted-foreground">{d.star}★</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(d.count / stats.total) * 100}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right text-muted-foreground">{d.count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="glass-panel flex min-h-[26rem] flex-1 flex-col p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Bot className="size-4 text-primary" /> Ask the reviews
          </h2>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <Trash2 className="size-3.5" /> Clear
            </button>
          )}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 py-10 text-center">
              <p className="max-w-sm text-sm text-muted-foreground">
                {reviews.length === 0
                  ? "Pull an app's reviews above, then ask anything about what users are saying."
                  : `${reviews.length} reviews loaded. Ask anything — themes, bugs, sentiment, feature requests.`}
              </p>
              {reviews.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleAsk(s)}
                      className="rounded-full border border-glass-border bg-glass px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={
                  m.role === "user"
                    ? "max-w-[85%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                    : "max-w-[90%] space-y-3 rounded-2xl border border-glass-border bg-glass px-4 py-3 text-sm leading-relaxed [&_li]:ml-4 [&_li]:list-disc [&_strong]:font-semibold [&_ul]:space-y-1.5"
                }
              >
                {m.role === "assistant" ? <Markdown>{m.content}</Markdown> : m.content}
              </div>
            </div>
          ))}

          {thinking && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Reading the reviews…
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk(question);
          }}
          className="mt-4 flex items-center gap-2 rounded-2xl border border-glass-border bg-glass px-3 py-2"
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={reviews.length === 0}
            placeholder={
              reviews.length === 0 ? "Load reviews first…" : "Ask about these users…"
            }
            className="w-full bg-transparent px-1 py-1.5 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          />
          {thinking ? (
            <button
              type="button"
              onClick={handleStop}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-opacity hover:opacity-90"
              aria-label="Stop"
            >
              <Square className="size-4 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={thinking || reviews.length === 0 || !question.trim()}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
              aria-label="Send question"
            >
              <Send className="size-4" />
            </button>
          )}
        </form>
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="glass-panel p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 text-2xl font-semibold">
        {icon}
        {value}
      </p>
    </div>
  );
}
