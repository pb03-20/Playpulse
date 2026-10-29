"""
PlayPulse - Python Backend for Power BI Telemetry & Monitoring
==============================================================
This is the complete Python backend that serves real-time website monitoring
and analytics data to Microsoft Power BI.

Built with Python standard library (http.server, json, os, urllib) - NO pip dependencies needed!

Endpoints served:
  1. GET  /api/powerbi/kpis             -> 6 KPI cards across the top
  2. GET  /api/powerbi/activity         -> Line chart, Donut chart, Activity table
  3. GET  /api/powerbi/reviews-by-app   -> Bar chart (Reviews collected per app)
  4. GET  /api/powerbi/rag-performance  -> Column chart (RAG latency and token count)
  5. GET  /api/powerbi/monitoring       -> All 4 tables combined in one JSON
  6. GET  /api/powerbi/feed             -> Full dataset for Star Schema (Users, Sessions, Telemetry, Reviews)
  7. POST /api/powerbi/heartbeat        -> Receives live frontend lurker/reading telemetry

To run locally:
  python server.py
"""

import os
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from datetime import datetime

PORT = 5000
DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "telemetry_store.json")

# -----------------------------------------------------------------------------
# 1. DATA STORAGE LAYER
# -----------------------------------------------------------------------------

def load_data():
    """Reads telemetry_store.json. Returns empty dataset if missing."""
    if not os.path.exists(DATA_PATH):
        return {"users": [], "sessions": [], "telemetry": [], "reviews": []}
    try:
        with open(DATA_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"users": [], "sessions": [], "telemetry": [], "reviews": []}

def save_data(data):
    """Persists data to telemetry_store.json."""
    os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

# -----------------------------------------------------------------------------
# 2. METRICS & KPI CALCULATION LOGIC
# -----------------------------------------------------------------------------

def calculate_kpis(store):
    """
    Computes the 6 executive KPI cards:
      1. Total Test Accounts   - Distinct users created
      2. Total Apps Analyzed   - Distinct Google Play app IDs
      3. Reviews Collected     - Raw reviews harvested
      4. Completed Analyses    - Analyses that finished successfully
      5. RAG Questions         - Total AI questions submitted
      6. Analysis Success Rate - % of analysis jobs that completed
    """
    users = store.get("users", [])
    reviews = store.get("reviews", [])
    sessions = store.get("sessions", [])
    telemetry = store.get("telemetry", [])

    # Distinct user accounts from emails across users, sessions, and telemetry
    user_emails_set = set()
    for u in users:
        if u.get("email"): user_emails_set.add(u["email"].lower())
    for s in sessions:
        if s.get("userEmail"): user_emails_set.add(s["userEmail"].lower())
    for t in telemetry:
        if t.get("userEmail"): user_emails_set.add(t["userEmail"].lower())
    user_emails_set.discard("anonymous")
    user_emails_set.discard("none")
    user_emails_set.discard("researcher@playpulse.io")
    total_test_accounts = max(len(user_emails_set), len(users))

    # Distinct apps across all tables
    app_set = set()
    for r in reviews:
        if r.get("appId"): app_set.add(r["appId"])
    for s in sessions:
        if s.get("appResearched"): app_set.add(s["appResearched"])
    for t in telemetry:
        if t.get("appId"): app_set.add(t["appId"])

    # Analyses jobs (RAG Analysis + Review Scraping)
    rag_events = [t for t in telemetry if t.get("eventType") == "gemini_ask" or t.get("question")]
    scrape_events = [t for t in telemetry if t.get("eventType") == "scrape"]
    all_analysis_jobs = rag_events + scrape_events

    successful_jobs = [j for j in all_analysis_jobs if j.get("statusCode", 200) < 400]
    completed_analyses = len(successful_jobs)

    if len(all_analysis_jobs) > 0:
        success_rate = round((completed_analyses / len(all_analysis_jobs)) * 100, 1)
    else:
        success_rate = 100.0

    return [
        {
            "Total Test Accounts": total_test_accounts,
            "Total Apps Analyzed": len(app_set),
            "Total Reviews Collected": len(reviews),
            "Completed Analyses": completed_analyses,
            "RAG Questions": len(rag_events),
            "Analysis Success Rate": success_rate,
            "Metric": "Total Test Accounts",
            "Value": total_test_accounts,
            "Description": "Number of accounts created"
        },
        {
            "Total Test Accounts": total_test_accounts,
            "Total Apps Analyzed": len(app_set),
            "Total Reviews Collected": len(reviews),
            "Completed Analyses": completed_analyses,
            "RAG Questions": len(rag_events),
            "Analysis Success Rate": success_rate,
            "Metric": "Total Apps Analyzed",
            "Value": len(app_set),
            "Description": "Unique Google Play apps analyzed"
        },
        {
            "Total Test Accounts": total_test_accounts,
            "Total Apps Analyzed": len(app_set),
            "Total Reviews Collected": len(reviews),
            "Completed Analyses": completed_analyses,
            "RAG Questions": len(rag_events),
            "Analysis Success Rate": success_rate,
            "Metric": "Total Reviews Collected",
            "Value": len(reviews),
            "Description": "Unique reviews stored"
        },
        {
            "Total Test Accounts": total_test_accounts,
            "Total Apps Analyzed": len(app_set),
            "Total Reviews Collected": len(reviews),
            "Completed Analyses": completed_analyses,
            "RAG Questions": len(rag_events),
            "Analysis Success Rate": success_rate,
            "Metric": "Completed Analyses",
            "Value": completed_analyses,
            "Description": "Successfully completed analysis jobs"
        },
        {
            "Total Test Accounts": total_test_accounts,
            "Total Apps Analyzed": len(app_set),
            "Total Reviews Collected": len(reviews),
            "Completed Analyses": completed_analyses,
            "RAG Questions": len(rag_events),
            "Analysis Success Rate": success_rate,
            "Metric": "RAG Questions",
            "Value": len(rag_events),
            "Description": "Total questions submitted"
        },
        {
            "Total Test Accounts": total_test_accounts,
            "Total Apps Analyzed": len(app_set),
            "Total Reviews Collected": len(reviews),
            "Completed Analyses": completed_analyses,
            "RAG Questions": len(rag_events),
            "Analysis Success Rate": success_rate,
            "Metric": "Analysis Success Rate",
            "Value": success_rate,
            "Description": "Percentage of analysis jobs completed successfully"
        }
    ]

def get_system_activity(store):
    """
    Transforms telemetry events & sessions into a flat activity feed
    for the Power BI Activity Table and Line/Donut charts.
    """
    activity = []

    # 1. Telemetry events
    for t in store.get("telemetry", []):
        is_error = t.get("statusCode", 200) >= 400 or t.get("eventType") == "api_error"
        event_type = t.get("eventType", "")
        
        if event_type == "scrape":
            job_type = "Review Scraping"
        elif event_type == "session_heartbeat":
            job_type = "User Session"
        elif t.get("question"):
            job_type = "RAG Analysis"
        else:
            job_type = "API Error" if is_error else "RAG Analysis"

        created_at = t.get("createdAt", "")
        date_str = created_at.split("T")[0] if "T" in created_at else created_at[:10]
        latency = t.get("latencyMs", 0)
        app_id = t.get("appId") or "Unknown App"
        app_reviews_count = len([r for r in store.get("reviews", []) if r.get("appId") == app_id])

        activity.append({
            "id": t.get("id", ""),
            "timestamp": created_at,
            "date": date_str,
            "appName": app_id,
            "jobType": job_type,
            "status": "Failed" if is_error else "Completed",
            "duration": latency,
            "durationSeconds": round(latency / 1000.0, 2),
            "reviewsCollected": app_reviews_count if job_type == "Review Scraping" else 0,
            "tokens": t.get("totalTokens", 0),
            "errorMessage": t.get("errorMessage", "") if is_error else "",
            "userEmail": t.get("userEmail", "anonymous"),
            "accountType": "Test Account"
        })

    # 2. Session records
    for s in store.get("sessions", []):
        session_id = s.get("id", "")
        if not any(a["id"] == session_id for a in activity):
            started_at = s.get("startedAt", "")
            date_str = started_at.split("T")[0] if "T" in started_at else started_at[:10]
            duration_sec = s.get("durationSeconds", 0)
            app_id = s.get("appResearched") or "Unknown App"
            app_reviews_count = len([r for r in store.get("reviews", []) if r.get("appId") == app_id])

            activity.append({
                "id": session_id,
                "timestamp": started_at,
                "date": date_str,
                "appName": app_id,
                "jobType": "User Session",
                "status": "Completed",
                "duration": duration_sec * 1000,
                "durationSeconds": duration_sec,
                "reviewsCollected": app_reviews_count,
                "tokens": s.get("tokensConsumed", 0),
                "errorMessage": "",
                "userEmail": s.get("userEmail", "anonymous"),
                "accountType": "Test Account"
            })

    # Sort newest first
    activity.sort(key=lambda x: x["timestamp"], reverse=True)

    if not activity:
        now_iso = datetime.utcnow().isoformat() + "Z"
        today_date = datetime.utcnow().strftime("%Y-%m-%d")
        return [{
            "id": "none",
            "timestamp": now_iso,
            "date": today_date,
            "appName": "No Activity Yet",
            "jobType": "User Session",
            "status": "Completed",
            "duration": 0,
            "durationSeconds": 0,
            "reviewsCollected": 0,
            "tokens": 0,
            "errorMessage": "",
            "userEmail": "none",
            "accountType": "Test Account"
        }]

    return activity

def get_reviews_by_app(store):
    """
    Aggregates reviews by appName for the Clustered Bar Chart.
    Computes review count and average rating per app.
    """
    app_map = {}
    for r in store.get("reviews", []):
        app = r.get("appId", "Unknown App")
        if app not in app_map:
            app_map[app] = {"count": 0, "sumScore": 0}
        app_map[app]["count"] += 1
        app_map[app]["sumScore"] += r.get("score", 0)

    result = []
    for app, data in app_map.items():
        avg = round(data["sumScore"] / max(1, data["count"]), 2)
        result.append({
            "appName": app,
            "reviewsCollected": data["count"],
            "avgRating": avg
        })

    # Power BI schema preservation: Ensure columns are typed even when starting from 0
    if not result:
        return [
            {
                "appName": "No Reviews Yet",
                "reviewsCollected": 0,
                "avgRating": 0.0
            }
        ]
    return result

def get_rag_performance(store):
    """
    Extracts individual RAG query metrics for the Latency & Token Column Chart.
    """
    result = []
    for t in store.get("telemetry", []):
        if t.get("eventType") == "gemini_ask" or t.get("question"):
            created_at = t.get("createdAt", "")
            date_str = created_at.split("T")[0] if "T" in created_at else created_at[:10]
            result.append({
                "timestamp": created_at,
                "date": date_str,
                "appName": t.get("appId", "Unknown App"),
                "responseTimeMs": t.get("latencyMs", 0),
                "tokens": t.get("totalTokens", 0),
                "status": "Completed" if t.get("statusCode", 200) == 200 else "Failed",
                "userEmail": t.get("userEmail", "anonymous")
            })

    # Power BI schema preservation: Ensure columns are typed even when starting from 0
    if not result:
        now_iso = datetime.utcnow().isoformat() + "Z"
        today_date = datetime.utcnow().strftime("%Y-%m-%d")
        return [
            {
                "timestamp": now_iso,
                "date": today_date,
                "appName": "No Queries Yet",
                "responseTimeMs": 0,
                "tokens": 0,
                "status": "Completed",
                "userEmail": "none"
            }
        ]
    return result

# -----------------------------------------------------------------------------
# 3. HTTP REQUEST HANDLER (API ROUTER)
# -----------------------------------------------------------------------------

class PlayPulseHandler(BaseHTTPRequestHandler):

    def _set_cors_headers(self, content_type="application/json"):
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        store = load_data()

        # Route 1: 6 KPI Cards
        if path == "/api/powerbi/kpis":
            kpis = calculate_kpis(store)
            self._set_cors_headers()
            self.wfile.write(json.dumps(kpis, indent=2).encode("utf-8"))
            return

        # Route 2: Activity Table & Line/Donut charts
        if path == "/api/powerbi/activity":
            activity = get_system_activity(store)
            self._set_cors_headers()
            self.wfile.write(json.dumps(activity, indent=2).encode("utf-8"))
            return

        # Route 3: Reviews aggregated by app
        if path == "/api/powerbi/reviews-by-app":
            reviews_app = get_reviews_by_app(store)
            self._set_cors_headers()
            self.wfile.write(json.dumps(reviews_app, indent=2).encode("utf-8"))
            return

        # Route 4: RAG performance & latency
        if path == "/api/powerbi/rag-performance":
            rag = get_rag_performance(store)
            self._set_cors_headers()
            self.wfile.write(json.dumps(rag, indent=2).encode("utf-8"))
            return

        # Route 5: All 4 tables combined (Monitoring bundle)
        if path == "/api/powerbi/monitoring":
            bundle = {
                "kpis": {k["Metric"]: k["Value"] for k in calculate_kpis(store)},
                "kpisTable": calculate_kpis(store),
                "systemActivity": get_system_activity(store),
                "reviewsByApp": get_reviews_by_app(store),
                "ragPerformance": get_rag_performance(store)
            }
            self._set_cors_headers()
            self.wfile.write(json.dumps(bundle, indent=2).encode("utf-8"))
            return

        # Route 6: Star Schema Feed (used by generate_pbit.py)
        if path == "/api/powerbi/feed":
            self._set_cors_headers()
            self.wfile.write(json.dumps(store, indent=2).encode("utf-8"))
            return

        # Route 7: Reset all counters & telemetry back to 0
        if path == "/api/powerbi/reset":
            empty_store = {"users": [], "sessions": [], "telemetry": [], "reviews": []}
            save_data(empty_store)
            self._set_cors_headers()
            self.wfile.write(json.dumps({"ok": True, "message": "All telemetry counters reset to 0"}, indent=2).encode("utf-8"))
            return

        # Default 404
        self.send_response(404)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"error": "Endpoint not found"}).encode("utf-8"))

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        # Route: Heartbeat session ingestion
        if path == "/api/powerbi/heartbeat":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            try:
                payload = json.loads(body)
                store = load_data()
                
                session_id = payload.get("sessionId")
                user_email = payload.get("userEmail")
                duration = payload.get("durationSeconds", 0)
                app = payload.get("appResearched", "com.whatsapp")

                # Upsert user
                if user_email:
                    now = datetime.utcnow().isoformat() + "Z"
                    user = next((u for u in store["users"] if u.get("email") == user_email), None)
                    if not user:
                        store["users"].append({
                            "id": f"usr_{int(datetime.utcnow().timestamp())}",
                            "email": user_email,
                            "createdAt": now,
                            "lastActiveAt": now,
                            "totalSessions": 1,
                            "totalDurationSeconds": duration
                        })
                    else:
                        user["lastActiveAt"] = now

                # Upsert session
                if session_id and user_email:
                    now = datetime.utcnow().isoformat() + "Z"
                    session = next((s for s in store["sessions"] if s.get("id") == session_id), None)
                    if not session:
                        store["sessions"].append({
                            "id": session_id,
                            "userEmail": user_email,
                            "startedAt": now,
                            "lastPingAt": now,
                            "durationSeconds": duration,
                            "appResearched": app,
                            "questionsCount": 0
                        })
                    else:
                        session["durationSeconds"] = max(session.get("durationSeconds", 0), duration)
                        session["lastPingAt"] = now

                save_data(store)
                self._set_cors_headers()
                self.wfile.write(json.dumps({"ok": True}).encode("utf-8"))
                return
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
                return

        # Route: Reset all counters back to 0
        if path == "/api/powerbi/reset":
            empty_store = {"users": [], "sessions": [], "telemetry": [], "reviews": []}
            save_data(empty_store)
            self._set_cors_headers()
            self.wfile.write(json.dumps({"ok": True, "message": "All telemetry counters reset to 0"}).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()

# -----------------------------------------------------------------------------
# 4. ENTRY POINT
# -----------------------------------------------------------------------------

def run_server():
    server = HTTPServer(("0.0.0.0", PORT), PlayPulseHandler)
    print(f"=" * 60)
    print(f"  PlayPulse Python Server running at http://localhost:{PORT}")
    print(f"  Endpoints ready for Power BI:")
    print(f"    - http://localhost:{PORT}/api/powerbi/kpis")
    print(f"    - http://localhost:{PORT}/api/powerbi/activity")
    print(f"    - http://localhost:{PORT}/api/powerbi/reviews-by-app")
    print(f"    - http://localhost:{PORT}/api/powerbi/rag-performance")
    print(f"    - http://localhost:{PORT}/api/powerbi/monitoring")
    print(f"    - http://localhost:{PORT}/api/powerbi/feed")
    print(f"=" * 60)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Python server...")
        server.server_close()

if __name__ == "__main__":
    run_server()
