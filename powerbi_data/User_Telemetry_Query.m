// ==============================================================================
// PLAYPULSE COMPLETE USER RESEARCH & TELEMETRY MASTER QUERY
// Source: https://new2-liard.vercel.app/api/powerbi/feed
// Instructions: Power BI Desktop -> Home -> Transform Data -> New Source -> Blank Query -> Advanced Editor -> Paste All
// ==============================================================================

let
    // 1. Fetch the Live Feed from Vercel
    Source = Json.Document(Web.Contents("https://new2-liard.vercel.app/api/powerbi/feed")),
    
    // 2. Parse Telemetry Events (Tokens, Errors, Questions, Latency)
    raw_telemetry = Source[telemetry],
    table_telemetry = Table.FromList(raw_telemetry, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    expanded_telemetry = Table.ExpandRecordColumn(table_telemetry, "Column1", 
        {"id", "userEmail", "sessionId", "eventType", "appId", "question", "questionCategory", "promptTokens", "completionTokens", "totalTokens", "estimatedCostUsd", "statusCode", "errorMessage", "latencyMs", "createdAt"}, 
        {"EventID", "UserEmail", "SessionID", "EventType", "TargetApp", "UserQuestion", "QuestionCategory", "PromptTokens", "CompletionTokens", "TotalTokens", "CostUSD", "StatusCode", "ErrorMessage", "LatencyMs", "EventTime"}
    ),
    typed_telemetry = Table.TransformColumnTypes(expanded_telemetry,{
        {"PromptTokens", Int64.Type}, 
        {"CompletionTokens", Int64.Type}, 
        {"TotalTokens", Int64.Type}, 
        {"CostUSD", type number}, 
        {"StatusCode", Int64.Type}, 
        {"LatencyMs", Int64.Type}, 
        {"EventTime", type datetimezone}
    })
in
    typed_telemetry
