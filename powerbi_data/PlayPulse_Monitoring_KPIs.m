// ==============================================================================
// PlayPulse — 6 KPI Cards Table
// Connects to live Vercel Cloud endpoint: https://new2-liard.vercel.app/api/powerbi/kpis
// ==============================================================================

let
    Source = Json.Document(Web.Contents("https://new2-liard.vercel.app/api/powerbi/kpis")),
    table = Table.FromRecords(Source, {"Metric", "Value", "Description"}, MissingField.UseNull),
    typed = Table.TransformColumnTypes(table, {
        {"Metric", type text},
        {"Value", type number},
        {"Description", type text}
    })
in
    typed
