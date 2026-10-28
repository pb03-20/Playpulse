import zipfile
import json
import os
import shutil

OUTPUT_DIR = os.path.abspath("powerbi_data")
os.makedirs(OUTPUT_DIR, exist_ok=True)
PBIT_PATH = os.path.join(OUTPUT_DIR, "PlayPulse_Live_Monitor.pbit")

# 1. Content_Types.xml
CONTENT_TYPES = """<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="json" ContentType="application/json" />
  <Default Extension="xml" ContentType="application/xml" />
  <Override PartName="/DataModelSchema" ContentType="application/json" />
  <Override PartName="/Report/Layout" ContentType="application/json" />
  <Override PartName="/Version" ContentType="application/json" />
  <Override PartName="/Settings" ContentType="application/json" />
  <Override PartName="/Metadata" ContentType="application/json" />
</Types>"""

# 2. Version
VERSION = "1.28"

# 3. Settings
SETTINGS = json.dumps({
    "ReportSettings": {
        "UseDefaultMeasureDisplayUnits": True,
        "AllowChangeFilterTypes": True
    }
})

# 4. Metadata
METADATA = json.dumps({
    "Version": 2,
    "AutoCreated": True
})

# 5. DataModelSchema with M queries and DAX measures
DATA_MODEL_SCHEMA = {
    "name": "PlayPulseTelemetryModel",
    "compatibilityLevel": 1550,
    "model": {
        "culture": "en-US",
        "dataSources": [
            {
                "type": "structured",
                "name": "LiveVercelFeed",
                "connectionDetails": {
                    "protocol": "http",
                    "address": {
                        "url": "https://new2-liard.vercel.app/api/powerbi/feed"
                    }
                },
                "credential": {
                    "AuthenticationKind": "Anonymous"
                }
            }
        ],
        "tables": [
            {
                "name": "Users",
                "columns": [
                    {"name": "UserID", "dataType": "string", "sourceColumn": "UserID"},
                    {"name": "Email", "dataType": "string", "sourceColumn": "Email"},
                    {"name": "FirstSeen", "dataType": "dateTime", "sourceColumn": "FirstSeen"},
                    {"name": "LastActive", "dataType": "dateTime", "sourceColumn": "LastActive"},
                    {"name": "TotalSessions", "dataType": "int64", "sourceColumn": "TotalSessions"},
                    {"name": "TotalMinutesSpent", "dataType": "double", "sourceColumn": "TotalMinutesSpent"}
                ],
                "measures": [
                    {
                        "name": "Total Real Verified Users",
                        "expression": "DISTINCTCOUNT(Users[Email])"
                    }
                ],
                "partitions": [
                    {
                        "name": "UsersPartition",
                        "mode": "import",
                        "source": {
                            "type": "m",
                            "expression": [
                                "let",
                                "    Source = Json.Document(Web.Contents(\"https://new2-liard.vercel.app/api/powerbi/feed\")),",
                                "    raw_users = Source[users],",
                                "    table_users = Table.FromList(raw_users, Splitter.SplitByNothing(), null, null, ExtraValues.Error),",
                                "    expanded_users = Table.ExpandRecordColumn(table_users, \"Column1\", {\"id\", \"email\", \"createdAt\", \"lastActiveAt\", \"totalSessions\", \"totalDurationSeconds\"}, {\"UserID\", \"Email\", \"FirstSeen\", \"LastActive\", \"TotalSessions\", \"TotalDurationSeconds\"}),",
                                "    typed_users = Table.TransformColumnTypes(expanded_users, {{\"TotalSessions\", Int64.Type}, {\"TotalDurationSeconds\", Int64.Type}, {\"FirstSeen\", type datetimezone}, {\"LastActive\", type datetimezone}}),",
                                "    added_minutes = Table.AddColumn(typed_users, \"TotalMinutesSpent\", each [TotalDurationSeconds] / 60, type number)",
                                "in",
                                "    added_minutes"
                            ]
                        }
                    }
                ]
            },
            {
                "name": "Sessions",
                "columns": [
                    {"name": "SessionID", "dataType": "string", "sourceColumn": "SessionID"},
                    {"name": "UserEmail", "dataType": "string", "sourceColumn": "UserEmail"},
                    {"name": "StartedAt", "dataType": "dateTime", "sourceColumn": "StartedAt"},
                    {"name": "LastPingAt", "dataType": "dateTime", "sourceColumn": "LastPingAt"},
                    {"name": "DurationSeconds", "dataType": "int64", "sourceColumn": "DurationSeconds"},
                    {"name": "AppResearched", "dataType": "string", "sourceColumn": "AppResearched"},
                    {"name": "QuestionsCount", "dataType": "int64", "sourceColumn": "QuestionsCount"},
                    {"name": "DurationMinutes", "dataType": "double", "sourceColumn": "DurationMinutes"},
                    {"name": "EngagementType", "dataType": "string", "sourceColumn": "EngagementType"}
                ],
                "measures": [
                    {
                        "name": "Total Active Research Minutes",
                        "expression": "SUM(Sessions[DurationMinutes])",
                        "formatString": "#,##0.0"
                    },
                    {
                        "name": "Lurking Minutes",
                        "expression": "CALCULATE(SUM(Sessions[DurationMinutes]), Sessions[QuestionsCount] = 0)",
                        "formatString": "#,##0.0"
                    },
                    {
                        "name": "Lurking Ratio %",
                        "expression": "DIVIDE([Lurking Minutes], [Total Active Research Minutes], 0)",
                        "formatString": "0.0%"
                    },
                    {
                        "name": "Total Real Sessions",
                        "expression": "COUNTROWS(Sessions)"
                    }
                ],
                "partitions": [
                    {
                        "name": "SessionsPartition",
                        "mode": "import",
                        "source": {
                            "type": "m",
                            "expression": [
                                "let",
                                "    Source = Json.Document(Web.Contents(\"https://new2-liard.vercel.app/api/powerbi/feed\")),",
                                "    raw_sessions = Source[sessions],",
                                "    table_sessions = Table.FromList(raw_sessions, Splitter.SplitByNothing(), null, null, ExtraValues.Error),",
                                "    expanded_sessions = Table.ExpandRecordColumn(table_sessions, \"Column1\", {\"id\", \"userEmail\", \"startedAt\", \"lastPingAt\", \"durationSeconds\", \"appResearched\", \"questionsCount\"}, {\"SessionID\", \"UserEmail\", \"StartedAt\", \"LastPingAt\", \"DurationSeconds\", \"AppResearched\", \"QuestionsCount\"}),",
                                "    typed_sessions = Table.TransformColumnTypes(expanded_sessions, {{\"DurationSeconds\", Int64.Type}, {\"QuestionsCount\", Int64.Type}, {\"StartedAt\", type datetimezone}, {\"LastPingAt\", type datetimezone}}),",
                                "    added_minutes = Table.AddColumn(typed_sessions, \"DurationMinutes\", each [DurationSeconds] / 60, type number),",
                                "    added_engagement = Table.AddColumn(added_minutes, \"EngagementType\", each if [QuestionsCount] = 0 then \"Lurking (Reading Only)\" else if [QuestionsCount] <= 2 then \"Casual Explorer\" else \"Deep AI Researcher\", type text)",
                                "in",
                                "    added_engagement"
                            ]
                        }
                    }
                ]
            },
            {
                "name": "Telemetry",
                "columns": [
                    {"name": "EventID", "dataType": "string", "sourceColumn": "EventID"},
                    {"name": "UserEmail", "dataType": "string", "sourceColumn": "UserEmail"},
                    {"name": "SessionID", "dataType": "string", "sourceColumn": "SessionID"},
                    {"name": "EventType", "dataType": "string", "sourceColumn": "EventType"},
                    {"name": "TargetApp", "dataType": "string", "sourceColumn": "TargetApp"},
                    {"name": "UserQuestion", "dataType": "string", "sourceColumn": "UserQuestion"},
                    {"name": "QuestionCategory", "dataType": "string", "sourceColumn": "QuestionCategory"},
                    {"name": "PromptTokens", "dataType": "int64", "sourceColumn": "PromptTokens"},
                    {"name": "CompletionTokens", "dataType": "int64", "sourceColumn": "CompletionTokens"},
                    {"name": "TotalTokens", "dataType": "int64", "sourceColumn": "TotalTokens"},
                    {"name": "CostUSD", "dataType": "double", "sourceColumn": "CostUSD"},
                    {"name": "StatusCode", "dataType": "int64", "sourceColumn": "StatusCode"},
                    {"name": "LatencySeconds", "dataType": "double", "sourceColumn": "LatencySeconds"},
                    {"name": "EventTimestamp", "dataType": "dateTime", "sourceColumn": "EventTimestamp"}
                ],
                "measures": [
                    {
                        "name": "Total Tokens Burned",
                        "expression": "SUM(Telemetry[TotalTokens])",
                        "formatString": "#,##0"
                    },
                    {
                        "name": "Total Gemini Cost ($)",
                        "expression": "SUM(Telemetry[CostUSD])",
                        "formatString": "$#,##0.0000"
                    },
                    {
                        "name": "Total AI Questions Asked",
                        "expression": "CALCULATE(COUNTROWS(Telemetry), Telemetry[EventType] = \"gemini_ask\")"
                    }
                ],
                "partitions": [
                    {
                        "name": "TelemetryPartition",
                        "mode": "import",
                        "source": {
                            "type": "m",
                            "expression": [
                                "let",
                                "    Source = Json.Document(Web.Contents(\"https://new2-liard.vercel.app/api/powerbi/feed\")),",
                                "    raw_events = Source[telemetry],",
                                "    table_events = Table.FromList(raw_events, Splitter.SplitByNothing(), null, null, ExtraValues.Error),",
                                "    expanded_events = Table.ExpandRecordColumn(table_events, \"Column1\", {\"id\", \"userEmail\", \"sessionId\", \"eventType\", \"appId\", \"question\", \"questionCategory\", \"promptTokens\", \"completionTokens\", \"totalTokens\", \"estimatedCostUsd\", \"statusCode\", \"latencyMs\", \"createdAt\"}, {\"EventID\", \"UserEmail\", \"SessionID\", \"EventType\", \"TargetApp\", \"UserQuestion\", \"QuestionCategory\", \"PromptTokens\", \"CompletionTokens\", \"TotalTokens\", \"CostUSD\", \"StatusCode\", \"LatencyMs\", \"EventTimestamp\"}),",
                                "    typed_events = Table.TransformColumnTypes(expanded_events, {{\"PromptTokens\", Int64.Type}, {\"CompletionTokens\", Int64.Type}, {\"TotalTokens\", Int64.Type}, {\"CostUSD\", type number}, {\"StatusCode\", Int64.Type}, {\"LatencyMs\", Int64.Type}, {\"EventTimestamp\", type datetimezone}}),",
                                "    added_sec = Table.AddColumn(typed_events, \"LatencySeconds\", each [LatencyMs] / 1000, type number)",
                                "in",
                                "    added_sec"
                            ]
                        }
                    }
                ]
            },
            {
                "name": "Reviews",
                "columns": [
                    {"name": "ReviewID", "dataType": "string", "sourceColumn": "ReviewID"},
                    {"name": "AppID", "dataType": "string", "sourceColumn": "AppID"},
                    {"name": "ReviewerName", "dataType": "string", "sourceColumn": "ReviewerName"},
                    {"name": "Rating", "dataType": "int64", "sourceColumn": "Rating"},
                    {"name": "ReviewContent", "dataType": "string", "sourceColumn": "ReviewContent"},
                    {"name": "ReviewDate", "dataType": "dateTime", "sourceColumn": "ReviewDate"},
                    {"name": "HelpfulVotes", "dataType": "int64", "sourceColumn": "HelpfulVotes"},
                    {"name": "AppVersion", "dataType": "string", "sourceColumn": "AppVersion"},
                    {"name": "Sentiment", "dataType": "string", "sourceColumn": "Sentiment"},
                    {"name": "IssueCategory", "dataType": "string", "sourceColumn": "IssueCategory"}
                ],
                "measures": [
                    {
                        "name": "Average App Rating",
                        "expression": "AVERAGE(Reviews[Rating])",
                        "formatString": "0.0"
                    },
                    {
                        "name": "Total Reviews Analyzed",
                        "expression": "COUNTROWS(Reviews)"
                    }
                ],
                "partitions": [
                    {
                        "name": "ReviewsPartition",
                        "mode": "import",
                        "source": {
                            "type": "m",
                            "expression": [
                                "let",
                                "    Source = Json.Document(Web.Contents(\"https://new2-liard.vercel.app/api/powerbi/feed\")),",
                                "    raw_reviews = Source[reviews],",
                                "    table_reviews = Table.FromList(raw_reviews, Splitter.SplitByNothing(), null, null, ExtraValues.Error),",
                                "    expanded_reviews = Table.ExpandRecordColumn(table_reviews, \"Column1\", {\"reviewId\", \"appId\", \"userName\", \"score\", \"content\", \"at\", \"thumbsUp\", \"version\", \"sentiment\", \"detectedCategory\"}, {\"ReviewID\", \"AppID\", \"ReviewerName\", \"Rating\", \"ReviewContent\", \"ReviewDate\", \"HelpfulVotes\", \"AppVersion\", \"Sentiment\", \"IssueCategory\"}),",
                                "    typed_reviews = Table.TransformColumnTypes(expanded_reviews, {{\"Rating\", Int64.Type}, {\"HelpfulVotes\", Int64.Type}, {\"ReviewDate\", type datetimezone}})",
                                "in",
                                "    typed_reviews"
                            ]
                        }
                    }
                ]
            }
        ],
        "relationships": [
            {
                "name": "Rel_Users_Sessions",
                "fromTable": "Sessions",
                "fromColumn": "UserEmail",
                "toTable": "Users",
                "toColumn": "Email"
            },
            {
                "name": "Rel_Users_Telemetry",
                "fromTable": "Telemetry",
                "fromColumn": "UserEmail",
                "toTable": "Users",
                "toColumn": "Email"
            }
        ]
    }
}

# 6. Report Layout
REPORT_LAYOUT = {
    "id": 0,
    "resourcePackages": [],
    "sections": [
        {
            "id": 0,
            "name": "Real_User_Research_Overview",
            "displayName": "Executive Real-Time User Monitor",
            "width": 1280,
            "height": 720,
            "visualContainers": []
        }
    ]
}

def create_pbit():
    print("Building clean real-user PlayPulse_Live_Monitor.pbit...")
    with zipfile.ZipFile(PBIT_PATH, "w", zipfile.ZIP_DEFLATED) as pbit:
        pbit.writestr("[Content_Types].xml", CONTENT_TYPES)
        pbit.writestr("Version", VERSION)
        pbit.writestr("Settings", SETTINGS)
        pbit.writestr("Metadata", METADATA)
        pbit.writestr("DataModelSchema", json.dumps(DATA_MODEL_SCHEMA, indent=2))
        pbit.writestr("Report/Layout", json.dumps(REPORT_LAYOUT, indent=2))
    print(f"SUCCESS: Created {PBIT_PATH}")

if __name__ == "__main__":
    create_pbit()
