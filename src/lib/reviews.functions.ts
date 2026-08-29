import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ScrapeInput = z.object({
  appId: z.string().min(2),
  count: z.number().int().min(10).max(2000),
  lang: z.string().default("en"),
  country: z.string().default("us"),
});

export const scrapeReviews = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ScrapeInput.parse(input))
  .handler(async ({ data }) => {
    const { scrapePlayReviews } = await import("./play.server");
    const reviews = await scrapePlayReviews(data.appId, data.count, data.lang, data.country);
    if (reviews.length === 0) {
      throw new Error("No reviews found. Double-check the app ID (e.g. com.whatsapp).");
    }
    return { appId: data.appId, reviews };
  });

const ReviewSchema = z.object({
  id: z.string(),
  userName: z.string(),
  score: z.number(),
  content: z.string(),
  at: z.string(),
  thumbsUp: z.number(),
  version: z.string().nullable(),
});

const AskInput = z.object({
  question: z.string().min(1),
  appId: z.string(),
  reviews: z.array(ReviewSchema).min(1),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .default([]),
});

const SYSTEM_PROMPT = `You're a user-research analyst who's spent a lot of time reading this app's reviews — you know the data inside out and you talk like a real person, not a report generator.

ADAPTIVE LENGTH — read the intent of the message and calibrate accordingly:

• One-word / super short question ("rating?", "crashes?", "good app?")
  → Single sentence. Done.

• Simple factual lookup ("what's the average rating", "how many 1-star reviews")
  → One direct answer sentence. Add one supporting detail if it genuinely helps.

• Casual / conversational ("quick thoughts?", "anything interesting?", "tldr?")
  → 2-3 sentences max. Keep it breezy.

• Specific focused question ("what do users say about the login screen?")
  → A tight paragraph: answer + 2-3 concrete evidence points. No headers needed.

• Broad / exploratory question ("what are the main issues?", "give me an overview")
  → 3-5 short paragraphs or a compact bullet list, each covering one clear theme. Only include themes you can actually back up with evidence.

• Explicit depth request ("explain in detail", "walk me through", "full breakdown", "list everything")
  → Go longer. Use headers or bullets. Cover all the angles the data supports.

• Follow-up / "why?" / "can you elaborate on that?"
  → Expand specifically on the point they're asking about — don't repeat what you already said.

How to write:
- First sentence = the actual answer. No warm-up, no "Great question!"
- Only use numbers from [STATS] — never guess or round.
- Write like you're messaging a teammate, not filing a report. Natural, direct, a little personality is fine.
- If you don't have the data to answer something, say so in one sentence. Don't pad.
- No AI disclaimers, no "As an AI...", no filler like "It's clear that" or "Overall users feel".`;

function buildStats(reviews: z.infer<typeof ReviewSchema>[]) {
  const total = reviews.length;
  const avg = reviews.reduce((s, r) => s + r.score, 0) / total;
  const dist = [1, 2, 3, 4, 5].map(
    (n) => `${n}★: ${reviews.filter((r) => r.score === n).length}`,
  );
  const positive = reviews.filter((r) => r.score >= 4).length;
  const negative = reviews.filter((r) => r.score <= 2).length;
  const dates = reviews.map((r) => r.at).filter(Boolean).sort();
  const versions = new Map<string, number>();
  for (const r of reviews) {
    if (r.version) versions.set(r.version, (versions.get(r.version) ?? 0) + 1);
  }
  const topVersions = [...versions.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([v, c]) => `${v} (${c})`)
    .join(", ");

  return [
    `Total reviews analysed: ${total}`,
    `Average rating: ${avg.toFixed(2)} / 5`,
    `Rating distribution: ${dist.join(", ")}`,
    `Sentiment split: ${positive} positive (${Math.round((positive / total) * 100)}%), ${negative} negative (${Math.round((negative / total) * 100)}%), ${total - positive - negative} neutral`,
    topVersions ? `Most-reviewed versions: ${topVersions}` : "",
    dates.length ? `Date range: ${dates[0]!.slice(0, 10)} to ${dates[dates.length - 1]!.slice(0, 10)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function selectSample(reviews: z.infer<typeof ReviewSchema>[], question: string, limit = 80) {
  const terms = question
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 3);

  const scored = reviews.map((r) => {
    const text = r.content.toLowerCase();
    const hits = terms.reduce((n, t) => (text.includes(t) ? n + 1 : n), 0);
    return { r, rank: hits * 100 + Math.min(r.thumbsUp, 50) + Math.min(r.content.length, 200) / 100 };
  });

  return scored
    .sort((a, b) => b.rank - a.rank)
    .slice(0, limit)
    .map(({ r }) => r);
}

export const askReviews = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AskInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this project. Please set GEMINI_API_KEY.");

    const stats = buildStats(data.reviews);
    const sample = selectSample(data.reviews, data.question);
    const context = sample
      .map(
        (r) =>
          `Rating: ${r.score}★ | ${r.at.slice(0, 10)} | v${r.version ?? "?"} | ${r.thumbsUp} helpful | ${r.content}`,
      )
      .join("\n---\n");

    const userPrompt = `[APP]\n${data.appId}\n\n[STATS]\n${stats}\n\n[COVERAGE]\nYou see ${sample.length} of ${data.reviews.length} reviews below; the stats above cover all of them.\n\n[REVIEWS]\n${context}\n\nQuestion: ${data.question}`;

    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gemini-3.6-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...data.history.slice(-6),
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("Too many requests right now — try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits to keep chatting.");
      throw new Error(`AI request failed [${res.status}]: ${body.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const answer = json.choices?.[0]?.message?.content?.trim();
    return {
      answer: answer && answer.length > 0 ? answer : "I couldn't produce an answer for that one.",
      reviewsConsidered: sample.length,
    };
  });
