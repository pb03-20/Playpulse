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

export interface SystemActivityRecord {
  id: string;
  timestamp: string;
  date: string;
  appName: string;
  jobType: "RAG Analysis" | "Review Scraping" | "User Session" | "API Error";
  status: "Completed" | "Failed" | "Running";
  duration: number; // in milliseconds
  durationSeconds: number;
  reviewsCollected: number;
  tokens: number;
  errorMessage: string;
  userEmail: string;
  accountType: string;
}

export interface ReviewByAppRecord {
  appName: string;
  reviewsCollected: number;
  avgRating: number;
}

export interface RagPerformanceRecord {
  timestamp: string;
  date: string;
  appName: string;
  responseTimeMs: number;
  tokens: number;
  status: "Completed" | "Failed";
  userEmail: string;
}

export function getMonitoringDashboardDataset() {
  const store = loadStore();

  const appSet = new Set<string>();
  store.reviews.forEach((r) => r.appId && appSet.add(r.appId));
  store.sessions.forEach((s) => s.appResearched && appSet.add(s.appResearched));
  store.telemetry.forEach((t) => t.appId && appSet.add(t.appId));
  const uniqueApps = Array.from(appSet);

  const systemActivity: SystemActivityRecord[] = [];

  for (const t of store.telemetry) {
    const isError = t.statusCode >= 400 || t.eventType === "api_error";
    let jobType: "RAG Analysis" | "Review Scraping" | "User Session" | "API Error" = "RAG Analysis";
    if (t.eventType === "scrape") jobType = "Review Scraping";
    else if (t.eventType === "session_heartbeat") jobType = "User Session";
    else if (t.eventType === "api_error") jobType = t.question ? "RAG Analysis" : "API Error";

    const appId = t.appId || "Unknown App";
    const appReviewsCount = store.reviews.filter((r) => r.appId === appId).length;

    systemActivity.push({
      id: t.id,
      timestamp: t.createdAt,
      date: t.createdAt ? t.createdAt.split("T")[0]! : "",
      appName: appId,
      jobType,
      status: isError ? "Failed" : "Completed",
      duration: t.latencyMs || 0,
      durationSeconds: Number(((t.latencyMs || 0) / 1000).toFixed(2)),
      reviewsCollected: jobType === "Review Scraping" ? appReviewsCount : 0,
      tokens: t.totalTokens || 0,
      errorMessage: isError ? (t.errorMessage || `HTTP ${t.statusCode}`) : "",
      userEmail: t.userEmail || "anonymous",
      accountType: "Test Account",
    });
  }

  for (const s of store.sessions) {
    const exists = systemActivity.some((a) => a.id === s.id);
    if (!exists) {
      const appId = s.appResearched || "Unknown App";
      const appReviewsCount = store.reviews.filter((r) => r.appId === appId).length;

      systemActivity.push({
        id: s.id,
        timestamp: s.startedAt,
        date: s.startedAt ? s.startedAt.split("T")[0]! : "",
        appName: appId,
        jobType: "User Session",
        status: "Completed",
        duration: (s.durationSeconds || 0) * 1000,
        durationSeconds: s.durationSeconds || 0,
        reviewsCollected: appReviewsCount,
        tokens: s.tokensConsumed || 0,
        errorMessage: "",
        userEmail: s.userEmail || "anonymous",
        accountType: "Test Account",
      });
    }
  }

  systemActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const nowIso = new Date().toISOString();
  const todayStr = nowIso.split("T")[0]!;

  const safeActivity: SystemActivityRecord[] = systemActivity.length > 0 ? systemActivity : [
    {
      id: "none",
      timestamp: nowIso,
      date: todayStr,
      appName: "No Activity Yet",
      jobType: "User Session",
      status: "Completed",
      duration: 0,
      durationSeconds: 0,
      reviewsCollected: 0,
      tokens: 0,
      errorMessage: "",
      userEmail: "none",
      accountType: "Test Account",
    },
  ];

  const reviewAppMap = new Map<string, { count: number; sumScore: number }>();
  for (const r of store.reviews) {
    const app = r.appId || "Unknown App";
    if (!reviewAppMap.has(app)) {
      reviewAppMap.set(app, { count: 0, sumScore: 0 });
    }
    const item = reviewAppMap.get(app)!;
    item.count++;
    item.sumScore += r.score || 0;
  }
  const reviewsByApp: ReviewByAppRecord[] = Array.from(reviewAppMap.entries()).map(([appName, item]) => ({
    appName,
    reviewsCollected: item.count,
    avgRating: Number((item.sumScore / Math.max(1, item.count)).toFixed(2)),
  }));

  const ragQueries = store.telemetry.filter((t) => t.eventType === "gemini_ask" || t.question);
  const ragPerformance: RagPerformanceRecord[] = ragQueries.map((t) => ({
    timestamp: t.createdAt,
    date: t.createdAt ? t.createdAt.split("T")[0]! : "",
    appName: t.appId || "Unknown App",
    responseTimeMs: t.latencyMs || 0,
    tokens: t.totalTokens || 0,
    status: t.statusCode === 200 ? "Completed" : "Failed",
    userEmail: t.userEmail || "anonymous",
  }));

  const analysisJobs = systemActivity.filter((a) => a.jobType === "RAG Analysis" || a.jobType === "Review Scraping");
  const completedAnalysesCount = analysisJobs.filter((a) => a.status === "Completed").length;
  const ragQuestionsCount = ragQueries.length;
  const analysisSuccessRate = analysisJobs.length > 0
    ? Number(((completedAnalysesCount / analysisJobs.length) * 100).toFixed(1))
    : 100.0;

  const kpis = {
    totalTestAccounts: store.users.length,
    totalAppsAnalyzed: uniqueApps.length,
    totalReviewsCollected: store.reviews.length,
    completedAnalyses: completedAnalysesCount,
    ragQuestions: ragQuestionsCount,
    analysisSuccessRate,
  };

  const kpisTable = [
    {
      "Total Test Accounts": kpis.totalTestAccounts,
      "Total Apps Analyzed": kpis.totalAppsAnalyzed,
      "Total Reviews Collected": kpis.totalReviewsCollected,
      "Completed Analyses": kpis.completedAnalyses,
      "RAG Questions": kpis.ragQuestions,
      "Analysis Success Rate": kpis.analysisSuccessRate,
      Metric: "Total Test Accounts",
      Value: kpis.totalTestAccounts,
      Description: "Number of accounts created",
    },
    {
      "Total Test Accounts": kpis.totalTestAccounts,
      "Total Apps Analyzed": kpis.totalAppsAnalyzed,
      "Total Reviews Collected": kpis.totalReviewsCollected,
      "Completed Analyses": kpis.completedAnalyses,
      "RAG Questions": kpis.ragQuestions,
      "Analysis Success Rate": kpis.analysisSuccessRate,
      Metric: "Total Apps Analyzed",
      Value: kpis.totalAppsAnalyzed,
      Description: "Unique Google Play apps analyzed",
    },
    {
      "Total Test Accounts": kpis.totalTestAccounts,
      "Total Apps Analyzed": kpis.totalAppsAnalyzed,
      "Total Reviews Collected": kpis.totalReviewsCollected,
      "Completed Analyses": kpis.completedAnalyses,
      "RAG Questions": kpis.ragQuestions,
      "Analysis Success Rate": kpis.analysisSuccessRate,
      Metric: "Total Reviews Collected",
      Value: kpis.totalReviewsCollected,
      Description: "Unique reviews stored",
    },
    {
      "Total Test Accounts": kpis.totalTestAccounts,
      "Total Apps Analyzed": kpis.totalAppsAnalyzed,
      "Total Reviews Collected": kpis.totalReviewsCollected,
      "Completed Analyses": kpis.completedAnalyses,
      "RAG Questions": kpis.ragQuestions,
      "Analysis Success Rate": kpis.analysisSuccessRate,
      Metric: "Completed Analyses",
      Value: kpis.completedAnalyses,
      Description: "Successfully completed analysis jobs",
    },
    {
      "Total Test Accounts": kpis.totalTestAccounts,
      "Total Apps Analyzed": kpis.totalAppsAnalyzed,
      "Total Reviews Collected": kpis.totalReviewsCollected,
      "Completed Analyses": kpis.completedAnalyses,
      "RAG Questions": kpis.ragQuestions,
      "Analysis Success Rate": kpis.analysisSuccessRate,
      Metric: "RAG Questions",
      Value: kpis.ragQuestions,
      Description: "Total questions submitted",
    },
    {
      "Total Test Accounts": kpis.totalTestAccounts,
      "Total Apps Analyzed": kpis.totalAppsAnalyzed,
      "Total Reviews Collected": kpis.totalReviewsCollected,
      "Completed Analyses": kpis.completedAnalyses,
      "RAG Questions": kpis.ragQuestions,
      "Analysis Success Rate": kpis.analysisSuccessRate,
      Metric: "Analysis Success Rate",
      Value: kpis.analysisSuccessRate,
      Description: "Percentage of analysis jobs completed successfully",
    },
  ];

  const safeReviewsByApp: ReviewByAppRecord[] = reviewsByApp.length > 0 ? reviewsByApp : [
    {
      appName: "No Reviews Yet",
      reviewsCollected: 0,
      avgRating: 0.0,
    },
  ];

  const safeRagPerformance: RagPerformanceRecord[] = ragPerformance.length > 0 ? ragPerformance : [
    {
      timestamp: nowIso,
      date: todayStr,
      appName: "No Queries Yet",
      responseTimeMs: 0,
      tokens: 0,
      status: "Completed",
      userEmail: "none",
    },
  ];

  return {
    kpis,
    kpisTable,
    systemActivity: safeActivity,
    reviewsByApp: safeReviewsByApp,
    ragPerformance: safeRagPerformance,
  };
}

export function resetTelemetryStore(): TelemetryStore {
  const empty: TelemetryStore = {
    users: [],
    sessions: [],
    telemetry: [],
    reviews: [],
  };
  saveStore(empty);
  return empty;
}

function generateSeedData(): TelemetryStore {
  return {
    users: [],
    sessions: [],
    telemetry: [],
    reviews: [],
  };
}
