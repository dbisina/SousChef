//! Turns a link to a video on TikTok, Instagram or YouTube into a stable key.
//!
//! The same video is shared as many different links (short links, tracking parameters, mobile hosts, a username in
//! the path). Recipe import caches what it extracted per video, so the cache key must be the platform's own video
//! id and nothing else. This is pure string work, no network.
//!
//! Short links (`vm.tiktok.com/ZMabc`, `tiktok.com/t/ZMabc`, Instagram `share` links) only name a redirect, not a
//! video. They parse with `resolved = false`; the caller follows the redirect once and parses the final address.

use url::Url;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Platform {
    Youtube,
    Tiktok,
    Instagram,
}

impl Platform {
    pub fn as_str(self) -> &'static str {
        match self {
            Platform::Youtube => "youtube",
            Platform::Tiktok => "tiktok",
            Platform::Instagram => "instagram",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VideoLink {
    pub platform: Platform,
    /// The platform's video id, or the short code when `resolved` is false.
    pub id: String,
    /// False for a short link that has to be resolved by following its redirect.
    pub resolved: bool,
}

impl VideoLink {
    /// The cache key, like `youtube:dQw4w9WgXcQ`. None while the link is unresolved.
    pub fn canonical(&self) -> Option<String> {
        self.resolved
            .then(|| format!("{}:{}", self.platform.as_str(), self.id))
    }
}

const MAX_INPUT: usize = 2048;

pub fn parse(input: &str) -> Option<VideoLink> {
    let input = input.trim();
    if input.is_empty() || input.len() > MAX_INPUT || input.chars().any(char::is_whitespace) {
        return None;
    }
    let with_scheme;
    let text = if input.contains("://") {
        input
    } else {
        with_scheme = format!("https://{input}");
        &with_scheme
    };
    let url = Url::parse(text).ok()?;
    if !matches!(url.scheme(), "http" | "https") {
        return None;
    }
    let host = url.host_str()?.to_ascii_lowercase();
    let segments: Vec<&str> = url.path_segments()?.filter(|s| !s.is_empty()).collect();

    if host_is(&host, "youtu.be") {
        return youtube(segments.first().copied()?);
    }
    if host_is(&host, "youtube.com") || host_is(&host, "youtube-nocookie.com") {
        return youtube_site(&url, &segments);
    }
    if host_is(&host, "tiktok.com") {
        let short_host = host == "vm.tiktok.com" || host == "vt.tiktok.com";
        return tiktok(&segments, short_host);
    }
    if host_is(&host, "instagram.com") || host_is(&host, "instagr.am") {
        return instagram(&segments);
    }
    None
}

/// `host` is `domain` or one of its subdomains (`www.`, `m.`, `music.`, ...), and not a look-alike such as `eviltiktok.com`.
fn host_is(host: &str, domain: &str) -> bool {
    host == domain || host.strip_suffix(domain).is_some_and(|rest| rest.ends_with('.'))
}

fn video(platform: Platform, id: &str) -> VideoLink {
    VideoLink { platform, id: id.to_string(), resolved: true }
}

fn short(platform: Platform, code: &str) -> VideoLink {
    VideoLink { platform, id: code.to_string(), resolved: false }
}

fn youtube(id: &str) -> Option<VideoLink> {
    let valid = id.len() == 11 && id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-');
    valid.then(|| video(Platform::Youtube, id))
}

fn youtube_site(url: &Url, segments: &[&str]) -> Option<VideoLink> {
    match *segments.first()? {
        "watch" => {
            let (_, v) = url.query_pairs().find(|(k, _)| k == "v")?;
            youtube(&v)
        }
        "shorts" | "embed" | "live" | "v" => youtube(segments.get(1)?),
        _ => None,
    }
}

fn tiktok(segments: &[&str], short_host: bool) -> Option<VideoLink> {
    if short_host {
        let code = *segments.first()?;
        return is_code(code, 4).then(|| short(Platform::Tiktok, code));
    }
    let numeric = |s: &str| (8..=25).contains(&s.len()) && s.bytes().all(|b| b.is_ascii_digit());
    match segments {
        // /@name/video/7234567890123456789 (also /@name/photo/...: a photo post, not a video, is not handled)
        [user, "video", id, ..] if user.starts_with('@') && numeric(id) => Some(video(Platform::Tiktok, id)),
        // /embed/v2/7234567890123456789
        ["embed", "v2", id, ..] if numeric(id) => Some(video(Platform::Tiktok, id)),
        // /v/7234567890123456789.html
        ["v", id, ..] => {
            let id = id.strip_suffix(".html").unwrap_or(id);
            numeric(id).then(|| video(Platform::Tiktok, id))
        }
        // /t/ZMabcdef
        ["t", code, ..] if is_code(code, 4) => Some(short(Platform::Tiktok, code)),
        _ => None,
    }
}

fn instagram(segments: &[&str]) -> Option<VideoLink> {
    // Share links (/share/reel/XYZ) carry a share id, not the shortcode: resolve the redirect first.
    if let [first, kind, code, ..] = segments {
        if *first == "share" && matches!(*kind, "reel" | "p" | "tv") && is_code(code, 4) {
            return Some(short(Platform::Instagram, code));
        }
    }
    // /reel/CODE, /p/CODE, /tv/CODE, /reels/CODE, or the same after a username: /name/reel/CODE
    let at = segments.iter().position(|s| matches!(*s, "reel" | "reels" | "p" | "tv"))?;
    let code = *segments.get(at + 1)?;
    is_code(code, 5).then(|| video(Platform::Instagram, code))
}

fn is_code(code: &str, min: usize) -> bool {
    code.len() >= min && code.len() <= 64 && code.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}

#[cfg(test)]
mod tests {
    use super::*;

    fn key(input: &str) -> Option<String> {
        parse(input).and_then(|l| l.canonical())
    }

    #[test]
    fn youtube_in_all_its_shapes() {
        let want = Some("youtube:dQw4w9WgXcQ".to_string());
        for link in [
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PL123",
            "https://m.youtube.com/watch?feature=share&v=dQw4w9WgXcQ",
            "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtu.be/dQw4w9WgXcQ",
            "https://youtu.be/dQw4w9WgXcQ?si=abcdEFGH",
            "https://www.youtube.com/shorts/dQw4w9WgXcQ",
            "https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0",
            "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
            "https://www.youtube.com/live/dQw4w9WgXcQ",
            "youtube.com/watch?v=dQw4w9WgXcQ",
            "  https://youtu.be/dQw4w9WgXcQ  ",
            "HTTPS://YOUTU.BE/dQw4w9WgXcQ",
        ] {
            assert_eq!(key(link), want, "{link}");
        }
    }

    #[test]
    fn youtube_ids_are_case_sensitive() {
        assert_eq!(key("https://youtu.be/AbCdEfGhIjK"), Some("youtube:AbCdEfGhIjK".to_string()));
    }

    #[test]
    fn rejects_bad_youtube_links() {
        for link in [
            "https://www.youtube.com/watch",
            "https://www.youtube.com/watch?v=short",
            "https://www.youtube.com/watch?v=has spaces!",
            "https://www.youtube.com/",
            "https://www.youtube.com/channel/UC123",
            "https://youtu.be/",
            "https://youtu.be/dQw4w9WgXc!",
        ] {
            assert_eq!(parse(link), None, "{link}");
        }
    }

    #[test]
    fn tiktok_full_links() {
        let want = Some("tiktok:7234567890123456789".to_string());
        for link in [
            "https://www.tiktok.com/@chef.ama/video/7234567890123456789",
            "https://www.tiktok.com/@chef.ama/video/7234567890123456789?is_from_webapp=1&sender_device=pc",
            "https://m.tiktok.com/@chef.ama/video/7234567890123456789",
            "tiktok.com/@chef.ama/video/7234567890123456789",
            "https://www.tiktok.com/embed/v2/7234567890123456789",
            "https://www.tiktok.com/v/7234567890123456789.html",
        ] {
            assert_eq!(key(link), want, "{link}");
        }
    }

    #[test]
    fn tiktok_short_links_need_resolving() {
        for (link, code) in [
            ("https://vm.tiktok.com/ZMabc123/", "ZMabc123"),
            ("https://vt.tiktok.com/ZSabc123/", "ZSabc123"),
            ("https://www.tiktok.com/t/ZMabc123/", "ZMabc123"),
        ] {
            let parsed = parse(link).unwrap_or_else(|| panic!("{link}"));
            assert_eq!(parsed.platform, Platform::Tiktok);
            assert_eq!(parsed.id, code);
            assert!(!parsed.resolved, "{link}");
            assert_eq!(parsed.canonical(), None);
        }
    }

    #[test]
    fn rejects_bad_tiktok_links() {
        for link in [
            "https://www.tiktok.com/@chef.ama",
            "https://www.tiktok.com/@chef.ama/video/notanumber",
            "https://www.tiktok.com/@chef.ama/video/123",
            "https://www.tiktok.com/discover",
            "https://vm.tiktok.com/",
        ] {
            assert_eq!(parse(link), None, "{link}");
        }
    }

    #[test]
    fn instagram_in_all_its_shapes() {
        let want = Some("instagram:CxYz123AbCd".to_string());
        for link in [
            "https://www.instagram.com/reel/CxYz123AbCd/",
            "https://www.instagram.com/reel/CxYz123AbCd/?igsh=MWQxZGU",
            "https://instagram.com/reels/CxYz123AbCd",
            "https://www.instagram.com/p/CxYz123AbCd/",
            "https://www.instagram.com/tv/CxYz123AbCd/",
            "https://www.instagram.com/chef.ama/reel/CxYz123AbCd/",
            "https://instagr.am/p/CxYz123AbCd",
            "instagram.com/reel/CxYz123AbCd",
        ] {
            assert_eq!(key(link), want, "{link}");
        }
    }

    #[test]
    fn instagram_codes_are_case_sensitive() {
        assert_ne!(key("https://www.instagram.com/p/AAAAAAAAAA/"), key("https://www.instagram.com/p/aaaaaaaaaa/"));
    }

    #[test]
    fn instagram_share_links_need_resolving() {
        let parsed = parse("https://www.instagram.com/share/reel/BAbc12De/").unwrap();
        assert_eq!(parsed.platform, Platform::Instagram);
        assert!(!parsed.resolved);
        assert_eq!(parsed.canonical(), None);
    }

    #[test]
    fn rejects_bad_instagram_links() {
        for link in [
            "https://www.instagram.com/",
            "https://www.instagram.com/chef.ama/",
            "https://www.instagram.com/reel/",
            "https://www.instagram.com/reel/ab/",
            "https://www.instagram.com/stories/chef.ama/123/",
        ] {
            assert_eq!(parse(link), None, "{link}");
        }
    }

    #[test]
    fn not_a_video_link_at_all() {
        for link in [
            "",
            "   ",
            "hello",
            "https://example.com/watch?v=dQw4w9WgXcQ",
            "ftp://youtu.be/dQw4w9WgXcQ",
            "javascript:alert(1)",
            "https://eviltiktok.com/@a/video/7234567890123456789",
            "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ",
            "https://notyoutu.be/dQw4w9WgXcQ",
            "https://youtu.be/dQw4w9WgXcQ extra words",
        ] {
            assert_eq!(parse(link), None, "{link}");
        }
    }

    #[test]
    fn very_long_input_is_refused() {
        let long = format!("https://youtu.be/{}", "a".repeat(5000));
        assert_eq!(parse(&long), None);
    }
}
