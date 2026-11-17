# How the feed learns what you like

The For You feed, "Because of ...", "More like this" and Spools order come from one small recommender that lives in the server
(`server/src/recommend/`) and the Rust ranker (`server/native/feed`). No second service, no extra monthly cost.

## What it looks at

**What a dish is** (`features.ts`): its cuisine, meal, difficulty, how long it takes, diets it suits, the main ingredients by what they
are ("finely chopped red onions" is onion; staples such as salt and oil are ignored) and its tags. Each recipe becomes a short list of
numbers; two dishes are alike when their lists point the same way (cosine). Pad Thai is close to Pad See Ew, less so to Bibimbap.

**What a person does** (`events.ts`, `taste.ts`): the app reports, in the background, what was on screen (an *impression*), what was
looked at for three seconds or more (a *view*), likes, saves, shares, starting and finishing a recipe in cook mode, and "not
interested". The server also reads what already existed: recipe likes and saves, ratings, "I made this" photos and posts that share a
recipe. Each counts with a weight (save 2, cooked 3, like 1, hide -2.5, 4-5 star rating for, 1-2 against) that fades with a
21-day half-life. Adding up the dishes gives each person a **taste profile** (`TasteProfile`), rebuilt within a minute of something
new, and never kept longer than half an hour.

## How the feed is ordered

`PostService.forYou` (`server/src/social/posts.ts`) takes the last week's public posts and hands them to the Rust ranker with, for each:
how much people engaged with it and how new it is, whether the viewer follows the author, and four personal numbers:

| Number | Meaning | Effect |
|---|---|---|
| `taste` | how close the dish is to this person's profile (0 to 1) | lifts a post by up to 2.2 times |
| `seen` | times it was shown and ignored | each time costs 40 percent (it sinks, never vanishes) |
| `avoid` | how much they pushed this author away | takes away up to 70 percent |
| `group` | the cuisine | each further post of a cuisine already placed counts 15 percent less, so one cuisine cannot fill the page |

The ranker also pushes down a second post from the same author (45 percent each). A person with nothing recorded gets exactly the
older ranking (popularity, freshness, who they follow). "Not interested" removes that post from their feed at once.

## Privacy

- Per person, only for that person's own feed, never shown to anyone else and never sold.
- Raw events are deleted after 30 days; the profile keeps only the lesson. Everything is deleted with the account.
- Settings > App > **Personalised feed** turns it off: nothing is recorded or used, what was recorded is deleted, and only "not
  interested" choices stay (they are instructions, not observations).
- Health data and health conditions are never used.

## Running it

- `FEED_RANKER=v2` (default) or `v1` (the plain ranking, for comparing or rolling back). Change it in the Railway variables.
- Is it better? An offline replay on invented sessions cannot say. Once there are users, compare v1 and v2: share of posts saved,
  share of recipes cooked, and how long people stay, for the people on each.
- Limits to know: it learns from saved, cooked and viewed dishes, so a new account sees a popularity-led feed until it has done a
  few things; a post with no recipe (a plain photo) has no dish to compare, so only popularity and the author count for it.

## Tests

`server/test/feed-events.test.ts`, `taste.test.ts`, `similar.test.ts`, `server/native/feed` (Rust unit tests),
`mobile/__tests__/feedEvents.test.ts`.
