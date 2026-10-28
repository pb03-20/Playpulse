// ==============================================================================
// PLAYPULSE SESSIONS MASTER QUERY (Live Lurking & Session Duration)
// ==============================================================================

let
    Source = Json.Document(Web.Contents("https://new2-liard.vercel.app/api/powerbi/feed")),
    raw_sessions = Source[sessions],
    table_sessions = Table.FromList(raw_sessions, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    expanded_sessions = Table.ExpandRecordColumn(table_sessions, "Column1", 
        {"id", "userEmail", "startedAt", "lastPingAt", "durationSeconds", "appResearched", "questionsCount"}, 
        {"SessionID", "UserEmail", "StartedAt", "LastPingAt", "DurationSeconds", "AppResearched", "QuestionsCount"}
    ),
    typed_sessions = Table.TransformColumnTypes(expanded_sessions,{
        {"DurationSeconds", Int64.Type}, 
        {"QuestionsCount", Int64.Type}, 
        {"StartedAt", type datetimezone}, 
        {"LastPingAt", type datetimezone}
    }),
    added_minutes = Table.AddColumn(typed_sessions, "DurationMinutes", each [DurationSeconds] / 60, type number),
    // Classify Lurker vs Active Researcher:
    // If user spent > 5 minutes but asked 0 or 1 question -> "Lurking / Reading Reviews"
    // If user asked >= 2 questions -> "Active AI Researcher"
    added_engagement = Table.AddColumn(added_minutes, "EngagementType", each 
        if [QuestionsCount] = 0 then "Lurking (Reading Only)"
        else if [QuestionsCount] <= 2 then "Casual Explorer"
        else "Deep AI Researcher", type text
    )
in
    added_engagement
