// ==============================================================================
// PLAYPULSE REVIEWS WAREHOUSE QUERY (Harvested Reviews Intelligence)
// ==============================================================================

let
    Source = Json.Document(Web.Contents("https://new2-liard.vercel.app/api/powerbi/feed")),
    raw_reviews = Source[reviews],
    table_reviews = Table.FromList(raw_reviews, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    expanded_reviews = Table.ExpandRecordColumn(table_reviews, "Column1", 
        {"reviewId", "appId", "userName", "score", "content", "at", "thumbsUp", "version", "sentiment", "detectedCategory", "createdAt"}, 
        {"ReviewID", "AppID", "ReviewerName", "Rating", "ReviewContent", "ReviewDate", "HelpfulVotes", "AppVersion", "Sentiment", "IssueCategory", "HarvestedAt"}
    ),
    typed_reviews = Table.TransformColumnTypes(expanded_reviews,{
        {"Rating", Int64.Type}, 
        {"HelpfulVotes", Int64.Type}, 
        {"ReviewDate", type datetimezone}, 
        {"HarvestedAt", type datetimezone}
    })
in
    typed_reviews
