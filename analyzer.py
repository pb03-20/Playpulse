import os
import argparse
from dotenv import load_dotenv
from google_play_scraper import reviews, Sort
from google import genai
from google.genai import types

load_dotenv()

# We need the Gemini API key.
API_KEY = os.getenv("GEMINI_API_KEY")

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


def fetch_reviews(app_id: str, count: int = 300, lang: str = "en", country: str = "us"):
    """Fetches reviews for a given app ID."""
    print(f"Fetching {count} reviews for {app_id}...")
    result, _ = reviews(
        app_id,
        lang=lang,
        country=country,
        sort=Sort.NEWEST,
        count=count
    )
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


def ask_question(app_id: str, question: str, review_list: list):
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

    response = client.models.generate_content(
        model='gemini-3.6-flash',
        contents=user_prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.7,
        )
    )
    
    return response.text


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Analyze Google Play Reviews with Gemini")
    parser.add_argument("--app", type=str, default="com.whatsapp", help="App ID (e.g., com.whatsapp)")
    parser.add_argument("--count", type=int, default=300, help="Number of reviews to fetch")
    parser.add_argument("--question", type=str, required=True, help="Question to ask about the reviews")
    
    args = parser.parse_args()
    
    reviews_data = fetch_reviews(args.app, args.count)
    answer = ask_question(args.app, args.question, reviews_data)
    
    print("\n" + "="*40 + "\n")
    print("ANSWER:\n")
    print(answer)
    print("\n" + "="*40 + "\n")
