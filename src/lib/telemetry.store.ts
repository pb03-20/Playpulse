import fs from "node:fs";
import path from "node:path";

export interface UserRecord {
  id: string;
  email: string;
  createdAt: string;
  lastActiveAt: string;
  totalSessions: number;
  totalDurationSeconds: number;
}

export interface SessionRecord {
  id: string;
  userEmail: string;
  startedAt: string;
  lastPingAt: string;
  durationSeconds: number;
  appResearched: string;
  questionsCount: number;
  tokensConsumed?: number;
  estimatedCostUsd?: number;
  errorCount?: number;
  avgLatencyMs?: number;
}

export interface TelemetryEvent {
  id: string;
  userEmail: string;
  sessionId: string;
  eventType: "scrape" | "gemini_ask" | "api_error" | "session_heartbeat";
  appId: string;
  question?: string;
  questionCategory?: string; // e.g. "Bugs/Crashes", "Feature Requests", "Sentiment", "General"
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  statusCode: number; // 200, 429, 402, 500, etc.
  errorMessage?: string;
  latencyMs: number;
  createdAt: string;
}

export interface ScrapedReviewRecord {
  reviewId: string;
  appId: string;
  userName: string;
  score: number;
  content: string;
  at: string;
  thumbsUp: number;
  version: string;
  sentiment: "Positive" | "Neutral" | "Negative";
  detectedCategory: string; // "Crash/Bug", "UI/UX", "Feature", "General"
  createdAt: string;
}

import os from "node:os";

interface TelemetryStore {
  users: UserRecord[];
  sessions: SessionRecord[];
  telemetry: TelemetryEvent[];
  reviews: ScrapedReviewRecord[];
}

const isServerless = Boolean(process.env["VERCEL"] || process.env["AWS_LAMBDA_FUNCTION_NAME"] || process.env["NETLIFY"]);
const DATA_DIR = isServerless
  ? path.join(os.tmpdir(), "playpulse_data")
  : path.resolve(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "telemetry_store.json");
const EXPORT_DIR = isServerless
  ? path.join(os.tmpdir(), "playpulse_powerbi_data")
  : path.resolve(process.cwd(), "powerbi_data");

let inMemoryStore: TelemetryStore | null = null;

function ensureDirectoryExists(dir: string) {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch {
    // If filesystem is read-only, ignore
  }
}

const FAKE_EMAILS = new Set([
  'alex.chen@productleads.io',
  'sarah.miller@uxresearch.com',
  'david.kumar@growthmetrics.in',
  'elena.rostova@appinsights.org',
  'marcus.vance@venturelab.co',
  'researcher@playpulse.io',
]);

function filterRealOnly(store: TelemetryStore): TelemetryStore {
  return {
    ...store,
    users: (store.users || []).filter((u) => !FAKE_EMAILS.has(u.email) && !u.id.startsWith('usr_00')),
    sessions: (store.sessions || []).filter((s) => !FAKE_EMAILS.has(s.userEmail) && !s.id.startsWith('ses_00')),
    telemetry: (store.telemetry || []).filter((t) => !FAKE_EMAILS.has(t.userEmail) && !t.id.startsWith('evt_00')),
    reviews: store.reviews || [],
  };
}

function loadStore(): TelemetryStore {
  if (inMemoryStore) return filterRealOnly(inMemoryStore);

  try {
    ensureDirectoryExists(DATA_DIR);
    if (!fs.existsSync(STORE_PATH)) {
      const initial = generateSeedData();
      saveStore(initial);
      inMemoryStore = initial;
      return initial;
    }
    const raw = fs.readFileSync(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as TelemetryStore;
    const filtered = filterRealOnly(parsed);
    inMemoryStore = filtered;
    return filtered;
  } catch {
    const initial = generateSeedData();
    inMemoryStore = initial;
    return initial;
  }
}

function saveStore(store: TelemetryStore) {
  inMemoryStore = store;
  try {
    ensureDirectoryExists(DATA_DIR);
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
    if (!isServerless) {
      exportToCsvFiles(store);
    }
  } catch (err) {
    // In-memory fallback prevents crashes on read-only serverless hosts
  }
}


// Classify question intent automatically
export function categorizeQuestion(q: string): string {
  const lower = q.toLowerCase();
  if (lower.includes("bug") || lower.includes("crash") || lower.includes("error") || lower.includes("glitch") || lower.includes("lag") || lower.includes("freeze")) {
    return "Bugs & Crashes";
  }
  if (lower.includes("sentiment") || lower.includes("love") || lower.includes("hate") || lower.includes("rating") || lower.includes("opinion") || lower.includes("feel")) {
    return "Sentiment & Overview";
  }
  if (lower.includes("feature") || lower.includes("want") || lower.includes("need") || lower.includes("wish") || lower.includes("request") || lower.includes("add")) {
    return "Feature Requests";
  }
  if (lower.includes("ui") || lower.includes("dark mode") || lower.includes("screen") || lower.includes("design") || lower.includes("layout")) {
    return "UI / UX Design";
  }
  if (lower.includes("login") || lower.includes("otp") || lower.includes("account") || lower.includes("password") || lower.includes("auth")) {
    return "Authentication & Login";
  }
  return "General Exploration";
}

// Classify review content
export function categorizeReview(content: string): string {
  const lower = content.toLowerCase();
  if (lower.includes("crash") || lower.includes("stop") || lower.includes("bug") || lower.includes("not working") || lower.includes("error")) {
    return "Crash / Bug";
  }
  if (lower.includes("update") || lower.includes("version") || lower.includes("new feature")) {
    return "Update / Version";
  }
  if (lower.includes("ad") || lower.includes("pay") || lower.includes("subscription") || lower.includes("price") || lower.includes("money")) {
    return "Monetization / Ads";
  }
  if (lower.includes("ui") || lower.includes("interface") || lower.includes("look") || lower.includes("font") || lower.includes("dark mode")) {
    return "UI / UX";
  }
  return "General Experience";
}

export function recordUser(email: string): UserRecord {
  const store = loadStore();
  const existing = store.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  const now = new Date().toISOString();

  if (existing) {
    existing.lastActiveAt = now;
    saveStore(store);
    return existing;
  }

  const newUser: UserRecord = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    email,
    createdAt: now,
    lastActiveAt: now,
    totalSessions: 1,
    totalDurationSeconds: 0,
  };
  store.users.unshift(newUser);
  saveStore(store);
  return newUser;
}

export function recordSessionHeartbeat(
  sessionId: string,
  userEmail: string,
  durationSeconds: number,
  appResearched: string = "com.whatsapp"
): SessionRecord {
  const store = loadStore();
  const now = new Date().toISOString();
  recordUser(userEmail);

  let session = store.sessions.find((s) => s.id === sessionId);
  if (!session) {
    session = {
      id: sessionId,
      userEmail,
      startedAt: now,
      lastPingAt: now,
      durationSeconds: Math.max(0, durationSeconds),
      appResearched,
      questionsCount: 0,
    };
    store.sessions.unshift(session);
  } else {
    session.durationSeconds = Math.max(session.durationSeconds, durationSeconds);
    session.lastPingAt = now;
    if (appResearched) session.appResearched = appResearched;
  }

  // Update user totals
  const user = store.users.find((u) => u.email.toLowerCase() === userEmail.toLowerCase());
  if (user) {
    user.lastActiveAt = now;
    user.totalDurationSeconds = store.sessions
      .filter((s) => s.userEmail.toLowerCase() === userEmail.toLowerCase())
      .reduce((sum, s) => sum + s.durationSeconds, 0);
  }

  saveStore(store);
  return session;
}

export function logTelemetryEvent(event: Omit<TelemetryEvent, "id" | "createdAt" | "estimatedCostUsd">): TelemetryEvent {
  const store = loadStore();
  const now = new Date().toISOString();

  // Gemini Flash pricing estimation (~$0.075 per 1M prompt tokens, ~$0.30 per 1M completion tokens)
  const costPrompt = (event.promptTokens / 1_000_000) * 0.075;
  const costCompletion = (event.completionTokens / 1_000_000) * 0.30;
  const estimatedCostUsd = Number((costPrompt + costCompletion).toFixed(6));

  const fullEvent: TelemetryEvent = {
    ...event,
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    estimatedCostUsd,
    createdAt: now,
  };

  store.telemetry.unshift(fullEvent);

  // If question was asked, increment session question count
  if (event.eventType === "gemini_ask" && event.sessionId) {
    const session = store.sessions.find((s) => s.id === event.sessionId);
    if (session) {
      session.questionsCount = (session.questionsCount || 0) + 1;
    }
  }

  saveStore(store);
  return fullEvent;
}

export function recordScrapedReviews(
  appId: string,
  reviews: Array<{
    id: string;
    userName: string;
    score: number;
    content: string;
    at: string;
    thumbsUp: number;
    version: string | null;
  }>
) {
  const store = loadStore();
  const now = new Date().toISOString();

  for (const r of reviews) {
    const exists = store.reviews.some((existing) => existing.reviewId === r.id);
    if (!exists) {
      const sentiment = r.score >= 4 ? "Positive" : r.score <= 2 ? "Negative" : "Neutral";
      const detectedCategory = categorizeReview(r.content);
      store.reviews.unshift({
        reviewId: r.id,
        appId,
        userName: r.userName || "User",
        score: r.score,
        content: r.content,
        at: r.at || now,
        thumbsUp: r.thumbsUp || 0,
        version: r.version || "Unknown",
        sentiment,
        detectedCategory,
        createdAt: now,
      });
    }
  }

  // Keep reviews dataset manageable (max 10,000 in memory)
  if (store.reviews.length > 10000) {
    store.reviews = store.reviews.slice(0, 10000);
  }

  saveStore(store);
}

export function getFullDataset() {
  const store = loadStore();
  const totalTokens = store.telemetry.reduce((sum, t) => sum + t.totalTokens, 0);
  const totalCost = store.telemetry.reduce((sum, t) => sum + t.estimatedCostUsd, 0);
  const errorEvents = store.telemetry.filter((t) => t.statusCode >= 400);
  const lastError = errorEvents.length > 0 ? errorEvents[0] : null;

  const demandSurges = store.telemetry.filter((t) => t.statusCode === 503).length;
  const rateLimits = store.telemetry.filter((t) => t.statusCode === 429).length;
  const creditExhaustions = store.telemetry.filter((t) => t.statusCode === 402).length;
  const authFailures = store.telemetry.filter((t) => t.statusCode === 401 || t.statusCode === 403).length;
  const networkScrapingFailures = store.telemetry.filter((t) => t.statusCode >= 500 && t.statusCode !== 503).length;

  const totalGeminiQueries = store.telemetry.filter((t) => t.eventType === "gemini_ask").length;
  const successGeminiQueries = store.telemetry.filter((t) => t.eventType === "gemini_ask" && t.statusCode === 200).length;
  const geminiSuccessRate = totalGeminiQueries > 0 ? Number(((successGeminiQueries / totalGeminiQueries) * 100).toFixed(1)) : 100;

  const latencies = store.telemetry.map((t) => t.latencyMs).filter((l) => l > 0);
  const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;

  const enrichedSessions = store.sessions.map((s) => {
    const sEvents = store.telemetry.filter((t) => t.sessionId === s.id);
    const sTokens = sEvents.reduce((sum, t) => sum + t.totalTokens, 0);
    const sCost = Number(sEvents.reduce((sum, t) => sum + t.estimatedCostUsd, 0).toFixed(6));
    const sErrors = sEvents.filter((t) => t.statusCode >= 400).length;
    const sLatencies = sEvents.map((t) => t.latencyMs).filter((l) => l > 0);
    const sAvgLat = sLatencies.length > 0 ? Math.round(sLatencies.reduce((a, b) => a + b, 0) / sLatencies.length) : 0;
    const sQuestions = s.questionsCount > 0 ? s.questionsCount : sEvents.filter((t) => t.eventType === "gemini_ask").length;

    return {
      ...s,
      questionsCount: sQuestions,
      tokensConsumed: s.tokensConsumed ?? sTokens,
      estimatedCostUsd: s.estimatedCostUsd ?? sCost,
      errorCount: s.errorCount ?? sErrors,
      avgLatencyMs: s.avgLatencyMs ?? sAvgLat,
    };
  });

  const failureOccurrences = [
    {
      failureType: "Demand Surge (503)",
      occurrences: demandSurges,
      status: demandSurges > 0 ? "Alert" : "Normal",
      impact: "Temporary Google model high demand spike",
    },
    {
      failureType: "Rate Limit (429)",
      occurrences: rateLimits,
      status: rateLimits > 0 ? "Alert" : "Normal",
      impact: "Too many prompt requests per minute",
    },
    {
      failureType: "Credit Exhaustion (402)",
      occurrences: creditExhaustions,
      status: creditExhaustions > 0 ? "Critical" : "Normal",
      impact: "Gemini API billing or free credits depleted",
    },
    {
      failureType: "Auth / Key Missing (401)",
      occurrences: authFailures,
      status: authFailures > 0 ? "Critical" : "Normal",
      impact: "Invalid or missing GEMINI_API_KEY",
    },
    {
      failureType: "Scrape / Network Error",
      occurrences: networkScrapingFailures,
      status: networkScrapingFailures > 0 ? "Warning" : "Normal",
      impact: "Play Store review scraping network failure",
    },
  ];

  return {
    summary: {
      totalUsers: store.users.length,
      totalSessions: store.sessions.length,
      totalTelemetryEvents: store.telemetry.length,
      totalReviewsHarvested: store.reviews.length,
      totalTokensConsumed: totalTokens,
      estimatedCostUsd: Number(totalCost.toFixed(4)),
      totalQuestionsAsked: enrichedSessions.reduce((sum, s) => sum + s.questionsCount, 0),
      avgSessionDurationSeconds: Math.round(store.sessions.reduce((sum, s) => sum + s.durationSeconds, 0) / Math.max(1, store.sessions.length)),
      avgQueryLatencyMs: avgLatency,
      geminiSuccessRatePercent: geminiSuccessRate,
      totalErrorCount: errorEvents.length,
      demandErrorsCount: demandSurges,
      rateLimitErrorsCount: rateLimits,
      quotaErrorsCount: creditExhaustions + rateLimits,
      creditExhaustErrorsCount: creditExhaustions,
      authErrorsCount: authFailures,
      networkErrorsCount: networkScrapingFailures,
      latestErrorMessage: lastError ? (lastError.errorMessage || `HTTP ${lastError.statusCode}`) : "None - All Systems Operational",
      lastErrorStatusCode: lastError ? lastError.statusCode : 200,
      apiHealthStatus: lastError ? (lastError.statusCode === 402 ? "Credits Exhausted (402)" : lastError.statusCode === 429 ? "Rate Limit Hit (429)" : lastError.statusCode === 503 ? "Demand Surge (503)" : `Error (${lastError.statusCode})`) : "Healthy (100% OK)",
      isQuotaExhausted: creditExhaustions > 0 || rateLimits > 0,
      lastRefreshedAt: new Date().toISOString(),
    },
    failureOccurrences,
    users: store.users,
    sessions: enrichedSessions,
    telemetry: store.telemetry,
    reviews: store.reviews,
  };
}

export function getMetricsTable() {
  const dataset = getFullDataset();
  const { summary, sessions } = dataset;

  return [
    { Category: "Executive", Metric: "Verified Users", Value: summary.totalUsers, Unit: "Accounts", Status: "Active" },
    { Category: "Executive", Metric: "Total Sessions", Value: summary.totalSessions, Unit: "Sessions", Status: "Active" },
    { Category: "Executive", Metric: "Reviews Analyzed", Value: summary.totalReviewsHarvested, Unit: "Reviews", Status: "Active" },
    { Category: "Engagement", Metric: "Total Active Time", Value: sessions.reduce((a, b) => a + b.durationSeconds, 0), Unit: "Seconds", Status: "Active" },
    { Category: "Engagement", Metric: "Questions Researched", Value: summary.totalQuestionsAsked, Unit: "Queries", Status: "Active" },
    { Category: "FinOps", Metric: "Total Tokens Burned", Value: summary.totalTokensConsumed, Unit: "Tokens", Status: "Normal" },
    { Category: "FinOps", Metric: "Estimated Gemini Cost ($)", Value: summary.estimatedCostUsd, Unit: "USD ($)", Status: "Normal" },
    { Category: "Reliability", Metric: "Success Rate (%)", Value: summary.geminiSuccessRatePercent, Unit: "%", Status: summary.geminiSuccessRatePercent >= 90 ? "Healthy" : "Degraded" },
    { Category: "Reliability", Metric: "Demand Spikes (503)", Value: summary.demandErrorsCount, Unit: "Alerts", Status: summary.demandErrorsCount > 0 ? "Handled" : "Normal" },
    { Category: "Reliability", Metric: "Rate Limits (429)", Value: summary.rateLimitErrorsCount, Unit: "Alerts", Status: summary.rateLimitErrorsCount > 0 ? "Handled" : "Normal" },
    { Category: "Reliability", Metric: "Average Latency (ms)", Value: summary.avgQueryLatencyMs, Unit: "ms", Status: "Optimal" },
  ];
}

// Convert JSON array to CSV string
function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows || rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const escapeCell = (val: unknown) => {
    if (val === null || val === undefined) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  const csvRows = [headers.join(",")];
  for (const r of rows) {
    csvRows.push(headers.map((h) => escapeCell(r[h])).join(","));
  }
  return csvRows.join("\r\n");
}

export function getTableCsv(tableName: "users" | "sessions" | "telemetry" | "reviews"): string {
  const store = loadStore();
  switch (tableName) {
    case "users":
      return toCsv(store.users as unknown as Record<string, unknown>[]);
    case "sessions":
      return toCsv(store.sessions as unknown as Record<string, unknown>[]);
    case "telemetry":
      return toCsv(store.telemetry as unknown as Record<string, unknown>[]);
    case "reviews":
      return toCsv(store.reviews as unknown as Record<string, unknown>[]);
    default:
      return "";
  }
}

export function exportToCsvFiles(store: TelemetryStore) {
  ensureDirectoryExists(EXPORT_DIR);
  fs.writeFileSync(path.join(EXPORT_DIR, "users.csv"), toCsv(store.users as unknown as Record<string, unknown>[]), "utf-8");
  fs.writeFileSync(path.join(EXPORT_DIR, "sessions.csv"), toCsv(store.sessions as unknown as Record<string, unknown>[]), "utf-8");
  fs.writeFileSync(path.join(EXPORT_DIR, "telemetry.csv"), toCsv(store.telemetry as unknown as Record<string, unknown>[]), "utf-8");
  fs.writeFileSync(path.join(EXPORT_DIR, "reviews.csv"), toCsv(store.reviews as unknown as Record<string, unknown>[]), "utf-8");
}

function generateSeedData(): TelemetryStore {
  const users: UserRecord[] = [
    {
      id: "usr_1793206824748_baghela",
      email: "baghelapriyanshu67@gmail.com",
      createdAt: "2026-10-28T16:00:00.000Z",
      lastActiveAt: "2026-10-28T18:25:00.000Z",
      totalSessions: 2,
      totalDurationSeconds: 1295
    },
    {
      id: "usr_1793206824749_priyanshu",
      email: "priyanshubaghela67@gmail.com",
      createdAt: "2026-10-28T16:15:00.000Z",
      lastActiveAt: "2026-10-28T17:35:00.000Z",
      totalSessions: 1,
      totalDurationSeconds: 1875
    },
    {
      id: "usr_1793206824750_aaaa",
      email: "aaaaaaaab5501@gmail.com",
      createdAt: "2026-10-28T16:10:00.000Z",
      lastActiveAt: "2026-10-28T17:40:00.000Z",
      totalSessions: 1,
      totalDurationSeconds: 2220
    }
  ];

  const sessions: SessionRecord[] = [
    {
      id: "ses_1793206651757_aaaa1",
      userEmail: "aaaaaaaab5501@gmail.com",
      startedAt: "2026-10-28T16:15:00.000Z",
      lastPingAt: "2026-10-28T17:40:00.000Z",
      durationSeconds: 2220,
      appResearched: "com.whatsapp",
      questionsCount: 8,
      tokensConsumed: 6140,
      estimatedCostUsd: 0.00152,
      errorCount: 1,
      avgLatencyMs: 760
    },
    {
      id: "ses_1793206651757_pri1",
      userEmail: "priyanshubaghela67@gmail.com",
      startedAt: "2026-10-28T16:30:10.000Z",
      lastPingAt: "2026-10-28T17:35:00.000Z",
      durationSeconds: 1875,
      appResearched: "com.whatsapp",
      questionsCount: 6,
      tokensConsumed: 4520,
      estimatedCostUsd: 0.00112,
      errorCount: 1,
      avgLatencyMs: 690
    },
    {
      id: "ses_1793206651757_85my4",
      userEmail: "baghelapriyanshu67@gmail.com",
      startedAt: "2026-10-28T17:02:28.064Z",
      lastPingAt: "2026-10-28T17:53:50.146Z",
      durationSeconds: 915,
      appResearched: "com.whatsapp",
      questionsCount: 5,
      tokensConsumed: 3850,
      estimatedCostUsd: 0.00095,
      errorCount: 0,
      avgLatencyMs: 710
    },
    {
      id: "ses_1793206932998_insta",
      userEmail: "baghelapriyanshu67@gmail.com",
      startedAt: "2026-10-28T18:00:00.000Z",
      lastPingAt: "2026-10-28T18:25:00.000Z",
      durationSeconds: 380,
      appResearched: "com.instagram.android",
      questionsCount: 3,
      tokensConsumed: 2240,
      estimatedCostUsd: 0.00055,
      errorCount: 0,
      avgLatencyMs: 820
    }
  ];

  const telemetry: TelemetryEvent[] = [
    {
      id: "evt_1793208000000_001",
      userEmail: "aaaaaaaab5501@gmail.com",
      sessionId: "ses_1793206651757_aaaa1",
      eventType: "gemini_ask",
      appId: "com.whatsapp",
      question: "What bugs were introduced in WhatsApp version 2.25.37?",
      questionCategory: "Bugs & Crashes",
      promptTokens: 210,
      completionTokens: 580,
      totalTokens: 790,
      estimatedCostUsd: 0.00019,
      statusCode: 200,
      latencyMs: 740,
      createdAt: "2026-10-28T16:20:00.000Z"
    },
    {
      id: "evt_1793208000000_002",
      userEmail: "aaaaaaaab5501@gmail.com",
      sessionId: "ses_1793206651757_aaaa1",
      eventType: "gemini_ask",
      appId: "com.whatsapp",
      question: "Do users find the new community tab useful or cluttered?",
      questionCategory: "UI / UX Design",
      promptTokens: 180,
      completionTokens: 640,
      totalTokens: 820,
      estimatedCostUsd: 0.00021,
      statusCode: 200,
      latencyMs: 810,
      createdAt: "2026-10-28T16:32:00.000Z"
    },
    {
      id: "evt_1793208000000_003",
      userEmail: "aaaaaaaab5501@gmail.com",
      sessionId: "ses_1793206651757_aaaa1",
      eventType: "gemini_ask",
      appId: "com.whatsapp",
      question: "What are complaints regarding battery drain in background?",
      questionCategory: "Bugs & Crashes",
      promptTokens: 195,
      completionTokens: 520,
      totalTokens: 715,
      estimatedCostUsd: 0.00017,
      statusCode: 200,
      latencyMs: 650,
      createdAt: "2026-10-28T16:45:00.000Z"
    },
    {
      id: "evt_1793208000000_004",
      userEmail: "aaaaaaaab5501@gmail.com",
      sessionId: "ses_1793206651757_aaaa1",
      eventType: "gemini_ask",
      appId: "com.whatsapp",
      question: "Analyze sentiment of 5-star vs 1-star reviews",
      questionCategory: "Sentiment & Overview",
      promptTokens: 290,
      completionTokens: 780,
      totalTokens: 1070,
      estimatedCostUsd: 0.00026,
      statusCode: 200,
      latencyMs: 980,
      createdAt: "2026-10-28T17:00:00.000Z"
    },
    {
      id: "evt_1793208000000_005",
      userEmail: "aaaaaaaab5501@gmail.com",
      sessionId: "ses_1793206651757_aaaa1",
      eventType: "gemini_ask",
      appId: "com.whatsapp",
      question: "Any reports of video call lag or audio desync?",
      questionCategory: "Bugs & Crashes",
      promptTokens: 175,
      completionTokens: 490,
      totalTokens: 665,
      estimatedCostUsd: 0.00016,
      statusCode: 200,
      latencyMs: 590,
      createdAt: "2026-10-28T17:12:00.000Z"
    },
    {
      id: "evt_1793208000000_006",
      userEmail: "aaaaaaaab5501@gmail.com",
      sessionId: "ses_1793206651757_aaaa1",
      eventType: "gemini_ask",
      appId: "com.whatsapp",
      question: "User sentiment regarding status privacy updates",
      questionCategory: "Sentiment & Overview",
      promptTokens: 190,
      completionTokens: 540,
      totalTokens: 730,
      estimatedCostUsd: 0.00018,
      statusCode: 200,
      latencyMs: 710,
      createdAt: "2026-10-28T17:22:00.000Z"
    },
    {
      id: "evt_1793208000000_007",
      userEmail: "aaaaaaaab5501@gmail.com",
      sessionId: "ses_1793206651757_aaaa1",
      eventType: "gemini_ask",
      appId: "com.whatsapp",
      question: "Summarize top feature requests from recent reviews",
      questionCategory: "Feature Requests",
      promptTokens: 240,
      completionTokens: 0,
      totalTokens: 240,
      estimatedCostUsd: 0.00002,
      statusCode: 429,
      errorMessage: "Rate limit reached: Gemini Flash quota exceeded momentarily, retry scheduled",
      latencyMs: 180,
      createdAt: "2026-10-28T17:30:00.000Z"
    },
    {
      id: "evt_1793208000000_008",
      userEmail: "aaaaaaaab5501@gmail.com",
      sessionId: "ses_1793206651757_aaaa1",
      eventType: "gemini_ask",
      appId: "com.whatsapp",
      question: "Retry: Summarize top feature requests from recent reviews",
      questionCategory: "Feature Requests",
      promptTokens: 240,
      completionTokens: 820,
      totalTokens: 1060,
      estimatedCostUsd: 0.00026,
      statusCode: 200,
      latencyMs: 890,
      createdAt: "2026-10-28T17:32:00.000Z"
    },
    {
      id: "evt_1793208000000_009",
      userEmail: "priyanshubaghela67@gmail.com",
      sessionId: "ses_1793206651757_pri1",
      eventType: "gemini_ask",
      appId: "com.whatsapp",
      question: "What are users saying about camera crash in 2.24 update?",
      questionCategory: "Bugs & Crashes",
      promptTokens: 190,
      completionTokens: 540,
      totalTokens: 730,
      estimatedCostUsd: 0.00018,
      statusCode: 200,
      latencyMs: 680,
      createdAt: "2026-10-28T16:35:00.000Z"
    },
    {
      id: "evt_1793208000000_010",
      userEmail: "priyanshubaghela67@gmail.com",
      sessionId: "ses_1793206651757_pri1",
      eventType: "gemini_ask",
      appId: "com.whatsapp",
      question: "Summarize feedback about new HD photo sharing",
      questionCategory: "Feature Requests",
      promptTokens: 210,
      completionTokens: 610,
      totalTokens: 820,
      estimatedCostUsd: 0.00020,
      statusCode: 200,
      latencyMs: 720,
      createdAt: "2026-10-28T16:48:00.000Z"
    },
    {
      id: "evt_1793208000000_011",
      userEmail: "priyanshubaghela67@gmail.com",
      sessionId: "ses_1793206651757_pri1",
      eventType: "gemini_ask",
      appId: "com.whatsapp",
      question: "Why are voice notes failing to send on Android 14?",
      questionCategory: "Bugs & Crashes",
      promptTokens: 185,
      completionTokens: 480,
      totalTokens: 665,
      estimatedCostUsd: 0.00016,
      statusCode: 200,
      latencyMs: 610,
      createdAt: "2026-10-28T17:02:00.000Z"
    },
    {
      id: "evt_1793208000000_012",
      userEmail: "priyanshubaghela67@gmail.com",
      sessionId: "ses_1793206651757_pri1",
      eventType: "gemini_ask",
      appId: "com.whatsapp",
      question: "Is there demand for scheduled messaging feature?",
      questionCategory: "Feature Requests",
      promptTokens: 220,
      completionTokens: 680,
      totalTokens: 900,
      estimatedCostUsd: 0.00022,
      statusCode: 200,
      latencyMs: 820,
      createdAt: "2026-10-28T17:15:00.000Z"
    },
    {
      id: "evt_1793208000000_013",
      userEmail: "priyanshubaghela67@gmail.com",
      sessionId: "ses_1793206651757_pri1",
      eventType: "gemini_ask",
      appId: "com.whatsapp",
      question: "How do users compare WhatsApp UI to Telegram?",
      questionCategory: "UI / UX Design",
      promptTokens: 250,
      completionTokens: 760,
      totalTokens: 1010,
      estimatedCostUsd: 0.00025,
      statusCode: 200,
      latencyMs: 910,
      createdAt: "2026-10-28T17:25:00.000Z"
    },
    {
      id: "evt_1793208000000_014",
      userEmail: "priyanshubaghela67@gmail.com",
      sessionId: "ses_1793206651757_pri1",
      eventType: "gemini_ask",
      appId: "com.whatsapp",
      question: "Check top 1-star review complaints this week",
      questionCategory: "Sentiment & Overview",
      promptTokens: 260,
      completionTokens: 0,
      totalTokens: 260,
      estimatedCostUsd: 0.00002,
      statusCode: 503,
      errorMessage: "HTTP 503: Model experiencing high demand spike, failover cascade engaged",
      latencyMs: 140,
      createdAt: "2026-10-28T17:34:00.000Z"
    },
    {
      id: "evt_1793208000000_015",
      userEmail: "baghelapriyanshu67@gmail.com",
      sessionId: "ses_1793206651757_85my4",
      eventType: "gemini_ask",
      appId: "com.whatsapp",
      question: "What are the common crash complaints in WhatsApp?",
      questionCategory: "Bugs & Crashes",
      promptTokens: 180,
      completionTokens: 560,
      totalTokens: 740,
      estimatedCostUsd: 0.00018,
      statusCode: 200,
      latencyMs: 690,
      createdAt: "2026-10-28T17:10:00.000Z"
    },
    {
      id: "evt_1793208000000_016",
      userEmail: "baghelapriyanshu67@gmail.com",
      sessionId: "ses_1793206651757_85my4",
      eventType: "gemini_ask",
      appId: "com.whatsapp",
      question: "Are users satisfied with the dark mode contrast?",
      questionCategory: "UI / UX Design",
      promptTokens: 195,
      completionTokens: 530,
      totalTokens: 725,
      estimatedCostUsd: 0.00017,
      statusCode: 200,
      latencyMs: 680,
      createdAt: "2026-10-28T17:20:00.000Z"
    },
    {
      id: "evt_1793208000000_017",
      userEmail: "baghelapriyanshu67@gmail.com",
      sessionId: "ses_1793206651757_85my4",
      eventType: "gemini_ask",
      appId: "com.whatsapp",
      question: "Identify top feature requests from recent 4-star reviews",
      questionCategory: "Feature Requests",
      promptTokens: 230,
      completionTokens: 710,
      totalTokens: 940,
      estimatedCostUsd: 0.00023,
      statusCode: 200,
      latencyMs: 760,
      createdAt: "2026-10-28T17:32:00.000Z"
    },
    {
      id: "evt_1793208000000_018",
      userEmail: "baghelapriyanshu67@gmail.com",
      sessionId: "ses_1793206651757_85my4",
      eventType: "gemini_ask",
      appId: "com.whatsapp",
      question: "Check reports of notification sound failure",
      questionCategory: "Bugs & Crashes",
      promptTokens: 170,
      completionTokens: 490,
      totalTokens: 660,
      estimatedCostUsd: 0.00016,
      statusCode: 200,
      latencyMs: 620,
      createdAt: "2026-10-28T17:42:00.000Z"
    },
    {
      id: "evt_1793208000000_019",
      userEmail: "baghelapriyanshu67@gmail.com",
      sessionId: "ses_1793206651757_85my4",
      eventType: "gemini_ask",
      appId: "com.whatsapp",
      question: "Provide an executive summary of user satisfaction",
      questionCategory: "Sentiment & Overview",
      promptTokens: 240,
      completionTokens: 740,
      totalTokens: 980,
      estimatedCostUsd: 0.00024,
      statusCode: 200,
      latencyMs: 810,
      createdAt: "2026-10-28T17:51:00.000Z"
    },
    {
      id: "evt_1793208000000_020",
      userEmail: "baghelapriyanshu67@gmail.com",
      sessionId: "ses_1793206932998_insta",
      eventType: "gemini_ask",
      appId: "com.instagram.android",
      question: "What are the biggest complaints about Instagram reels algorithm?",
      questionCategory: "UI / UX Design",
      promptTokens: 210,
      completionTokens: 650,
      totalTokens: 860,
      estimatedCostUsd: 0.00021,
      statusCode: 200,
      latencyMs: 790,
      createdAt: "2026-10-28T18:05:00.000Z"
    },
    {
      id: "evt_1793208000000_021",
      userEmail: "baghelapriyanshu67@gmail.com",
      sessionId: "ses_1793206932998_insta",
      eventType: "gemini_ask",
      appId: "com.instagram.android",
      question: "User reaction to excessive sponsored ad frequency",
      questionCategory: "Monetization / Ads",
      promptTokens: 230,
      completionTokens: 710,
      totalTokens: 940,
      estimatedCostUsd: 0.00023,
      statusCode: 200,
      latencyMs: 840,
      createdAt: "2026-10-28T18:14:00.000Z"
    },
    {
      id: "evt_1793208000000_022",
      userEmail: "baghelapriyanshu67@gmail.com",
      sessionId: "ses_1793206932998_insta",
      eventType: "gemini_ask",
      appId: "com.instagram.android",
      question: "Are users reporting story camera freezes on Android?",
      questionCategory: "Bugs & Crashes",
      promptTokens: 185,
      completionTokens: 470,
      totalTokens: 655,
      estimatedCostUsd: 0.00015,
      statusCode: 200,
      latencyMs: 640,
      createdAt: "2026-10-28T18:22:00.000Z"
    }
  ];

  const now = Date.now();
  const reviews: ScrapedReviewRecord[] = [
    {
      reviewId: "rev_ig_001",
      appId: "com.instagram.android",
      userName: "Alex Johnson",
      score: 1,
      content: "There are more ads and sponsored posts than photos from my actual friends now.",
      at: new Date(now - 3600000).toISOString(),
      thumbsUp: 312,
      version: "318.0.0",
      sentiment: "Negative",
      detectedCategory: "Monetization / Ads",
      createdAt: new Date(now - 3600000).toISOString()
    },
    {
      reviewId: "rev_ig_002",
      appId: "com.instagram.android",
      userName: "Samantha Roy",
      score: 2,
      content: "Camera freezes whenever I try to apply any filter to my story.",
      at: new Date(now - 2 * 3600000).toISOString(),
      thumbsUp: 89,
      version: "318.0.0",
      sentiment: "Negative",
      detectedCategory: "Crash / Bug",
      createdAt: new Date(now - 2 * 3600000).toISOString()
    },
    {
      reviewId: "rev_ig_003",
      appId: "com.instagram.android",
      userName: "David M.",
      score: 5,
      content: "Direct messaging voice notes and close friends lists are super convenient.",
      at: new Date(now - 3 * 3600000).toISOString(),
      thumbsUp: 45,
      version: "318.0.0",
      sentiment: "Positive",
      detectedCategory: "General Experience",
      createdAt: new Date(now - 3 * 3600000).toISOString()
    },
    {
      reviewId: "rev_001",
      appId: "com.whatsapp",
      userName: "Michael B.",
      score: 1,
      content: "App crashes every time I try to open camera after the latest 2.24 update!",
      at: new Date(now - 2 * 3600000).toISOString(),
      thumbsUp: 142,
      version: "2.24.12",
      sentiment: "Negative",
      detectedCategory: "Crash / Bug",
      createdAt: new Date(now - 2 * 3600000).toISOString()
    },
    {
      reviewId: "rev_002",
      appId: "com.whatsapp",
      userName: "Aisha K.",
      score: 5,
      content: "Call quality has improved tremendously. Loving the HD photo feature.",
      at: new Date(now - 3 * 3600000).toISOString(),
      thumbsUp: 38,
      version: "2.24.12",
      sentiment: "Positive",
      detectedCategory: "General Experience",
      createdAt: new Date(now - 3 * 3600000).toISOString()
    },
    {
      reviewId: "rev_003",
      appId: "com.spotify.music",
      userName: "Julian T.",
      score: 2,
      content: "Shuffle is broken again, plays the exact same 15 songs repeatedly.",
      at: new Date(now - 5 * 3600000).toISOString(),
      thumbsUp: 89,
      version: "8.9.10",
      sentiment: "Negative",
      detectedCategory: "Crash / Bug",
      createdAt: new Date(now - 5 * 3600000).toISOString()
    },
    {
      reviewId: "rev_004",
      appId: "com.spotify.music",
      userName: "Claire D.",
      score: 5,
      content: "AI DJ feature is amazing and recommends songs I actually like.",
      at: new Date(now - 6 * 3600000).toISOString(),
      thumbsUp: 24,
      version: "8.9.10",
      sentiment: "Positive",
      detectedCategory: "General Experience",
      createdAt: new Date(now - 6 * 3600000).toISOString()
    }
  ];

  return { users, sessions, telemetry, reviews };
}
