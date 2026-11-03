"""
PlayPulse - Sync Telemetry Store to MongoDB Atlas
================================================
This script uploads the entire authentic dataset (5000 reviews, 19 telemetry events,
5 users, 5 sessions) into your MongoDB Atlas cluster collections.
"""

import os
import json
from dotenv import load_dotenv

load_dotenv()

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "telemetry_store.json")

def sync_to_mongodb():
    uri = os.getenv("MONGO_URI")
    if not uri:
        print("[ERROR] MONGO_URI is missing in .env file!")
        return

    print("Connecting to MongoDB Atlas...")
    try:
        from pymongo import MongoClient
        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        db = client.get_database("playpulse")
        # Trigger connection check
        db.command("ping")
        print("[SUCCESS] Connected to MongoDB Atlas 'playpulse' database!")
    except Exception as e:
        print(f"\n[ERROR] Connection failed: {e}")
        print("\n--> TO FIX: Go to MongoDB Atlas (cloud.mongodb.com) -> Network Access -> Add IP Address -> Select 'Allow Access from Anywhere' (0.0.0.0/0).\n")
        return

    if not os.path.exists(DATA_PATH):
        print(f"[ERROR] {DATA_PATH} not found!")
        return

    with open(DATA_PATH, "r", encoding="utf-8") as f:
        store = json.load(f)

    users = store.get("users", [])
    sessions = store.get("sessions", [])
    telemetry = store.get("telemetry", [])
    reviews = store.get("reviews", [])

    print(f"Uploading to MongoDB Atlas:")
    print(f"  - Users     : {len(users)}")
    print(f"  - Sessions  : {len(sessions)}")
    print(f"  - Telemetry : {len(telemetry)}")
    print(f"  - Reviews   : {len(reviews)}")

    # 1. Users
    if users:
        for u in users:
            db["users"].update_one({"email": u["email"]}, {"$set": u}, upsert=True)
        print(f"[Users] Synced {len(users)} users.")

    # 2. Sessions
    if sessions:
        for s in sessions:
            db["sessions"].update_one({"id": s["id"]}, {"$set": s}, upsert=True)
        print(f"[Sessions] Synced {len(sessions)} sessions.")

    # 3. Telemetry
    if telemetry:
        for t in telemetry:
            db["telemetry"].update_one({"id": t["id"]}, {"$set": t}, upsert=True)
        print(f"[Telemetry] Synced {len(telemetry)} events.")

    # 4. Reviews (batch upsert or insert)
    if reviews:
        from pymongo import UpdateOne
        operations = [
            UpdateOne({"reviewId": r["reviewId"]}, {"$set": r}, upsert=True)
            for r in reviews
        ]
        # Perform in batches of 1000
        batch_size = 1000
        for i in range(0, len(operations), batch_size):
            batch = operations[i:i + batch_size]
            db["reviews"].bulk_write(batch, ordered=False)
        print(f"[Reviews] Synced {len(reviews)} reviews.")

    print("\n[COMPLETE] MongoDB Atlas is fully populated with your persistent baseline data!")

if __name__ == "__main__":
    sync_to_mongodb()

