// Power BI Advanced Editor M-Script for PlayPulse Live Feed
// Paste this into Power BI Desktop -> Home -> Transform Data -> New Source -> Blank Query -> Advanced Editor

let
    // 1. Fetch live JSON payload from local or remote PlayPulse server
    Source = Json.Document(Web.Contents("http://localhost:8080/api/powerbi/feed")),

    
    // Telemetry Table
    telemetry_raw = Source[telemetry],
    telemetry_table = Table.FromList(telemetry_raw, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    telemetry_expanded = Table.ExpandRecordColumn(telemetry_table, "Column1", 
        {"id", "userEmail", "sessionId", "eventType", "appId", "question", "questionCategory", "promptTokens", "completionTokens", "totalTokens", "estimatedCostUsd", "statusCode", "errorMessage", "latencyMs", "createdAt"}, 
        {"id", "userEmail", "sessionId", "eventType", "appId", "question", "questionCategory", "promptTokens", "completionTokens", "totalTokens", "estimatedCostUsd", "statusCode", "errorMessage", "latencyMs", "createdAt"}
    ),
    telemetry_typed = Table.TransformColumnTypes(telemetry_expanded,{
        {"promptTokens", Int64.Type}, 
        {"completionTokens", Int64.Type}, 
        {"totalTokens", Int64.Type}, 
        {"estimatedCostUsd", type number}, 
        {"statusCode", Int64.Type}, 
        {"latencyMs", Int64.Type}, 
        {"createdAt", type datetimezone}
    })
in
    telemetry_typed
