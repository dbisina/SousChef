#![deny(clippy::all)]

use napi_derive::napi;
use souschef_links::parse;

/// What a link points at. See `souschef-links` for the rules.
#[napi(object)]
pub struct VideoLink {
    /// "youtube", "tiktok" or "instagram".
    pub platform: String,
    /// The platform's video id, or the short code when `canonical` is null.
    pub id: String,
    /// Stable cache key such as "youtube:dQw4w9WgXcQ". Null for a short link that must be resolved by following
    /// its redirect once and parsing the final address.
    pub canonical: Option<String>,
}

/// One post to be ranked. See `souschef-feed` for how the numbers are used.
#[napi(object)]
pub struct FeedCandidate {
    pub id: String,
    pub author_id: String,
    pub age_hours: f64,
    pub likes: u32,
    pub comments: u32,
    pub saves: u32,
    pub views: u32,
    pub author_affinity: f64,
    pub has_recipe: bool,
}

/// Orders posts for the "for you" feed and returns the ids of the best `limit`, best first.
#[napi]
pub fn rank_feed(candidates: Vec<FeedCandidate>, limit: u32) -> Vec<String> {
    let posts: Vec<souschef_feed::Candidate> = candidates
        .into_iter()
        .map(|c| souschef_feed::Candidate {
            id: c.id,
            author_id: c.author_id,
            age_hours: c.age_hours,
            likes: c.likes,
            comments: c.comments,
            saves: c.saves,
            views: c.views,
            author_affinity: c.author_affinity,
            has_recipe: c.has_recipe,
        })
        .collect();
    souschef_feed::rank(&posts, limit as usize)
}

/// Parses a TikTok, Instagram or YouTube link. Returns null if it is not one of those, or not a video.
#[napi]
pub fn parse_video_link(input: String) -> Option<VideoLink> {
    parse(&input).map(|link| VideoLink {
        platform: link.platform.as_str().to_string(),
        canonical: link.canonical(),
        id: link.id,
    })
}
