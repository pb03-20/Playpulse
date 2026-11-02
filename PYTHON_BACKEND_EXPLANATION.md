# 🐍 PlayPulse Python Backend & Power BI Architecture

> **A Complete Guide to Explaining the Python Backend & Metrics Logic**

---

## 1. Where the Python Files Are Located

| File | Path | What It Does |
| :--- | :--- | :--- |
| **`server.py`** | [server.py](file:///d:/documents/new2/new2/server.py) | **The standalone Python backend server**. Implements all 6 KPI calculations, activity filtering, review aggregations, and RAG telemetry feeds. |
| **`api/powerbi.py`** | [api/powerbi.py](file:///d:/documents/new2/new2/api/powerbi.py) | **Vercel Serverless Python handler**. Runs on Vercel's Python 3.12 runtime in the cloud. |
| **`analyzer.py`** | [analyzer.py](file:///d:/documents/new2/new2/analyzer.py) | Google Play Store scraper + Gemini prompt analysis engine. |
| **`generate_pbit.py`**| [generate_pbit.py](file:///d:/documents/new2/new2/generate_pbit.py) | Power BI template builder that packs M queries, DAX formulas, and schema relationships into `.pbit`. |

---

## 2. How to Run Locally

To run your Python backend server on your machine:

```powershell
python server.py
```

It starts a local web server at `http://localhost:5000` with full CORS enabled.

---

## 3. The 4 Endpoints for Power BI

Power BI Desktop connects to these live URLs (or `http://localhost:5000` locally):

| Visual in Power BI | Endpoint URL | Python Function |
| :--- | :--- | :--- |
| **6 KPI Cards** | `/api/powerbi/kpis` | `calculate_kpis(store)` |
| **Line Chart, Donut, Table** | `/api/powerbi/activity` | `get_system_activity(store)` |
| **Bar Chart (Reviews by App)** | `/api/powerbi/reviews-by-app` | `get_reviews_by_app(store)` |
| **Column Chart (RAG Latency)** | `/api/powerbi/rag-performance` | `get_rag_performance(store)` |

---

## 4. How the Metrics Logic Works in Python (Interview Cheat Sheet)

### A. 6 KPI Cards (`calculate_kpis` in `server.py`)
1. **Total Test Accounts**: `len(store["users"])` — Counts registered user objects.
2. **Total Apps Analyzed**: `len(app_set)` — Finds unique `appId` across reviews, sessions, and telemetry.
3. **Total Reviews Collected**: `len(store["reviews"])` — Counts collected review records.
4. **Completed Analyses**: Count of telemetry jobs where `statusCode < 400` (success).
5. **RAG Questions**: Total records where `eventType == "gemini_ask"`.
6. **Analysis Success Rate**: `(completed_analyses / total_jobs) * 100` (e.g., `100.0%`).

### B. Activity Feed (`get_system_activity` in `server.py`)
Combines raw events and active sessions into a flat log:
- Categorizes jobs: `"Review Scraping"`, `"RAG Analysis"`, or `"User Session"`.
- Converts latency from milliseconds to seconds: `latencyMs / 1000.0`.
- Flags status: `"Completed"` if status code < 400, else `"Failed"` with `errorMessage`.
- Sorts newest first: `activity.sort(key=lambda x: x["timestamp"], reverse=True)`.

### C. Reviews by App (`get_reviews_by_app` in `server.py`)
Uses a Python dictionary hashmap to group reviews:
- Sums review scores and counts per `appId`.
- Calculates average rating: `round(sumScore / count, 2)`.

### D. RAG Performance (`get_rag_performance` in `server.py`)
Extracts Gemini AI performance numbers:
- `responseTimeMs` (API response latency).
- `tokens` (Total input prompt + output completion tokens burned).
- `status` (`"Completed"` or `"Failed"`).
