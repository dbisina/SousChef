//! Orders recent posts for the "for you" feed.
//!
//! The score of a post is how much people engaged with it, faded by age, lifted when the viewer already cares about the
//! author, lifted again when the dish is like what this viewer cooks and saves, pushed down when they have already scrolled
//! past it or said no to the author, and then spread out so one author or one cuisine cannot fill the page. It is deliberately simple arithmetic: the server
//! hands over a few hundred candidates per request, and every rule here can be explained in one sentence.

/// One post, with the numbers the ranking looks at.
#[derive(Debug, Clone, PartialEq)]
pub struct Candidate {
    pub id: String,
    pub author_id: String,
    /// Hours since it was posted. Negative values (clock skew) count as zero.
    pub age_hours: f64,
    pub likes: u32,
    pub comments: u32,
    pub saves: u32,
    pub views: u32,
    /// How much the viewer cares about the author, 0 (a stranger) to 1 (someone they follow). Values outside are clamped.
    pub author_affinity: f64,
    /// A post that shares a recipe is worth a little more in a cooking app.
    pub has_recipe: bool,
    /// How close the dish is to what this viewer likes, 0 (nothing in common, or nothing known yet) to 1. Clamped.
    pub taste: f64,
    /// How much the viewer has pushed this author away ("not interested" on their posts), 0 to 1. Clamped.
    pub avoid: f64,
    /// How many times this viewer has already been shown the post without reacting to it.
    pub seen: u32,
    /// What kind of dish it is (its cuisine), so one kind does not fill the page. Empty: no group.
    pub group: String,
}

/// A save means "I will cook this", the strongest signal; a comment takes effort; a view is nearly free.
fn engagement(c: &Candidate) -> f64 {
    let weighted = f64::from(c.likes) + 2.0 * f64::from(c.comments) + 3.0 * f64::from(c.saves) + 0.1 * f64::from(c.views);
    (1.0 + weighted).ln()
}

/// 1 for a brand new post, 0.5 after about 9 hours, 0.27 after a day, 0.14 after two days, 0.1 after three.
fn freshness(age_hours: f64) -> f64 {
    let age = if age_hours.is_finite() { age_hours.max(0.0) } else { 0.0 };
    (1.0 + age / 12.0).powf(-1.2)
}

/// The score before any author spreading. Always finite and never negative.
pub fn score(c: &Candidate) -> f64 {
    let affinity = if c.author_affinity.is_finite() { c.author_affinity.clamp(0.0, 1.0) } else { 0.0 };
    // The constant lets a post nobody has reacted to yet still reach the top while it is new.
    let base = (engagement(c) + 0.3) * freshness(c.age_hours);
    let recipe = if c.has_recipe { 1.15 } else { 1.0 };
    // Taste can lift a post to about 2.2 times; avoid can take away up to 70%; each time it was shown and ignored costs 40%.
    let taste = if c.taste.is_finite() { c.taste.clamp(0.0, 1.0) } else { 0.0 };
    let avoid = if c.avoid.is_finite() { c.avoid.clamp(0.0, 1.0) } else { 0.0 };
    let stale = SEEN_FALLOFF.powi(c.seen.min(6) as i32);
    base * (1.0 + 1.5 * affinity) * recipe * (1.0 + 1.2 * taste) * (1.0 - 0.7 * avoid) * stale
}

/// Each time a post was shown and ignored, it counts for this much of what it did before.
const SEEN_FALLOFF: f64 = 0.6;
/// Each further post of a kind (cuisine) already placed counts for this much less than the one before.
const SAME_GROUP_FALLOFF: f64 = 0.85;

/// Each further post by an author already placed counts for this much less than the one before.
const SAME_AUTHOR_FALLOFF: f64 = 0.55;

/// Picks up to `limit` posts, best first. Repeats by one author are pushed down, not removed, so a feed of one prolific
/// author still fills. The same input always gives the same order (ties break on the id).
pub fn rank(candidates: &[Candidate], limit: usize) -> Vec<String> {
    let scored: Vec<(f64, &Candidate)> = candidates.iter().map(|c| (score(c), c)).collect();
    let mut taken = vec![false; scored.len()];
    let mut per_author: std::collections::HashMap<&str, i32> = std::collections::HashMap::new();
    let mut per_group: std::collections::HashMap<&str, i32> = std::collections::HashMap::new();
    let mut out = Vec::with_capacity(limit.min(scored.len()));

    while out.len() < limit {
        let mut best: Option<(usize, f64)> = None;
        for (i, (s, c)) in scored.iter().enumerate() {
            if taken[i] {
                continue;
            }
            let seen = per_author.get(c.author_id.as_str()).copied().unwrap_or(0);
            let in_group = if c.group.is_empty() { 0 } else { per_group.get(c.group.as_str()).copied().unwrap_or(0) };
            let adjusted = s * SAME_AUTHOR_FALLOFF.powi(seen) * SAME_GROUP_FALLOFF.powi(in_group);
            let better = match best {
                None => true,
                Some((j, b)) => adjusted > b || (adjusted == b && c.id < scored[j].1.id),
            };
            if better {
                best = Some((i, adjusted));
            }
        }
        let Some((i, _)) = best else { break };
        taken[i] = true;
        *per_author.entry(scored[i].1.author_id.as_str()).or_insert(0) += 1;
        if !scored[i].1.group.is_empty() {
            *per_group.entry(scored[i].1.group.as_str()).or_insert(0) += 1;
        }
        out.push(scored[i].1.id.clone());
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn post(id: &str, author: &str) -> Candidate {
        Candidate { id: id.into(), author_id: author.into(), age_hours: 1.0, likes: 0, comments: 0, saves: 0, views: 0, author_affinity: 0.0, has_recipe: false, taste: 0.0, avoid: 0.0, seen: 0, group: String::new() }
    }

    #[test]
    fn more_engagement_ranks_higher_at_the_same_age() {
        let quiet = post("quiet", "a");
        let liked = Candidate { likes: 40, ..post("liked", "b") };
        assert_eq!(rank(&[quiet, liked], 2), vec!["liked", "quiet"]);
    }

    #[test]
    fn a_save_counts_for_more_than_a_like_and_a_comment_for_more_than_a_like() {
        let like = Candidate { likes: 10, ..post("like", "a") };
        let comment = Candidate { comments: 10, ..post("comment", "b") };
        let save = Candidate { saves: 10, ..post("save", "c") };
        assert_eq!(rank(&[like, comment, save], 3), vec!["save", "comment", "like"]);
    }

    #[test]
    fn newer_ranks_higher_at_the_same_engagement() {
        let old = Candidate { age_hours: 48.0, likes: 20, ..post("old", "a") };
        let new = Candidate { age_hours: 2.0, likes: 20, ..post("new", "b") };
        assert_eq!(rank(&[old, new], 2), vec!["new", "old"]);
    }

    #[test]
    fn a_fresh_modest_post_beats_an_old_popular_one() {
        let old_hit = Candidate { age_hours: 72.0, likes: 500, ..post("old_hit", "a") };
        let fresh = Candidate { age_hours: 1.0, likes: 30, ..post("fresh", "b") };
        assert_eq!(rank(&[old_hit, fresh], 2), vec!["fresh", "old_hit"]);
    }

    #[test]
    fn a_brand_new_post_nobody_has_seen_still_has_a_chance() {
        let unseen = Candidate { age_hours: 0.0, ..post("unseen", "a") };
        let stale = Candidate { age_hours: 120.0, likes: 3, ..post("stale", "b") };
        assert_eq!(rank(&[stale, unseen], 2), vec!["unseen", "stale"]);
    }

    #[test]
    fn people_you_follow_get_a_lift() {
        let stranger = Candidate { likes: 12, ..post("stranger", "a") };
        let friend = Candidate { likes: 6, author_affinity: 1.0, ..post("friend", "b") };
        assert_eq!(rank(&[stranger, friend], 2), vec!["friend", "stranger"]);
    }

    #[test]
    fn a_post_that_shares_a_recipe_gets_a_small_lift_only() {
        let plain = Candidate { likes: 10, ..post("plain", "a") };
        let recipe = Candidate { likes: 10, has_recipe: true, ..post("recipe", "b") };
        assert_eq!(rank(&[plain.clone(), recipe.clone()], 2), vec!["recipe", "plain"]);
        let far_more_liked = Candidate { likes: 80, ..post("popular", "c") };
        assert_eq!(rank(&[recipe, far_more_liked], 2)[0], "popular");
    }

    #[test]
    fn one_author_cannot_fill_the_top_of_the_feed() {
        let mut posts: Vec<Candidate> = (0..4).map(|i| Candidate { likes: 50, ..post(&format!("a{i}"), "prolific") }).collect();
        posts.push(Candidate { likes: 30, ..post("b1", "other") });
        posts.push(Candidate { likes: 30, ..post("c1", "third") });
        let order = rank(&posts, 6);
        // The best of the prolific author, then the others get in before the author's second post.
        assert_eq!(order[0], "a0");
        let second_a = order.iter().position(|id| id.starts_with('a') && id != "a0").unwrap();
        assert!(order.iter().position(|id| id == "b1").unwrap() < second_a);
        assert!(order.iter().position(|id| id == "c1").unwrap() < second_a);
    }

    #[test]
    fn a_feed_of_one_author_still_fills() {
        let posts: Vec<Candidate> = (0..5).map(|i| Candidate { age_hours: f64::from(i), ..post(&format!("p{i}"), "only") }).collect();
        assert_eq!(rank(&posts, 5).len(), 5);
    }

    #[test]
    fn respects_the_limit_and_handles_nothing() {
        let posts: Vec<Candidate> = (0..10).map(|i| post(&format!("p{i}"), &format!("a{i}"))).collect();
        assert_eq!(rank(&posts, 3).len(), 3);
        assert_eq!(rank(&posts, 0), Vec::<String>::new());
        assert_eq!(rank(&[], 5), Vec::<String>::new());
        assert_eq!(rank(&posts, 99).len(), 10);
    }

    #[test]
    fn the_same_input_always_gives_the_same_order_and_ties_break_on_the_id() {
        let posts = vec![post("b", "x"), post("a", "y"), post("c", "z")];
        assert_eq!(rank(&posts, 3), vec!["a", "b", "c"]);
        let reversed: Vec<Candidate> = posts.iter().rev().cloned().collect();
        assert_eq!(rank(&reversed, 3), vec!["a", "b", "c"]);
    }

    #[test]
    fn odd_numbers_do_not_break_it() {
        let weird = Candidate { age_hours: f64::NAN, author_affinity: f64::INFINITY, ..post("weird", "a") };
        let negative_age = Candidate { age_hours: -50.0, ..post("future", "b") };
        let huge = Candidate { likes: u32::MAX, comments: u32::MAX, saves: u32::MAX, views: u32::MAX, age_hours: 1e12, ..post("huge", "c") };
        for c in [&weird, &negative_age, &huge] {
            let s = score(c);
            assert!(s.is_finite() && s >= 0.0, "{} scored {s}", c.id);
        }
        assert_eq!(rank(&[weird, negative_age, huge], 3).len(), 3);
    }

    #[test]
    fn freshness_fades_smoothly() {
        assert!((freshness(0.0) - 1.0).abs() < 1e-12);
        assert!(freshness(12.0) > freshness(24.0) && freshness(24.0) > freshness(72.0));
        assert!(freshness(9.4) > 0.48 && freshness(9.4) < 0.52, "half-life is about 9 hours");
        assert!(freshness(24.0) > 0.25 && freshness(24.0) < 0.29);
        assert_eq!(freshness(-5.0), 1.0);
    }

    #[test]
    fn a_dish_like_what_the_viewer_cooks_ranks_higher() {
        let other = Candidate { likes: 10, ..post("other", "a") };
        let liked_kind = Candidate { likes: 6, taste: 0.9, ..post("liked_kind", "b") };
        assert_eq!(rank(&[other.clone(), liked_kind], 2), vec!["liked_kind", "other"]);
        // taste is a lift, not a takeover: a far more popular dish still wins over a mild match
        let hit = Candidate { likes: 400, ..post("hit", "c") };
        let mild = Candidate { likes: 6, taste: 0.4, ..post("mild", "d") };
        assert_eq!(rank(&[mild, hit], 2)[0], "hit");
    }

    #[test]
    fn a_post_already_shown_and_ignored_drops_each_time() {
        let fresh = Candidate { likes: 20, ..post("fresh", "a") };
        let seen_once = Candidate { likes: 20, seen: 1, ..post("seen_once", "b") };
        let seen_thrice = Candidate { likes: 20, seen: 3, ..post("seen_thrice", "c") };
        assert_eq!(rank(&[seen_thrice, seen_once, fresh], 3), vec!["fresh", "seen_once", "seen_thrice"]);
        assert!(score(&Candidate { seen: 6, ..post("x", "a") }) > 0.0, "it never disappears, it only sinks");
    }

    #[test]
    fn an_author_the_viewer_pushed_away_sinks() {
        let wanted = Candidate { likes: 10, ..post("wanted", "a") };
        let avoided = Candidate { likes: 30, avoid: 1.0, ..post("avoided", "b") };
        assert_eq!(rank(&[avoided, wanted], 2), vec!["wanted", "avoided"]);
    }

    #[test]
    fn one_cuisine_cannot_fill_the_top_of_the_feed() {
        let mut posts: Vec<Candidate> = (0..4).map(|i| Candidate { likes: 40, group: "italian".into(), ..post(&format!("it{i}"), &format!("a{i}")) }).collect();
        posts.push(Candidate { likes: 30, group: "thai".into(), ..post("th", "t") });
        posts.push(Candidate { likes: 30, group: "mexican".into(), ..post("mx", "m") });
        let order = rank(&posts, 6);
        let second_italian = order.iter().position(|id| id.starts_with("it") && id != "it0").unwrap();
        assert!(order.iter().position(|id| id == "th").unwrap() < second_italian + 1);
        assert!(order.iter().position(|id| id == "mx").unwrap() < second_italian + 2);
        assert_eq!(rank(&posts, 6).len(), 6, "a page of one cuisine still fills");
    }

    #[test]
    fn nothing_known_about_the_viewer_changes_nothing() {
        let a = Candidate { likes: 5, ..post("a", "x") };
        let b = Candidate { likes: 9, ..post("b", "y") };
        assert_eq!(rank(&[a.clone(), b.clone()], 2), vec!["b", "a"]);
        assert!((score(&a) - score(&Candidate { taste: 0.0, avoid: 0.0, seen: 0, ..a.clone() })).abs() < 1e-12);
    }

    #[test]
    fn odd_taste_numbers_do_not_break_it() {
        for c in [
            Candidate { taste: f64::NAN, ..post("nan", "a") },
            Candidate { taste: f64::INFINITY, avoid: f64::NEG_INFINITY, ..post("inf", "b") },
            Candidate { taste: -4.0, avoid: 9.0, seen: u32::MAX, ..post("range", "c") },
        ] {
            let s = score(&c);
            assert!(s.is_finite() && s >= 0.0, "{} scored {s}", c.id);
        }
    }
}
