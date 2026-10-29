# 📊 PlayPulse — Complete Power BI Dashboard Guide

> **One dashboard. Real data. No synthetic filler.**
> Everything below maps to live production API endpoints returning 100% authentic data from your deployed PlayPulse website at `https://new2-liard.vercel.app`.

---

## Part 1 — Data Sources (What to Load in Power BI)

You need exactly **4 tables**. Each is a live JSON endpoint.

| # | Table Name | Power BI URL (Get Data → Web) | Purpose |
|---|-----------|-------------------------------|---------|
| 1 | `activity` | `https://new2-liard.vercel.app/api/powerbi/activity` | Every telemetry event + session (line chart, donut, activity table) |
| 2 | `kpis` | `https://new2-liard.vercel.app/api/powerbi/kpis` | 6 KPI card values |
| 3 | `reviews_by_app` | `https://new2-liard.vercel.app/api/powerbi/reviews-by-app` | Reviews aggregated per app (bar chart) |
| 4 | `rag_performance` | `https://new2-liard.vercel.app/api/powerbi/rag-performance` | Individual RAG query latency + tokens (column chart) |

### How to Load Each Table

For each table above:
1. Power BI → **Home** → **Get Data** → **Web**
2. Paste the URL from column 3
3. Power Query opens → it auto-detects JSON → click **To Table** → expand all columns
4. Rename the query to the Table Name from column 2
5. Click **Close & Apply**

Repeat 4 times. Done.

---

## Part 2 — Complete Field Reference (Every Column in Every Table)

### Table 1: `activity`

| Column | Type | Example | What it means |
|--------|------|---------|---------------|
| `id` | Text | `evt_1730100000000_abc12` | Unique event/session ID |
| `timestamp` | DateTime | `2026-10-28T18:30:00.000Z` | When it happened (ISO 8601) |
| `date` | Date | `2026-10-28` | Date only (for grouping on X-axis) |
| `appName` | Text | `com.whatsapp` | Google Play app being analyzed |
| `jobType` | Text | `RAG Analysis` / `Review Scraping` / `User Session` / `API Error` | What type of work was done |
| `status` | Text | `Completed` / `Failed` / `Running` | Did it succeed? |
| `duration` | Number | `3200` | Duration in **milliseconds** |
| `durationSeconds` | Decimal | `3.20` | Duration in **seconds** |
| `errorMessage` | Text | `HTTP 429` or empty | Error details (blank if success) |
| `userEmail` | Text | `user@gmail.com` | Who triggered it |
| `accountType` | Text | `Test Account` | Account classification |

**Total: 11 columns**

---

### Table 2: `kpis`

| Column | Type | Example | What it means |
|--------|------|---------|---------------|
| `Metric` | Text | `Total Test Accounts` | Name of the KPI |
| `Value` | Number | `1` | Current value |
| `Description` | Text | `Number of accounts created` | Human-readable explanation |

**Total: 3 columns** — Contains exactly 6 rows (one per KPI card):

| Row | Metric | What it measures |
|-----|--------|------------------|
| 1 | Total Test Accounts | Unique Google-authenticated users registered |
| 2 | Total Apps Analyzed | Unique Google Play app IDs researched |
| 3 | Total Reviews Collected | Raw reviews scraped and stored |
| 4 | Completed Analyses | RAG + scrape jobs that finished successfully |
| 5 | RAG Questions | Total AI questions submitted to Gemini |
| 6 | Analysis Success Rate | % of analysis jobs completed (not failed) |

---

### Table 3: `reviews_by_app`

| Column | Type | Example | What it means |
|--------|------|---------|---------------|
| `appName` | Text | `com.whatsapp` | Google Play app package name |
| `reviewsCollected` | Number | `150` | How many reviews scraped for this app |
| `avgRating` | Decimal | `3.72` | Average star rating across all reviews |

**Total: 3 columns** — One row per unique app analyzed.

---

### Table 4: `rag_performance`

| Column | Type | Example | What it means |
|--------|------|---------|---------------|
| `timestamp` | DateTime | `2026-10-28T18:30:00.000Z` | When the RAG query was executed |
| `date` | Date | `2026-10-28` | Date only (for time-axis grouping) |
| `appName` | Text | `com.whatsapp` | Which app the question was about |
| `responseTimeMs` | Number | `2800` | How long Gemini took to respond (ms) |
| `tokens` | Number | `1450` | Total tokens consumed (prompt + completion) |
| `status` | Text | `Completed` / `Failed` | Did the RAG query succeed? |
| `userEmail` | Text | `user@gmail.com` | Who asked the question |

**Total: 7 columns** — One row per RAG question submitted.

---

## Part 3 — Dashboard Layout (Single Page)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        FILTERS (Top Ribbon)                            │
│   [Date Range Slicer]    [App Name Dropdown]    [Status Dropdown]      │
├───────────┬───────────┬───────────┬───────────┬───────────┬────────────┤
│  KPI 1    │  KPI 2    │  KPI 3    │  KPI 4    │  KPI 5    │  KPI 6    │
│  Test     │  Apps     │  Reviews  │  Completed│  RAG      │  Success  │
│  Accounts │  Analyzed │  Collected│  Analyses │  Questions│  Rate %   │
├─────────────────────────────────┬───────────────────────────────────────┤
│   LINE CHART                    │   BAR CHART                          │
│   Activity Over Time            │   Reviews by App                     │
│   X: date  Y: Count of id      │   Y: appName  X: reviewsCollected    │
│   Source: activity              │   Source: reviews_by_app             │
├─────────────────────────────────┬───────────────────────────────────────┤
│   DONUT CHART                   │   COLUMN CHART                       │
│   Analysis Status               │   RAG Latency Over Time              │
│   Legend: status                │   X: date  Y: Avg of responseTimeMs  │
│   Values: Count of id           │   Source: rag_performance             │
│   Source: activity              │                                       │
├─────────────────────────────────────────────────────────────────────────┤
│   ACTIVITY TABLE (Full Width)                                          │
│   Columns: timestamp, appName, jobType, status, durationSeconds,       │
│            userEmail, errorMessage                                      │
│   Source: activity  |  Sort: timestamp descending                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Part 4 — Building Each Visual (Step-by-Step)

### 4.1 — KPI Cards (Top Row)

You need **6 Card visuals** across the top.

For each card:
1. Add a **Card** visual
2. Set the **Field** to: `kpis` table → `Value`
3. Add a **Visual-level filter** on `kpis[Metric]` = the specific metric name

| Card | Filter: Metric = | Display Format |
|------|-------------------|----------------|
| Card 1 | `Total Test Accounts` | Whole number |
| Card 2 | `Total Apps Analyzed` | Whole number |
| Card 3 | `Total Reviews Collected` | Whole number |
| Card 4 | `Completed Analyses` | Whole number |
| Card 5 | `RAG Questions` | Whole number |
| Card 6 | `Analysis Success Rate` | Decimal + `%` suffix |

**Pro tip:** Add the `Description` field as a subtitle/tooltip so viewers know what each card means.

---

### 4.2 — Line Chart: Activity Over Time

| Setting | Value |
|---------|-------|
| **Visual type** | Line chart |
| **X-axis** | `activity[date]` |
| **Y-axis** | Count of `activity[id]` |
| **Legend** (optional) | `activity[jobType]` (separate lines per job type) |
| **Title** | "Activity Over Time" |

This shows how many analyses/sessions/scrapes happened each day.

---

### 4.3 — Bar Chart: Reviews by App

| Setting | Value |
|---------|-------|
| **Visual type** | Clustered bar chart |
| **Y-axis** | `reviews_by_app[appName]` |
| **X-axis** | Sum of `reviews_by_app[reviewsCollected]` |
| **Tooltips** | `reviews_by_app[avgRating]` |
| **Data colors** | Use conditional formatting on `avgRating` (red < 3, yellow 3-4, green > 4) |
| **Title** | "Reviews Collected by App" |

---

### 4.4 — Donut Chart: Analysis Status Breakdown

| Setting | Value |
|---------|-------|
| **Visual type** | Donut chart |
| **Legend** | `activity[status]` (Completed / Failed / Running) |
| **Values** | Count of `activity[id]` |
| **Colors** | Green = Completed, Red = Failed, Yellow = Running |
| **Title** | "Analysis Status Distribution" |

**Add a filter:** `activity[jobType]` is in `[RAG Analysis, Review Scraping]` — exclude "User Session" so this only shows actual analysis work.

---

### 4.5 — Column Chart: RAG Latency Over Time

| Setting | Value |
|---------|-------|
| **Visual type** | Clustered column chart |
| **X-axis** | `rag_performance[date]` |
| **Y-axis** | Average of `rag_performance[responseTimeMs]` |
| **Secondary Y** (optional) | Sum of `rag_performance[tokens]` |
| **Title** | "RAG Query Latency & Token Consumption" |

---

### 4.6 — Activity Table (Bottom)

| Setting | Value |
|---------|-------|
| **Visual type** | Table |
| **Columns** (in order) | `activity[timestamp]`, `activity[appName]`, `activity[jobType]`, `activity[status]`, `activity[durationSeconds]`, `activity[userEmail]`, `activity[errorMessage]` |
| **Sort** | `timestamp` descending (newest first) |
| **Conditional formatting** | Background color on `status`: Green = Completed, Red = Failed |
| **Title** | "Recent System Activity" |

---

### 4.7 — Filters (Top Ribbon)

| Filter | Type | Source |
|--------|------|--------|
| Date Range | **Date slicer** (Between) | `activity[date]` |
| App Name | **Dropdown slicer** | `activity[appName]` |
| Status | **Dropdown slicer** | `activity[status]` |

---

## Part 5 — Color Theme

| Element | Color | Hex |
|---------|-------|-----|
| Canvas background | Deep slate | `#0B0F19` |
| Card background | Dark glass | `#1E293B` |
| Primary accent | Cyan | `#38BDF8` |
| Success | Emerald | `#34D399` |
| Failure | Rose | `#F43F5E` |
| Warning | Amber | `#F59E0B` |
| Text | White | `#F8FAFC` |
| Muted text | Slate | `#94A3B8` |

To apply: **View** → **Themes** → **Customize current theme** → paste hex values.

---

## Part 6 — Bonus API Endpoints (Advanced Use)

These additional endpoints exist if you need deeper data:

| Endpoint | Returns | Use case |
|----------|---------|----------|
| `/api/powerbi/monitoring` | All 4 tables combined in one JSON object | Single-call for Power Automate or full refresh |
| `/api/powerbi/feed` | Full dataset (users, sessions, telemetry, reviews, summary, failureOccurrences) | Deep analysis, custom DAX |
| `/api/powerbi/metrics` | Categorized metrics table (Executive, Engagement, FinOps, Reliability) | Alternative KPI source with categories |
| `/api/powerbi/users` | Raw users table | User dimension table |
| `/api/powerbi/sessions` | Raw sessions table | Session-level detail |
| `/api/powerbi/telemetry` | Raw telemetry events | Event-level Gemini API logs |
| `/api/powerbi/reviews` | Raw scraped reviews | Individual review text + sentiment |
| `/api/powerbi/failures` | Failure occurrence summary | Error monitoring |
| `/api/powerbi/heartbeat` (POST) | Session heartbeat recorder | Frontend telemetry ingestion |

All endpoints support `?format=csv` for CSV export (e.g., `/api/powerbi/users?format=csv`).

---

## Part 7 — Data Relationships

If you want to create relationships in Power BI Model view:

```
activity[appName]  ──────→  reviews_by_app[appName]     (Many-to-One)
activity[date]     ──────→  rag_performance[date]       (Many-to-Many, cross-filter)
```

But honestly — with only 4 tables and a single-page dashboard, you don't need formal relationships. Each visual pulls from its own table directly.

---

## Quick Reference Cheat Sheet

```
Dashboard = 1 page with:
  ├── 6 KPI cards          ← from: kpis table
  ├── 1 Line chart         ← from: activity table
  ├── 1 Bar chart          ← from: reviews_by_app table
  ├── 1 Donut chart        ← from: activity table
  ├── 1 Column chart       ← from: rag_performance table
  ├── 1 Activity table     ← from: activity table
  └── 3 Slicers            ← from: activity table (date, app, status)
```

**Total data connections needed: 4 URLs. That's it.**
