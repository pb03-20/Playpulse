# 📊 PlayPulse: Real-Time User Research & AI Telemetry Dashboard
## Power BI Skill Demonstration & Technical Architecture Guide

This project is an enterprise-grade analytics demonstration tracking **real, Google-authenticated user behaviors**, **lurking/reading telemetry**, and **Gemini AI token resource burn** in production.

---

### 1. Data Model Architecture (Star Schema)

The data model connects to the live production feed `https://new2-liard.vercel.app/api/powerbi/feed` (or local CSVs) structured as follows:

```
        +-----------------------------------+
        |       DimUsers (Users)            |
        |-----------------------------------|
        | PK: Email                         |
        | UserID, FirstSeen, LastActive     |
        +-----------------------------------+
                  | 1
                  |
                  | * (1-to-many)
        +-----------------------------------+          +-----------------------------------+
        |      FactSessions (Sessions)      |          |     FactTelemetry (Telemetry)     |
        |-----------------------------------|          |-----------------------------------|
        | PK: SessionID                     |          | PK: EventID                       |
        | FK: UserEmail                     |          | FK: UserEmail                     |
        | DurationSeconds, DurationMinutes  |          | FK: SessionID                     |
        | QuestionsCount, EngagementType    |          | PromptTokens, CompletionTokens    |
        | AppResearched, StartedAt          |          | TotalTokens, CostUSD, LatencyMs   |
        +-----------------------------------+          +-----------------------------------+
                                                                     |
                                                                     | (Analytical)
                                                       +-----------------------------------+
                                                       |       DimReviews (Reviews)        |
                                                       |-----------------------------------|
                                                       | PK: ReviewID                      |
                                                       | AppID, Rating, Sentiment, Content |
                                                       +-----------------------------------+
```

---

### 2. High-Impact Visual Canvas Layout

#### 🎨 Recommended Color Palette (Modern Executive Theme)
- **Canvas Background:** Deep Slate `#0B0F19` or `#0F172A`
- **Card Background:** Glass Dark Card `#1E293B`
- **Primary Accent (User Time):** Cyan / Blue `#38BDF8`
- **Secondary Accent (AI Prompting):** Indigo / Violet `#818CF8`
- **Positive Accent (Lurking / Reading):** Emerald `#34D399`
- **Warning / Cost Accent:** Amber `#F59E0B`

---

#### Section A: Top KPI Banner (4 Cards across the top)
1. **Card 1: Real Authenticated Users**
   - **Measure:** `[Total Real Verified Users]`
   - **Display:** `1` (Verified Google OAuth user: `baghelapriyanshu67@gmail.com`)
   - **Sub-label:** "100% Genuine Google Accounts"
2. **Card 2: Total Active Research Time**
   - **Measure:** `[Total Active Research Minutes]`
   - **Format:** `0.0 Mins` (e.g. `8.8 Mins`)
3. **Card 3: Lurking Ratio %**
   - **Measure:** `[Lurking Ratio %]`
   - **Format:** `0.0%`
   - **Sub-label:** "Passive Review Exploration vs Prompting"
4. **Card 4: Total AI Token Burn & FinOps**
   - **Measure:** `[Total Tokens Burned]` & `[Total Gemini Cost ($)]`
   - **Format:** `# Tokens | $ Cost`

---

#### Section B: Behavioral Analytics (Middle Canvas)
1. **Donut Chart: User Persona & Engagement Style**
   - **Legend:** `Sessions[EngagementType]`
   - **Values:** `[Total Active Research Minutes]`
   - **Insight:** Distinguishes between **Lurking (Reading Only)** and **Active AI Prompting**.
2. **Clustered Bar Chart: Research Duration & Questions by Target App**
   - **Y-Axis:** `Sessions[AppResearched]` (e.g., WhatsApp, Spotify)
   - **X-Axis Values:** `[Total Active Research Minutes]`, `[Total AI Prompts Asked]`
   - **Insight:** Pinpoints which applications generate the deepest user research.

---

#### Section C: Deep-Dive User Audit (Bottom Canvas)
1. **Matrix / Table Visual: Per-User Behavioral Audit**
   - **Rows:** `Users[Email]`
   - **Columns / Values:**
     - `Users[FirstSeen]`
     - `[Total Real Sessions]`
     - `[Total Active Research Minutes]`
     - `[Lurking Minutes]`
     - `[Lurking Ratio %]`
     - `[User Behavioral Segment]`
     - `[Total Tokens Burned]`
     - `[Total Gemini Cost ($)]`
   - **Conditional Formatting:** Add a Data Bar or Gradient on `[Lurking Ratio %]`.

2. **Treemap or Column Chart: AI Question Intent Breakdown**
   - **Category:** `Telemetry[QuestionCategory]` (Bugs & Crashes, Sentiment, Feature Requests)
   - **Values:** `[Total Tokens Burned]`
   - **Tooltips:** `[Avg API Latency (Seconds)]`

---

### 3. Interview / Portfolio Talking Points

When demonstrating this dashboard to technical interviewers or clients:

1. **Production Google Identity Gate:**
   > *"Unlike mock dashboards, this system integrates with a Google Identity Services OAuth 2.0 flow. Only verified Google accounts (`isVerifiedGoogle = true`) are admitted, eliminating bot and fake email anomalies at the ingestion boundary."*

2. **The 'Lurker Problem' in AI UX:**
   > *"Most AI products only track prompt counts, mistakenly assuming inactive prompters are churning. By engineering a 15-second heartbeat telemetry daemon, I captured that users spend up to 70%+ of their session actively lurking—reading reviews and analyzing synthesized summaries before querying. This drastically reframes user retention."*

3. **FinOps & AI Governance:**
   > *"Every Gemini completion logs prompt tokens, completion tokens, latency, and HTTP status codes (200, 429, 402), enabling precise unit-economic cost modeling ($ per active hour per user) directly within Power BI DAX."*
