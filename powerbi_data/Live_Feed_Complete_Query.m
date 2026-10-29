// Complete Power Query M-Script for PlayPulse Live Feed with all Health & Failure Metrics
// In Power Query Editor -> Click "Advanced Editor" -> Replace everything with this:

let
    Source = Json.Document(Web.Contents("https://new2-liard.vercel.app/api/powerbi/feed")),
    summary = Source[summary],
    #"Converted to Table" = Record.ToTable(summary),
    #"Pivoted Column" = Table.Pivot(#"Converted to Table", List.Distinct(#"Converted to Table"[Name]), "Name", "Value")
in
    #"Pivoted Column"
