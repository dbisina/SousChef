# Plans and limits

The rule: **only the intensive AI is limited by plan.** Everything social, and everything needed to cook, is free for everyone. The numbers live in two places: `shared/tiers.ts` (the table the app and server both read) and `server/src/ai/limits.ts` (per-feature caps).

## Free for everyone, never gated
Feed, posts, comments, likes, follows, chat, communities, stories, Spools, report and block. Browsing and search. Writing and publishing recipes. Cook mode with timers and hands-free voice (it runs on the phone). Pantry, shopping list, planning a week by hand, waste log, offline saved recipes, nutrition shown on recipes, health logging, games, and chef's special recipes (the old Pro-only lock is gone).

## Light AI (text only, cheap): free, small daily caps
| | Free | Premium | Pro |
|---|---|---|---|
| Ingredient substitutions | 5 | 20 | 60 |
| Ask while cooking | 8 | 30 | 100 |
| Search by sentence | 20 | 60 | 200 |
| Scale notes | 5 | 15 | 40 |
| Leftovers ideas | 2 | 8 | 20 |
| What to cook tonight | 2 | 8 | 20 |
| Chat assist | 5 | 15 | 40 |
| Rewrite a recipe | 1 | 4 | 12 |
| Import from a link or written text | 5 | 15 | 30 |

## Intensive AI (reads photos or video, writes a long plan or report): the only gate
Plate calories and nutrition, plate check, pantry photo scan, photo captions, cookbook-page scan and video-frame import, AI health summary and waste coach.

One **account pool** across all of them, plus each feature's own cap: **Free 3 a week**, Premium 10 a day (5 per feature), Pro 30 a day (15 per feature).

AI meal-plan generation counts apart: Free 1 a week, Premium 3, Pro 10. Mystery Kitchen step pictures (generated images) stay Premium and Pro.

Premium and Pro also remove ads; Pro adds priority support.

## How it feels (the Instagram rule)
Nothing is locked or greyed out. AI screens show a quiet meter ("2 of 3 scans left this week"). When an allowance is used up the person sees a calm note with the date it frees up. The plan sheet opens by itself only when it is polite: not in the first 3 days, not before 3 finished cooks, at most once in 3 days, and not for 7 days after they close it. "See plans" always opens it. The rules live in `mobile/lib/engagement.ts`.

## Asking for a rating
After the 3rd finished cook and 3 days after install, at most once in 120 days, with the system's own rating dialog, the same for everyone (no sentiment filter, no reward). "Send feedback" is always on the Done screen and "Rate enplace" is in Settings > Help.

## The meter
`GET /v1/ai/allowance` returns what is used and when it frees up; the app shows it on the scanner.
