// ==============================================================================
// PlayPulse — Website Monitoring Dashboard Data Source (Zero Synthetic Baseline)
// Connects to live Vercel Cloud endpoint: https://new2-liard.vercel.app/api/powerbi/monitoring
// ==============================================================================

let
    Source = Json.Document(Web.Contents("https://new2-liard.vercel.app/api/powerbi/monitoring")),
    
    // 1. System Activity Table
    systemActivity_raw = Source[systemActivity],
    systemActivity_table = Table.FromRecords(systemActivity_raw, {"id", "timestamp", "date", "appName", "jobType", "status", "duration", "durationSeconds", "reviewsCollected", "tokens", "errorMessage", "userEmail", "accountType"}, MissingField.UseNull),
    systemActivity_typed = Table.TransformColumnTypes(systemActivity_table, {
        {"timestamp", type datetime},
        {"date", type date},
        {"appName", type text},
        {"jobType", type text},
        {"status", type text},
        {"duration", Int64.Type},
        {"durationSeconds", type number},
        {"reviewsCollected", Int64.Type},
        {"tokens", Int64.Type},
        {"errorMessage", type text},
        {"userEmail", type text},
        {"accountType", type text}
    })
in
    systemActivity_typed
