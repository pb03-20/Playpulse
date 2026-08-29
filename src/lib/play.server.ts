export type PlayReview = {
  id: string;
  userName: string;
  score: number;
  content: string;
  at: string;
  thumbsUp: number;
  version: string | null;
};

const RPC_URL =
  "https://play.google.com/_/PlayStoreUi/data/batchexecute?rpcids=UsvDTd&hl=%LANG%&gl=%COUNTRY%";

function parseReview(r: unknown[]): PlayReview | null {
  try {
    const content = typeof r[4] === "string" ? (r[4] as string) : "";
    if (!content.trim()) return null;
    const ts = Array.isArray(r[5]) ? Number((r[5] as number[])[0]) : 0;
    return {
      id: String(r[0]),
      userName: Array.isArray(r[1]) ? String((r[1] as unknown[])[0] ?? "User") : "User",
      score: Number(r[2]) || 0,
      content,
      at: ts ? new Date(ts * 1000).toISOString() : "",
      thumbsUp: Number(r[6]) || 0,
      version: typeof r[10] === "string" ? (r[10] as string) : null,
    };
  } catch {
    return null;
  }
}

async function fetchPage(
  appId: string,
  lang: string,
  country: string,
  count: number,
  token: string | null,
): Promise<{ reviews: PlayReview[]; token: string | null }> {
  const inner = JSON.stringify([null, null, [2, 2, [count, null, token], null, []], [appId, 7]]);
  const body = new URLSearchParams();
  body.set("f.req", JSON.stringify([[["UsvDTd", inner, null, "generic"]]]));

  const res = await fetch(
    RPC_URL.replace("%LANG%", encodeURIComponent(lang)).replace(
      "%COUNTRY%",
      encodeURIComponent(country),
    ),
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body,
    },
  );
  if (!res.ok) throw new Error(`Google Play responded with ${res.status}`);

  const text = await res.text();
  const line = text.split("\n").find((l) => l.includes("UsvDTd"));
  if (!line) return { reviews: [], token: null };

  const envelope = JSON.parse(line) as unknown[][];
  const raw = envelope[0]?.[2];
  if (typeof raw !== "string") return { reviews: [], token: null };

  const payload = JSON.parse(raw) as unknown[];
  const rows = (payload[0] as unknown[][]) ?? [];
  const next = Array.isArray(payload[1]) ? (payload[1] as unknown[])[1] : null;

  return {
    reviews: rows.map((r) => parseReview(r)).filter((r): r is PlayReview => r !== null),
    token: typeof next === "string" ? next : null,
  };
}

export async function scrapePlayReviews(
  appId: string,
  target: number,
  lang: string,
  country: string,
): Promise<PlayReview[]> {
  const all: PlayReview[] = [];
  let token: string | null = null;

  while (all.length < target) {
    const size = Math.min(150, target - all.length);
    const page: { reviews: PlayReview[]; token: string | null } = await fetchPage(
      appId,
      lang,
      country,
      size,
      token,
    );
    if (page.reviews.length === 0) break;
    all.push(...page.reviews);
    token = page.token;
    if (!token) break;
  }

  return all.slice(0, target);
}
