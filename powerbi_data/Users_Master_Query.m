// ==============================================================================
// PLAYPULSE USERS MASTER QUERY (Live Researchers & Engagement Time)
// ==============================================================================

let
    Source = Json.Document(Web.Contents("https://new2-liard.vercel.app/api/powerbi/feed")),
    raw_users = Source[users],
    table_users = Table.FromList(raw_users, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    expanded_users = Table.ExpandRecordColumn(table_users, "Column1", 
        {"id", "email", "createdAt", "lastActiveAt", "totalSessions", "totalDurationSeconds"}, 
        {"UserID", "Email", "FirstSeen", "LastActive", "TotalSessions", "TotalDurationSeconds"}
    ),
    typed_users = Table.TransformColumnTypes(expanded_users,{
        {"TotalSessions", Int64.Type}, 
        {"TotalDurationSeconds", Int64.Type}, 
        {"FirstSeen", type datetimezone}, 
        {"LastActive", type datetimezone}
    }),
    added_minutes = Table.AddColumn(typed_users, "TotalMinutesSpent", each [TotalDurationSeconds] / 60, type number),
    rounded_minutes = Table.TransformColumns(added_minutes,{{"TotalMinutesSpent", each Number.Round(_, 1), type number}})
in
    rounded_minutes
