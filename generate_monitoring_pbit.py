import zipfile
import json
import os

OUTPUT_DIR = os.path.abspath("powerbi_data")
os.makedirs(OUTPUT_DIR, exist_ok=True)
PBIT_PATH = os.path.join(OUTPUT_DIR, "PlayPulse_Monitoring.pbit")

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

VERSION = "1.28"

SETTINGS = json.dumps({
    "ReportSettings": {
        "UseDefaultMeasureDisplayUnits": True,
        "AllowChangeFilterTypes": True
    }
})

METADATA = json.dumps({
    "Version": 2,
    "AutoCreated": True
})

DATA_MODEL_SCHEMA = {
    "name": "PlayPulseMonitoringModel",
    "compatibilityLevel": 1550,
    "model": {
        "culture": "en-US",
        "dataSources": [
            {
                "type": "structured",
                "name": "PlayPulseLive",
                "connectionDetails": {
                    "protocol": "http",
                    "address": {
                        "url": "https://playpulse-backend.onrender.com/api/powerbi/monitoring"
                    }
                },
                "credential": {
                    "AuthenticationKind": "Anonymous"
                }
            }
        ],
        "tables": [
            {
                "name": "activity",
                "columns": [
                    {"name": "id", "dataType": "string", "sourceColumn": "id"},
                    {"name": "timestamp", "dataType": "dateTime", "sourceColumn": "timestamp"},
                    {"name": "date", "dataType": "dateTime", "sourceColumn": "date"},
                    {"name": "appName", "dataType": "string", "sourceColumn": "appName"},
                    {"name": "jobType", "dataType": "string", "sourceColumn": "jobType"},
                    {"name": "status", "dataType": "string", "sourceColumn": "status"},
                    {"name": "duration", "dataType": "int64", "sourceColumn": "duration"},
                    {"name": "durationSeconds", "dataType": "double", "sourceColumn": "durationSeconds"},
                    {"name": "reviewsCollected", "dataType": "int64", "sourceColumn": "reviewsCollected"},
                    {"name": "tokens", "dataType": "int64", "sourceColumn": "tokens"},
                    {"name": "errorMessage", "dataType": "string", "sourceColumn": "errorMessage"},
                    {"name": "userEmail", "dataType": "string", "sourceColumn": "userEmail"},
                    {"name": "accountType", "dataType": "string", "sourceColumn": "accountType"}
                ],
                "partitions": [
                    {
                        "name": "ActivityPartition",
                        "mode": "import",
                        "source": {
                            "type": "m",
                            "expression": [
                                "let",
                                "    Source = Json.Document(Web.Contents(\"https://new2-liard.vercel.app/api/powerbi/monitoring\")),",
                                "    systemActivity_raw = Source[systemActivity],",
                                "    systemActivity_table = Table.FromRecords(systemActivity_raw, {\"id\", \"timestamp\", \"date\", \"appName\", \"jobType\", \"status\", \"duration\", \"durationSeconds\", \"reviewsCollected\", \"tokens\", \"errorMessage\", \"userEmail\", \"accountType\"}, MissingField.UseNull),",
                                "    systemActivity_typed = Table.TransformColumnTypes(systemActivity_table, {",
                                "        {\"timestamp\", type datetime},",
                                "        {\"date\", type date},",
                                "        {\"appName\", type text},",
                                "        {\"jobType\", type text},",
                                "        {\"status\", type text},",
                                "        {\"duration\", Int64.Type},",
                                "        {\"durationSeconds\", type number},",
                                "        {\"reviewsCollected\", Int64.Type},",
                                "        {\"tokens\", Int64.Type},",
                                "        {\"errorMessage\", type text},",
                                "        {\"userEmail\", type text},",
                                "        {\"accountType\", type text}",
                                "    })",
                                "in",
                                "    systemActivity_typed"
                            ]
                        }
                    }
                ]
            },
            {
                "name": "kpis",
                "columns": [
                    {"name": "Metric", "dataType": "string", "sourceColumn": "Metric"},
                    {"name": "Value", "dataType": "double", "sourceColumn": "Value"},
                    {"name": "Description", "dataType": "string", "sourceColumn": "Description"}
                ],
                "partitions": [
                    {
                        "name": "KpisPartition",
                        "mode": "import",
                        "source": {
                            "type": "m",
                            "expression": [
                                "let",
                                "    Source = Json.Document(Web.Contents(\"https://new2-liard.vercel.app/api/powerbi/monitoring\")),",
                                "    kpis_raw = Source[kpisTable],",
                                "    kpis_table = Table.FromRecords(kpis_raw, {\"Metric\", \"Value\", \"Description\"}, MissingField.UseNull),",
                                "    kpis_typed = Table.TransformColumnTypes(kpis_table, {",
                                "        {\"Metric\", type text},",
                                "        {\"Value\", type number},",
                                "        {\"Description\", type text}",
                                "    })",
                                "in",
                                "    kpis_typed"
                            ]
                        }
                    }
                ]
            }
        ]
    }
}

REPORT_LAYOUT = {
    "id": 0,
    "resourcePackages": [],
    "sections": [
        {
            "id": 0,
            "name": "PlayPulse_Monitoring",
            "displayName": "Executive Real-Time Monitor",
            "width": 1280,
            "height": 720,
            "visualContainers": []
        }
    ]
}

def create_pbit():
    print("Generating PlayPulse_Monitoring.pbit...")
    with zipfile.ZipFile(PBIT_PATH, "w", zipfile.ZIP_DEFLATED) as pbit:
        pbit.writestr("[Content_Types].xml", CONTENT_TYPES)
        pbit.writestr("Version", VERSION)
        pbit.writestr("Settings", SETTINGS)
        pbit.writestr("Metadata", METADATA)
        pbit.writestr("DataModelSchema", json.dumps(DATA_MODEL_SCHEMA, indent=2))
        pbit.writestr("Report/Layout", json.dumps(REPORT_LAYOUT, indent=2))
    print(f"SUCCESS: Generated {PBIT_PATH}")

if __name__ == "__main__":
    create_pbit()
