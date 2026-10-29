import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);

      // Handle Power BI Data Endpoints
      if (url.pathname.startsWith("/api/powerbi")) {
        const {
          getFullDataset,
          getMetricsTable,
          getMonitoringDashboardDataset,
          getTableCsv,
          recordSessionHeartbeat,
          resetTelemetryStore,
        } = await import("./lib/telemetry.store");

        const corsHeaders = {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        };

        if (request.method === "OPTIONS") {
          return new Response(null, { headers: corsHeaders });
        }

        // Frontend Heartbeat Endpoint
        if (url.pathname === "/api/powerbi/heartbeat" && request.method === "POST") {
          try {
            const body = (await request.json()) as {
              sessionId: string;
              userEmail: string;
              durationSeconds: number;
              appResearched?: string;
            };
            if (body.sessionId && body.userEmail) {
              const session = recordSessionHeartbeat(
                body.sessionId,
                body.userEmail,
                body.durationSeconds,
                body.appResearched,
              );
              return new Response(JSON.stringify({ ok: true, session }), {
                headers: { "Content-Type": "application/json", ...corsHeaders },
              });
            }
          } catch {
            return new Response(JSON.stringify({ ok: false }), { status: 400, headers: corsHeaders });
          }
        }

        const format = url.searchParams.get("format") || "json";

        // Dedicated Monitoring Endpoints
        if (url.pathname === "/api/powerbi/reset") {
          resetTelemetryStore();
          return new Response(JSON.stringify({ ok: true, message: "All telemetry counters reset to 0" }, null, 2), {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
              ...corsHeaders,
            },
          });
        }

        if (url.pathname === "/api/powerbi/monitoring") {
          const dataset = getMonitoringDashboardDataset();
          return new Response(JSON.stringify(dataset, null, 2), {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
              ...corsHeaders,
            },
          });
        }

        if (url.pathname === "/api/powerbi/activity") {
          const dataset = getMonitoringDashboardDataset();
          return new Response(JSON.stringify(dataset.systemActivity, null, 2), {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
              ...corsHeaders,
            },
          });
        }

        if (url.pathname === "/api/powerbi/kpis") {
          const dataset = getMonitoringDashboardDataset();
          return new Response(JSON.stringify(dataset.kpisTable, null, 2), {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
              ...corsHeaders,
            },
          });
        }

        if (url.pathname === "/api/powerbi/reviews-by-app") {
          const dataset = getMonitoringDashboardDataset();
          return new Response(JSON.stringify(dataset.reviewsByApp, null, 2), {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
              ...corsHeaders,
            },
          });
        }

        if (url.pathname === "/api/powerbi/rag-performance") {
          const dataset = getMonitoringDashboardDataset();
          return new Response(JSON.stringify(dataset.ragPerformance, null, 2), {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
              ...corsHeaders,
            },
          });
        }

        if (url.pathname === "/api/powerbi/feed") {
          const data = getFullDataset();
          return new Response(JSON.stringify(data, null, 2), {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
              ...corsHeaders,
            },
          });
        }

        if (url.pathname === "/api/powerbi/metrics") {
          const metrics = getMetricsTable();
          return new Response(JSON.stringify(metrics, null, 2), {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
              ...corsHeaders,
            },
          });
        }

        const table = url.pathname.replace("/api/powerbi/", "").toLowerCase();
        if (["users", "sessions", "telemetry", "reviews", "failures", "failureoccurrences", "metrics"].includes(table)) {
          if (table === "metrics") {
            const metrics = getMetricsTable();
            return new Response(JSON.stringify(metrics, null, 2), {
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store",
                ...corsHeaders,
              },
            });
          }
          const dataset = getFullDataset();
          const targetKey = table === "failures" || table === "failureoccurrences" ? "failureOccurrences" : table;
          if (format === "csv") {
            const csv = getTableCsv(targetKey as "users" | "sessions" | "telemetry" | "reviews");
            return new Response(csv, {
              headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="${table}.csv"`,
                ...corsHeaders,
              },
            });
          }
          return new Response(
            JSON.stringify((dataset as Record<string, unknown>)[targetKey], null, 2),
            {
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store",
                ...corsHeaders,
              },
            },
          );
        }
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};

