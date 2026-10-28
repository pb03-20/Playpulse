import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock,
  Coins,
  Download,
  Eye,
  Flame,
  Globe,
  HelpCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  User,
  Users,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "PlayPulse — Live User Research & Observability Command Center" },
      {
        name: "description",
        content:
          "Real-time monitoring of user emails, active time, lurking behavior, token consumption, and Google Play sentiment.",
      },
    ],
  }),
  component: Dashboard,
});

interface TelemetrySummary {
  totalUsers: number;
  totalSessions: number;
  totalTelemetryEvents: number;
  totalReviewsHarvested: number;
  totalTokensConsumed: number;
  estimatedCostUsd: number;
  totalErrorCount: number;
  quotaErrorsCount: number;
  lastRefreshedAt: string;
}

interface UserItem {
  id: string;
  email: string;
  createdAt: string;
  lastActiveAt: string;
  totalSessions: number;
  totalDurationSeconds: number;
}

interface SessionItem {
  id: string;
  userEmail: string;
  startedAt: string;
  durationSeconds: number;
  appResearched: string;
  questionsCount: number;
}

interface TelemetryItem {
  id: string;
  userEmail: string;
  eventType: string;
  appId: string;
  question?: string;
  questionCategory?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  statusCode: number;
  errorMessage?: string;
  latencyMs: number;
  createdAt: string;
}

interface FullFeedData {
  summary: TelemetrySummary;
  users: UserItem[];
  sessions: SessionItem[];
  telemetry: TelemetryItem[];
}

const COLORS = ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];

function Dashboard() {
  const [data, setData] = useState<FullFeedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/powerbi/feed");
      if (res.ok) {
        const json = (await res.json()) as FullFeedData;
        setData(json);
      }
    } catch (e) {
      console.error("Failed to load telemetry feed", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto refresh every 20 seconds for live monitoring
    const interval = setInterval(fetchData, 20000);
    return () => clearInterval(interval);
  }, []);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading PlayPulse Live Monitor...</p>
        </div>
      </div>
    );
  }

  // Calculate lurking vs active research
  // If questionsCount == 0: Lurking / Reading reviews
  const lurkingSessions = data.sessions.filter((s) => s.questionsCount === 0).length;
  const casualSessions = data.sessions.filter(
    (s) => s.questionsCount > 0 && s.questionsCount <= 2,
  ).length;
  const deepSessions = data.sessions.filter((s) => s.questionsCount > 2).length;

  const engagementChartData = [
    { name: "Lurking (Reading Only)", value: lurkingSessions || 1, color: "#06b6d4" },
    { name: "Casual Explorer", value: casualSessions || 1, color: "#8b5cf6" },
    { name: "Deep AI Researcher", value: deepSessions || 1, color: "#10b981" },
  ];

  // Token consumption per user
  const userTokenMap = new Map<string, number>();
  for (const t of data.telemetry) {
    userTokenMap.set(t.userEmail, (userTokenMap.get(t.userEmail) ?? 0) + t.totalTokens);
  }
  const tokenChartData = Array.from(userTokenMap.entries())
    .map(([email, tokens]) => ({
      email: email.split("@")[0] ?? email,
      tokens,
    }))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 5);

  // Filtered users
  const filteredUsers = data.users.filter((u) =>
    u.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      {/* Top Navigation */}
      <header className="mx-auto mb-8 flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="glass-panel flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:text-foreground"
            title="Back to PlayPulse Research"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500"></span>
              </span>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                <span className="text-gradient">Live Telemetry & User Research Command Center</span>
              </h1>
            </div>
            <p className="text-xs text-muted-foreground">
              Live tracking of authentic Google users, lurking vs prompting time, token burn & Power
              BI sync
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-glass-border bg-glass px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-white/10"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <a
            href="/api/powerbi/feed"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <Globe className="size-3.5" />
            <span>Power BI Endpoint</span>
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6">
        {/* KPI Cards Ribbon */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="glass-panel p-4">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-medium">Verified Users</span>
              <Users className="size-4 text-primary" />
            </div>
            <div className="text-2xl font-bold tracking-tight">{data.summary.totalUsers}</div>
            <span className="text-[11px] text-muted-foreground">Google authenticated</span>
          </div>

          <div className="glass-panel p-4">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-medium">Total Active Time</span>
              <Clock className="size-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold tracking-tight">
              {(
                data.users.reduce((acc, u) => acc + u.totalDurationSeconds, 0) / 60
              ).toFixed(1)}
              <span className="text-sm font-normal text-muted-foreground ml-1">m</span>
            </div>
            <span className="text-[11px] text-muted-foreground">Across all sessions</span>
          </div>

          <div className="glass-panel p-4">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-medium">Lurking Ratio</span>
              <Eye className="size-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold tracking-tight">
              {data.sessions.length > 0
                ? Math.round((lurkingSessions / data.sessions.length) * 100)
                : 0}
              %
            </div>
            <span className="text-[11px] text-muted-foreground">Reading without ask</span>
          </div>

          <div className="glass-panel p-4">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-medium">Tokens Burned</span>
              <Flame className="size-4 text-orange-400" />
            </div>
            <div className="text-2xl font-bold tracking-tight">
              {data.summary.totalTokensConsumed.toLocaleString()}
            </div>
            <span className="text-[11px] text-muted-foreground">Gemini 3.6 Flash</span>
          </div>

          <div className="glass-panel p-4">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-medium">Est. AI Cost</span>
              <Coins className="size-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold tracking-tight">
              ${data.summary.estimatedCostUsd.toFixed(4)}
            </div>
            <span className="text-[11px] text-muted-foreground">Prompt + Completion</span>
          </div>

          <div className="glass-panel p-4">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-medium">Friction Alerts</span>
              <AlertTriangle className="size-4 text-destructive" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-destructive">
              {data.summary.quotaErrorsCount}
            </div>
            <span className="text-[11px] text-muted-foreground">429 / 402 Errors</span>
          </div>
        </section>

        {/* Charts Row */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* User Lurking vs Prompting Behavior */}
          <div className="glass-panel p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  User Engagement & Lurking Classification
                </h3>
                <p className="text-xs text-muted-foreground">
                  Lurkers (reading reviews only) vs Explorers vs Deep AI Prompters
                </p>
              </div>
              <Activity className="size-4 text-primary" />
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={engagementChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {engagementChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "oklch(0.19 0.025 285)",
                      borderColor: "oklch(1 0 0 / 9%)",
                      borderRadius: "12px",
                      color: "#fff",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs">
              {engagementChartData.map((item) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-muted-foreground">{item.name}:</span>
                  <span className="font-semibold text-foreground">{item.value} sessions</span>
                </div>
              ))}
            </div>
          </div>

          {/* Token Burn by User */}
          <div className="glass-panel p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Token Consumption by User
                </h3>
                <p className="text-xs text-muted-foreground">
                  Top power-users consuming your Gemini API quota
                </p>
              </div>
              <BarChart3 className="size-4 text-cyan-400" />
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tokenChartData} layout="vertical">
                  <XAxis type="number" stroke="#888" fontSize={11} />
                  <YAxis dataKey="email" type="category" stroke="#888" fontSize={11} width={80} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "oklch(0.19 0.025 285)",
                      borderColor: "oklch(1 0 0 / 9%)",
                      borderRadius: "12px",
                      color: "#fff",
                    }}
                  />
                  <Bar dataKey="tokens" fill="#8b5cf6" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Master Per-User Research Audit Table */}
        <section className="glass-panel p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Per-User Audit & Research Log
              </h3>
              <p className="text-xs text-muted-foreground">
                Complete profile of each authentic user: time lurking, prompts asked & tokens
                consumed
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-glass-border bg-glass px-3 py-1.5 sm:w-64">
              <Search className="size-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search user email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-glass-border text-muted-foreground">
                  <th className="pb-3 font-medium">User Email</th>
                  <th className="pb-3 font-medium">Active Minutes</th>
                  <th className="pb-3 font-medium">Total Sessions</th>
                  <th className="pb-3 font-medium">Tokens Burned</th>
                  <th className="pb-3 font-medium">Est. Cost</th>
                  <th className="pb-3 font-medium">Questions Asked</th>
                  <th className="pb-3 font-medium">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-border">
                {filteredUsers.map((user) => {
                  const userTokens = userTokenMap.get(user.email) ?? 0;
                  const userSessions = data.sessions.filter(
                    (s) => s.userEmail.toLowerCase() === user.email.toLowerCase(),
                  );
                  const questionsAsked = userSessions.reduce(
                    (acc, s) => acc + (s.questionsCount || 0),
                    0,
                  );
                  const cost = ((userTokens / 1000000) * 0.15).toFixed(4);

                  return (
                    <tr key={user.id} className="transition-colors hover:bg-white/5">
                      <td className="py-3 font-medium text-foreground flex items-center gap-2">
                        <div className="flex size-6 items-center justify-center rounded-full bg-primary/20 text-primary text-[10px]">
                          {user.email.charAt(0).toUpperCase()}
                        </div>
                        <span>{user.email}</span>
                      </td>
                      <td className="py-3 text-cyan-400">
                        {(user.totalDurationSeconds / 60).toFixed(1)}m
                      </td>
                      <td className="py-3">{user.totalSessions}</td>
                      <td className="py-3 font-semibold text-purple-400">
                        {userTokens.toLocaleString()}
                      </td>
                      <td className="py-3 text-emerald-400">${cost}</td>
                      <td className="py-3">
                        <span className="rounded-full bg-white/5 px-2 py-0.5">
                          {questionsAsked} prompts
                        </span>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {new Date(user.lastActiveAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Recent User Questions & Error Friction Feed */}
        <section className="glass-panel p-5">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-foreground">
              Live Research Stream & Friction Events
            </h3>
            <p className="text-xs text-muted-foreground">
              Real-time questions asked by users and API friction events (429 rate limits, 402
              exhausted)
            </p>
          </div>

          <div className="space-y-3">
            {data.telemetry
              .filter((t) => t.eventType === "gemini_ask" || t.eventType === "api_error")
              .slice(0, 6)
              .map((event) => (
                <div
                  key={event.id}
                  className="flex flex-col gap-2 rounded-xl border border-glass-border bg-glass p-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground text-xs">
                        {event.userEmail}
                      </span>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                        {event.appId}
                      </span>
                      {event.questionCategory && (
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-muted-foreground">
                          {event.questionCategory}
                        </span>
                      )}
                      {event.statusCode >= 400 ? (
                        <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400">
                          Status {event.statusCode}: {event.errorMessage || "Error"}
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">
                          200 OK ({event.latencyMs}ms)
                        </span>
                      )}
                    </div>
                    {event.question && (
                      <p className="text-xs text-muted-foreground italic">
                        "{event.question}"
                      </p>
                    )}
                  </div>

                  <div className="text-right text-xs shrink-0">
                    <div className="font-semibold text-purple-400">
                      {event.totalTokens.toLocaleString()} tokens
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(event.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}
