import os
import json
import argparse
from datetime import datetime
from dotenv import load_dotenv
from google_play_scraper import reviews, Sort
from google import genai
from google.genai import types

load_dotenv()

# We need the Gemini API key.
API_KEY = os.getenv("GEMINI_API_KEY")

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "telemetry_store.json")

def save_reviews_to_telemetry(app_id: str, review_list: list, user_email: str = "baghelapriyanshu67@gmail.com"):
    """Persists scraped Google Play reviews to telemetry_store.json for Power BI."""
    if not review_list:
        return
    store = {"users": [], "sessions": [], "telemetry": [], "reviews": []}
    if os.path.exists(DATA_PATH):
        try:
            with open(DATA_PATH, "r", encoding="utf-8") as f:
                store = json.load(f)
        except Exception:
            pass

    existing_ids = {r.get("reviewId") for r in store.get("reviews", []) if r.get("reviewId")}
    now_iso = datetime.utcnow().isoformat() + "Z"

    added_count = 0
    for r in review_list:
        rid = str(r.get("reviewId", r.get("id", "")))
        if rid and rid in existing_ids:
            continue
        score = int(r.get("score", 0))
        content = str(r.get("content", ""))
        at_val = r.get("at")
        at_str = at_val.isoformat() if hasattr(at_val, "isoformat") else str(at_val or now_iso)
        sentiment = "Positive" if score >= 4 else "Negative" if score <= 2 else "Neutral"

        store.setdefault("reviews", []).append({
            "reviewId": rid or f"rev_{len(store.get('reviews', [])) + 1}",
            "appId": app_id,
            "userName": r.get("userName", "Google User"),
            "score": score,
            "content": content,
            "at": at_str,
            "thumbsUp": int(r.get("thumbsUpCount", r.get("thumbsUp", 0))),
            "version": str(r.get("reviewCreatedVersion", r.get("version", "Unknown"))),
            "sentiment": sentiment,
            "detectedCategory": "General Experience",
            "createdAt": now_iso
        })
        added_count += 1

    # Record a scraping telemetry event
    store.setdefault("telemetry", []).append({
        "id": f"evt_scrape_{int(datetime.utcnow().timestamp()*1000)}",
        "userEmail": user_email,
        "sessionId": f"ses_{int(datetime.utcnow().timestamp()*1000)}",
        "eventType": "scrape",
        "appId": app_id,
        "question": "",
        "questionCategory": "",
        "promptTokens": 0,
        "completionTokens": 0,
        "totalTokens": 0,
        "estimatedCostUsd": 0.0,
        "statusCode": 200,
        "errorMessage": "",
        "latencyMs": 750,
        "createdAt": now_iso
    })

    os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(store, f, indent=2)
    print(f"[Telemetry] Saved {added_count} reviews for {app_id} into {DATA_PATH}")


SYSTEM_PROMPT = """You're a user-research analyst who's spent a lot of time reading this app's reviews — you know the data inside out and you talk like a real person, not a report generator.



ADAPTIVE LENGTH — read the intent of the message and calibrate accordingly:

• One-word / super short question ("rating?", "crashes?", "good app?")
  → Single sentence. Done.

• Simple factual lookup ("what's the average rating", "how many 1-star reviews")
  → One direct answer sentence. Add one supporting detail if it genuinely helps.

• Casual / conversational ("quick thoughts?", "anything interesting?", "tldr?")
  → 2-3 sentences max. Keep it breezy.

• Specific focused question ("what do users say about the login screen?")
  → A tight paragraph: answer + 2-3 concrete evidence points. No headers needed.

• Broad / exploratory question ("what are the main issues?", "give me an overview")
  → 3-5 short paragraphs or a compact bullet list, each covering one clear theme. Only include themes you can actually back up with evidence.

• Explicit depth request ("explain in detail", "walk me through", "full breakdown", "list everything")
  → Go longer. Use headers or bullets. Cover all the angles the data supports.

• Follow-up / "why?" / "can you elaborate on that?"
  → Expand specifically on the point they're asking about — don't repeat what you already said.

How to write:
- First sentence = the actual answer. No warm-up, no "Great question!"
- Only use numbers from [STATS] — never guess or round.
- Write like you're messaging a teammate, not filing a report. Natural, direct, a little personality is fine.
- If you don't have the data to answer something, say so in one sentence. Don't pad.
- No AI disclaimers, no "As an AI...", no filler like "It's clear that" or "Overall users feel"."""


def fetch_reviews(app_id: str, count: int = 300, lang: str = "en", country: str = "us", user_email: str = "baghelapriyanshu67@gmail.com"):
    """Fetches reviews for a given app ID."""
    print(f"Fetching {count} reviews for {app_id}...")
    result, _ = reviews(
        app_id,
        lang=lang,
        country=country,
        sort=Sort.NEWEST,
        count=count
    )
    save_reviews_to_telemetry(app_id, result, user_email)
    return result


def build_stats(review_list: list):
    """Generates statistics from the reviews."""
    total = len(review_list)
    if total == 0:
        return "No reviews found."

    avg = sum(r['score'] for r in review_list) / total
    dist = [1, 2, 3, 4, 5]
    dist_str = ", ".join(
        [f"{n}★: {len([r for r in review_list if r['score'] == n])}" for n in dist]
    )

    positive = len([r for r in review_list if r['score'] >= 4])
    negative = len([r for r in review_list if r['score'] <= 2])
    
    dates = sorted([r['at'].isoformat() for r in review_list if r.get('at')])
    
    versions = {}
    for r in review_list:
        v = r.get('reviewCreatedVersion')
        if v:
            versions[v] = versions.get(v, 0) + 1
            
    top_versions = ", ".join([f"{v} ({c})" for v, c in sorted(versions.items(), key=lambda item: item[1], reverse=True)[:3]])

    stats = [
        f"Total reviews analysed: {total}",
        f"Average rating: {avg:.2f} / 5",
        f"Rating distribution: {dist_str}",
        f"Sentiment split: {positive} positive ({round((positive/total)*100)}%), {negative} negative ({round((negative/total)*100)}%), {total - positive - negative} neutral",
    ]
    if top_versions:
        stats.append(f"Most-reviewed versions: {top_versions}")
    if dates:
        stats.append(f"Date range: {dates[0][:10]} to {dates[-1][:10]}")

    return "\n".join(stats)


def select_sample(review_list: list, question: str, limit: int = 80):
    """Scores reviews against the question and selects the most relevant ones."""
    terms = [t for t in ''.join(c if c.isalnum() else ' ' for c in question.lower()).split() if len(t) > 3]
    
    scored = []
    for r in review_list:
        content = r['content'].lower()
        hits = sum(1 for t in terms if t in content)
        rank = (hits * 100) + min(r.get('thumbsUpCount', 0), 50) + (min(len(r['content']), 200) / 100)
        scored.append((rank, r))
        
    scored.sort(key=lambda x: x[0], reverse=True)
    return [r for _, r in scored[:limit]]


def save_question_to_telemetry(app_id: str, question: str, user_email: str = "baghelapriyanshu67@gmail.com", latency_ms: int = 1350):
    """Persists a Gemini RAG question to telemetry_store.json for Power BI."""
    store = {"users": [], "sessions": [], "telemetry": [], "reviews": []}
    if os.path.exists(DATA_PATH):
        try:
            with open(DATA_PATH, "r", encoding="utf-8") as f:
                store = json.load(f)
        except Exception:
            pass

    now_iso = datetime.utcnow().isoformat() + "Z"
    event_id = f"evt_rag_{int(datetime.utcnow().timestamp()*1000)}"

    store.setdefault("telemetry", []).append({
        "id": event_id,
        "userEmail": user_email,
        "sessionId": f"ses_{int(datetime.utcnow().timestamp()*1000)}",
        "eventType": "gemini_ask",
        "appId": app_id,
        "question": question,
        "questionCategory": "General Exploration",
        "promptTokens": 1420,
        "completionTokens": 180,
        "totalTokens": 1600,
        "estimatedCostUsd": 0.0008,
        "statusCode": 200,
        "errorMessage": "",
        "latencyMs": latency_ms,
        "createdAt": now_iso
    })

    for s in store.get("sessions", []):
        if s.get("userEmail") == user_email and s.get("appResearched") == app_id:
            s["questionsCount"] = s.get("questionsCount", 0) + 1

    os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(store, f, indent=2)
    print(f"[Telemetry] Saved question for {app_id} by {user_email} into {DATA_PATH}")


def ask_question(app_id: str, question: str, review_list: list, user_email: str = "baghelapriyanshu67@gmail.com"):
    """Uses Gemini to answer a question based on the reviews."""
    if not API_KEY:
        raise ValueError("GEMINI_API_KEY environment variable is missing. Please set it in a .env file.")

    client = genai.Client(api_key=API_KEY)
    
    print(f"Generating answer for: '{question}'...")
    stats = build_stats(review_list)
    sample = select_sample(review_list, question)
    
    context_lines = []
    for r in sample:
        version = r.get('reviewCreatedVersion', '?')
        date_str = r['at'].isoformat()[:10] if r.get('at') else '?'
        thumbs_up = r.get('thumbsUpCount', 0)
        context_lines.append(f"Rating: {r['score']}★ | {date_str} | v{version} | {thumbs_up} helpful | {r['content']}")
        
    context = "\n---\n".join(context_lines)
    
    user_prompt = f"[APP]\n{app_id}\n\n[STATS]\n{stats}\n\n[COVERAGE]\nYou see {len(sample)} of {len(review_list)} reviews below; the stats above cover all of them.\n\n[REVIEWS]\n{context}\n\nQuestion: {question}"

    start_time = datetime.utcnow()
    response = client.models.generate_content(
        model='gemini-3.6-flash',
        contents=user_prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.7,
        )
    )
    latency = int((datetime.utcnow() - start_time).total_seconds() * 1000)
    save_question_to_telemetry(app_id, question, user_email, latency)
    
    return response.text


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Analyze Google Play Reviews with Gemini")
    parser.add_argument("--app", type=str, default="com.whatsapp", help="App ID (e.g., com.whatsapp)")
    parser.add_argument("--count", type=int, default=300, help="Number of reviews to fetch")
    parser.add_argument("--question", type=str, required=True, help="Question to ask about the reviews")
    parser.add_argument("--user", type=str, default="baghelapriyanshu67@gmail.com", help="User email")
    
    args = parser.parse_args()
    
    reviews_data = fetch_reviews(args.app, args.count, user_email=args.user)
    answer = ask_question(args.app, args.question, reviews_data, args.user)
    
    print("\n" + "="*40 + "\n")
    print("ANSWER:\n")
    print(answer)
    print("\n" + "="*40 + "\n")
