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

/// Parses a TikTok, Instagram or YouTube link. Returns null if it is not one of those, or not a video.
#[napi]
pub fn parse_video_link(input: String) -> Option<VideoLink> {
    parse(&input).map(|link| VideoLink {
        platform: link.platform.as_str().to_string(),
        canonical: link.canonical(),
        id: link.id,
    })
}
