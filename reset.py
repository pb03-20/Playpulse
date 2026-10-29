"""
PlayPulse - Reset All Power BI Telemetry Counters to Zero
=========================================================
Run this script anytime to wipe all telemetry and start from initial 0:

    python reset.py
"""

import os
import json

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "telemetry_store.json")

def reset_all_to_zero():
    empty_data = {
        "users": [],
        "sessions": [],
        "telemetry": [],
        "reviews": []
    }
    
    os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(empty_data, f, indent=2)

    print("=" * 50)
    print("  SUCCESS: All PlayPulse Telemetry Reset to 0!")
    print("=" * 50)
    print("  - Total Test Accounts   : 0")
    print("  - Total Apps Analyzed   : 0")
    print("  - Total Reviews Stored  : 0")
    print("  - Completed Analyses    : 0")
    print("  - RAG Questions Asked   : 0")
    print("  - Activity Log          : Cleared (0 records)")
    print("=" * 50)
    print("Now in Power BI Desktop -> Click 'Refresh' to see all 0s!")

if __name__ == "__main__":
    reset_all_to_zero()
