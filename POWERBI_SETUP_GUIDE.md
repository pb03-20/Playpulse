# PlayPulse Power BI Dashboard Implementation Guide

This guide walks you through connecting **Power BI Desktop** to your running **PlayPulse** instance and assembling the 3-page executive monitoring dashboard.

---

## 1. Quick Connection Methods

You can connect Power BI to PlayPulse using either of these two methods:

### Method A: Live REST API (Auto-updates while PlayPulse is running)
When your PlayPulse dev server is running at `http://localhost:8080` (or `http://localhost:3000`):

1. Open **Power BI Desktop**.
2. Click **Get Data** ➔ **Web**.
3. Enter URL: `http://localhost:8080/api/powerbi/feed`
4. Click **OK**.
5. In Power Query, you will see 4 record items: `users`, `sessions`, `telemetry`, `reviews`.
6. Right-click any of them ➔ select **Reference** to create individual tables for each.

Or connect directly to individual table endpoints:
- **Users**: `http://localhost:8080/api/powerbi/users`
- **Sessions**: `http://localhost:8080/api/powerbi/sessions`
- **Telemetry**: `http://localhost:8080/api/powerbi/telemetry`
- **Reviews**: `http://localhost:8080/api/powerbi/reviews`


---

### Method B: Local Folder / CSV Files (Instant One-Click Load)
PlayPulse automatically syncs CSVs to the local folder:
`d:\documents\new2\new2\powerbi_data\`

1. Open **Power BI Desktop**.
2. Click **Get Data** ➔ **Folder** (or **Text/CSV**).
3. Browse to: `d:\documents\new2\new2\powerbi_data\`
4. Select all 4 CSVs (`users.csv`, `sessions.csv`, `telemetry.csv`, `reviews.csv`).
5. Click **Load**.

---

## 2. Power BI Data Model (Relationships)

In Power BI's **Model View** (left icon showing tables and links), verify the following relationships:

1. `users[email]` ─── (1 to Many) ─── `sessions[userEmail]`
2. `users[email]` ─── (1 to Many) ─── `telemetry[userEmail]`
3. `sessions[id]` ─── (1 to Many) ─── `telemetry[sessionId]`
4. `telemetry[appId]` ─── (Many to Many / Filterable) ─── `reviews[appId]`

---

## 3. Copy-and-Paste DAX Measures

Create a dedicated measures table or add these to `telemetry`:

### Engagement & User Research Measures:
```dax
Total Researchers = DISTINCTCOUNT(users[email])
```
```dax
Avg Session Duration Min = DIVIDE(AVERAGE(sessions[durationSeconds]), 60, 0)
```
```dax
Total Scrapes = CALCULATE(COUNTROWS(telemetry), telemetry[eventType] == "scrape")
```
```dax
Total AI Questions = CALCULATE(COUNTROWS(telemetry), telemetry[eventType] == "gemini_ask")
```

### AI Economics & Friction Measures:
```dax
Total Tokens Consumed = SUM(telemetry[totalTokens])
```
```dax
Estimated Cost USD = SUM(telemetry[estimatedCostUsd])
```
```dax
Rate Limit Errors (429) = CALCULATE(COUNTROWS(telemetry), telemetry[statusCode] == 429)
```
```dax
Credits Exhausted Errors (402) = CALCULATE(COUNTROWS(telemetry), telemetry[statusCode] == 402)
```
```dax
User Frustration Rate % = 
VAR BlockedUsers = CALCULATE(DISTINCTCOUNT(telemetry[userEmail]), telemetry[statusCode] IN {402, 429})
VAR AllUsers = DISTINCTCOUNT(users[email])
RETURN DIVIDE(BlockedUsers, AllUsers, 0) * 100
```

### Market Intelligence & Review Measures:
```dax
Total Reviews Harvested = COUNTROWS(reviews)
```
```dax
Average App Rating = AVERAGE(reviews[score])
```
```dax
Net Sentiment Score = 
VAR Total = COUNTROWS(reviews)
VAR Pos = CALCULATE(COUNTROWS(reviews), reviews[sentiment] == "Positive")
VAR Neg = CALCULATE(COUNTROWS(reviews), reviews[sentiment] == "Negative")
RETURN DIVIDE(Pos - Neg, Total, 0) * 100
```
```dax
Critical 1-Star Ratio % = 
DIVIDE(CALCULATE(COUNTROWS(reviews), reviews[score] == 1), COUNTROWS(reviews), 0) * 100
```

---

## 4. Visual Layout Instructions (Page by Page)

### Page 1: User Research & Engagement
- **Top Row**: 4 Card visuals with `[Total Researchers]`, `[Avg Session Duration Min]`, `[Total Scrapes]`, `[Total AI Questions]`.
- **Left Chart**: **Clustered Bar Chart** ➔ Y-Axis: `telemetry[appId]`, X-Axis: `COUNT(telemetry[id])` (shows which apps users analyze most).
- **Right Chart**: **Treemap** ➔ Group: `telemetry[questionCategory]`, Values: `COUNT(telemetry[question])` (shows what questions users ask).
- **Bottom Table**: **Table Visual** ➔ Columns: `users[email]`, `sessions[appResearched]`, `sessions[durationSeconds]`, `sessions[questionsCount]`.

### Page 2: AI Economics & User Friction
- **Top Row**: 4 Card visuals with `[Total Tokens Consumed]`, `[Estimated Cost USD]`, `[Rate Limit Errors (429)]`, `[Credits Exhausted Errors (402)]`.
- **Left Chart**: **Line Chart** ➔ X-Axis: `telemetry[createdAt]`, Y-Axis: `[Total Tokens Consumed]`.
- **Right Chart**: **Donut Chart** ➔ Legend: `telemetry[statusCode]`, Values: `COUNT(telemetry[id])`.
- **Bottom Table**: **Table Visual** ➔ Columns: `telemetry[createdAt]`, `telemetry[userEmail]`, `telemetry[statusCode]`, `telemetry[errorMessage]`, `telemetry[latencyMs]`.

### Page 3: Market & Review Intelligence
- **Top Row**: 4 Card visuals with `[Total Reviews Harvested]`, `[Average App Rating]`, `[Net Sentiment Score]`, `[Critical 1-Star Ratio %]`.
- **Left Chart**: **Clustered Column Chart** ➔ X-Axis: `reviews[version]`, Y-Axis: `[Average App Rating]`.
- **Right Chart**: **100% Stacked Bar Chart** ➔ Y-Axis: `reviews[appId]`, Legend: `reviews[sentiment]`, Values: `COUNT(reviews[reviewId])`.
- **Bottom Table**: **Table Visual** ➔ Columns: `reviews[appId]`, `reviews[score]`, `reviews[thumbsUp]`, `reviews[content]`, `reviews[detectedCategory]`.
