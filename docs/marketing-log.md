# SousChef marketing log
- 2026-11-16: Recipes imported from TikTok, Instagram and YouTube are now read by watching the video itself on the server (no screenshots), and typing what you want to cook searches the web for a real recipe.
- 2026-11-16: Game questions come with real, licence-checked photos of the dish; solo Mystery Kitchen starts straight away; people pick their own @username and follower counts are real.
- 2026-11-16: Home header redone (plus button, centred name), proper settings icon, bug report and developer contact, back-to-home from cooking fixed, the app's own food photos are back on Meal Plan, Pantry and Shopping.

One place to turn what we build into posts. Every feature gets a block; every commit that ships something adds a line to
the **build diary** at the bottom. If a feature is not honest to show yet, its status says so.

**How to use a block:** the *hook* is the first line of a post. The three *post ideas* are different formats of the same
feature (a short video, a carousel, a story or build-in-public post). *Show* says what to screen-record. *Careful* is what
we must not overclaim.

**Status words:** `built` (code written), `tested` (automated tests pass), `device-check` (still needs a real phone before
we film it), `needs-keys` (needs a real AI/payment account to work for real).

**Voice:** warm, plain, cook-first. SousChef helps you waste less, spend less and cook more. Never pretend official
accounts are people. Health content is numbers only, never advice.

---

## 1. Turn any video into a recipe
**What:** paste a TikTok, Instagram, YouTube or recipe-site link; get a clean recipe (ingredients, steps, times). A link
someone already imported costs nothing (it is cached).
**Hook:** "You saved 400 cooking videos. You cooked zero. Here is the fix."
**Post ideas**
1. *Reel (15s):* screen-record pasting a TikTok link, recipe appears; caption "Saved. Cooked. Done."
2. *Carousel:* "3 videos that never had a written recipe" (before: video, after: recipe card).
3. *Build-in-public:* "Our importer reads the caption, the page data, then asks AI. If it can't find a recipe it asks for a few frames instead of making one up."
**Show:** the paste, the progress text, the finished recipe, saving it to Want to Cook.
**Careful:** quality depends on the video's caption; videos with no recipe in the caption need frames. `built, tested, needs-keys`.

## 2. Cook from what you already have (pantry)
**What:** add your pantry (with expiry dates); recipes are ranked by how much you already own; expiring food is flagged.
**Hook:** "What can I make with an onion, rice and sad tomatoes?"
**Post ideas**
1. *Reel:* open fridge, add 5 items, tap Cook from pantry, pick the 92% match.
2. *Carousel:* "5 dinners from the back of your cupboard."
3. *Story poll:* "What is in your fridge right now?" then cook the winner.
**Show:** the match percentage, "missing: 1 item".
**Careful:** matching is by ingredient names, not amounts. `built, tested`.

## 3. AI meal plans that remember your pantry
**What:** a Pro feature. The AI chooses a week of meals from real recipes, uses what expires first, and the server builds the shopping list. Allergies and diets are enforced in code, not trusted to the AI.
**Hook:** "A meal plan that checks your fridge before it checks your calendar."
**Post ideas**
1. *Reel:* tap Generate, a week appears, shopping list shows "Already in pantry".
2. *Carousel:* "How our planner never serves you peanuts" (the AI proposes, code enforces).
3. *Build-in-public:* "The AI picks the meals. Our code does the maths. We don't let a model count your groceries."
**Show:** expiring item used first, shopping list with "to buy" amounts.
**Careful:** Pro only; planning quality needs a real model to judge. `built, tested, needs-keys`.

## 4. Shopping list that subtracts your pantry
**What:** the list shows what to buy after what you own; tick items off; it is saved on your account.
**Hook:** "Stop buying a third jar of cumin."
**Post ideas:** 1. Reel: list vs pantry side by side. 2. Carousel: "Things you already own (you checked)". 3. Story: poll "How many jars of paprika do you own?".
`built, tested`.

## 5. Food waste tracker
**What:** log what you throw away and why; see the money wasted, top wasted items and whether you are improving.
**Hook:** "I tracked my food waste for a month. The number was embarrassing."
**Post ideas:** 1. Reel: log a wilted spinach, see the monthly total. 2. Carousel: "The 5 foods we all throw away." 3. Challenge: "Zero waste week" with the in-app tracker.
**Careful:** the money value is what you enter. `built, tested`.

## 6. Calories and nutrition
**What:** nutrition is calculated from the ingredients on the server, so every phone and the server give the same numbers.
**Hook:** "Same recipe, same numbers, on every phone."
**Post ideas:** 1. Reel: scale servings, calories update. 2. Carousel: "What 'healthy' dinner really adds up to." 3. Build-in-public: "One calorie table shared by app and server."
`built, tested`.

## 7. Daily Dish (the daily guessing game)
**What:** one dish a day from ingredient clues, 6 guesses, streaks, a leaderboard of friends. The answer stays on the server so nobody can peek.
**Hook:** "Wordle, but you're hungry."
**Post ideas:** 1. Reel: the clue reveal and the win. 2. Story: share the streak card, tag a friend. 3. Daily series: post clue #1 and ask people to guess in comments, reveal tomorrow.
**Show:** clue costs points, streak flame. `built, tested, device-check`.

## 8. Mystery Kitchen (cook-off with an AI judge)
**What:** solo or up to 10 friends get the same secret basket and a twist; hints cost points; photograph your plate and an AI judge scores it. If the judge is down, everyone gets a fair-play score.
**Hook:** "Cook blind. Your friends judge nothing. The AI judges everything."
**Post ideas:** 1. Reel: the countdown, the twist card, the reveal. 2. Carousel: "Our AI judge roasted my plating." 3. Event: "Mystery Kitchen Friday" with a room code in the caption.
**Careful:** judge quality needs a real vision model; scores are for fun. `built, tested, needs-keys, device-check`.

## 9. Private health tracking (glucose, blood pressure, meals)
**What:** log readings and meals; see how a meal moved your glucose; one-tap doctor report. Needs your consent, stored encrypted, you can export or delete everything. Numbers only, no medical advice.
**Hook:** "Your health numbers, locked, and yours to delete."
**Post ideas:** 1. Reel: log a reading, see the meal response. 2. Carousel: "What to bring to your next doctor visit." 3. Trust post: "How we protect health data" (encryption, consent, delete).
**Careful:** never claim treatment or diagnosis. `built, tested, device-check`.

## 10. Voice notes, pictures and live chat
**What:** real-time chat with typing, read ticks, voice notes (tap to record, tap to send) and pictures. Messages catch up after you lose signal.
**Hook:** "Send the recipe, not a screenshot."
**Post ideas:** 1. Reel: send a recipe card and a voice note. 2. Story: "Cooking together" in a group chat. 3. Build-in-public: "How chat catches up after a tunnel."
`built, tested, device-check`.

## 11. Stories and the feed
**What:** share a plate for 24 hours; a feed of posts from people you follow and ones picked for you (ranked in Rust: freshness, saves, who you follow, no one author filling the page).
**Hook:** "Post your plate. It disappears. Your recipe doesn't."
**Post ideas:** 1. Reel: post a story, see viewers. 2. Carousel: "Why you won't see one chef 10 times in a row." 3. Build-in-public: "Our feed ranker is 200 lines of Rust."
`built, tested, device-check`.

## 12. Communities and challenges
**What:** groups around a cuisine or a goal, each with a chat, posts, challenges and events.
**Hook:** "Find your people. Cook the same dish. Compare."
**Post ideas:** 1. Reel: join, enter a weekly challenge. 2. Carousel: "5 community ideas to start today." 3. Launch post: "Be a founding community host."
`built, tested, device-check`.

## 13. Invite friends, get a free Pro month
**What:** share your code; when friends do a real action (save or post), you and they earn Pro time. Capped to stop abuse.
**Hook:** "Free Pro for cooking with your friends."
**Post ideas:** 1. Reel: share the code. 2. Carousel: "How to earn a month of Pro in a weekend." 3. Story countdown: "Last day to double invite week."
**Careful:** state the cap honestly. `built, tested`.

## 14. Verified chefs
**What:** paid members can apply for a verified-chef badge after staff review.
**Hook:** "A badge you earn, not buy."
**Post ideas:** 1. Chef spotlight series. 2. Carousel: "What staff look for." 3. Outreach post to cooks with a portfolio.
**Careful:** the badge needs a paid plan and review; do not imply paying buys trust. `built, tested`.

## 15. Official SousChef accounts (clearly labelled)
**What:** SousChef can post as a labelled official account (never pretending to be a person) so the feed is not empty on day one.
**Hook (careful tone):** "New here? These are our official kitchens."
**Careful:** always labelled official. No fake people, no fake reviews. `built, tested`.

## 16. Safety by design
**What:** two layers: quick rules (spam links, banned words) when you post, then an AI check after publishing that hides clear problems for staff to review. Staff can suspend accounts; people can report anything.
**Hook:** "A kitchen community that stays kind."
**Post ideas:** 1. Trust carousel: "How we keep SousChef friendly." 2. Reel: report a post, see it handled. 3. Build-in-public: "Post first, check after: why."
`built, tested`.

## 17. Swap an ingredient with AI
**What:** out of cream? get 3 to 5 substitutes, never one you can't eat, and marked if you already own it.
**Hook:** "No buttermilk? Don't run to the shop."
**Post ideas:** 1. Reel: tap a missing ingredient, swap. 2. Carousel: "10 swaps that actually work." 3. Poll: "Worst substitution you've tried?"
`built, tested, needs-keys`.

## 18. Scan a cookbook page
**What:** photograph a printed recipe (up to 8 pages of the same recipe); get a clean digital one. The photos are deleted after reading.
**Hook:** "Grandma's recipe card, rescued."
**Post ideas:** 1. Reel: scan, save, cook. 2. Heartfelt story: scanning a family cookbook. 3. Carousel: "Digitise your family recipes in 5 minutes."
`built, tested, needs-keys`.

## 19. Run on a tiny budget (build in public)
**What:** the whole backend runs on one small server with a hard monthly cap on AI spend; backups are encrypted; there is a restore test.
**Hook:** "How we run an AI cooking app for the price of a lunch."
**Post ideas:** 1. Build-in-public thread: costs and the hard budget stop. 2. Carousel: "What a $10 server can do." 3. Behind the scenes: "We test restores, not just backups."
**Careful:** costs are targets until we measure on the real server. `built, tested (deploy not run)`.

## 20. Cook for 5 or 50 (scale that learns from real cooks)
**What:** pick how many people you are cooking for and get the recipe scaled, in your units and oven temperature. Salt, spice, baking powder and liquids are not just multiplied (they do not scale in a straight line), and you get pan size and timing tips. Every answer is labelled: "From cooks who made it", "AI estimate", "Based on other cooks" or "Maths only". Creators and people who cooked a recipe can add how they scaled it for N people, and those notes teach the next answer. Small changes (a few more servings) use plain maths and cost nothing.
**Hook:** "Doubling a recipe is not just x2. Here is what the salt really does."
**Post ideas:** 1. Reel: jollof for 4 vs 40, side by side, with the salt and pan differences called out. 2. Carousel: "Why you should never just multiply the spices." 3. Creator call-out: "Cooked this for a crowd? Add your numbers: you are teaching the app." 4. Build-in-public: "Our scaling gets better with every cook who shares" (explain the ratios, no personal data).
**Show:** the headcount stepper, the source badge changing as more cooks add notes, the "add how you scaled it" step when posting.
**Careful:** AI estimates are estimates (taste and adjust); quantities written inside the steps are not rewritten; allergy or medical claims are never made. Needs a real model key and real cooks' notes to show its value. `built, tested with fake AI, needs-keys`.

---

# New AI features (planned, being built; each moves to a full block when shipped)

| Feature | One-line hook | Status |
|---|---|---|
| Pantry by photo (fridge or receipt) | "Photograph your receipt. Your pantry fills itself." | planned |
| What can I cook tonight? | "One tap, one dinner, and why." | planned |
| Waste coach | "Your fridge, honestly reviewed." | planned |
| Leftover rescue | "Half a chicken and sad rice? Three ideas." | planned |
| Cook-along assistant | "Ask the recipe a question mid-cooking." | planned |
| Scale and convert | "Serves 4 to serves 9, in your units." | built (server), see block 20; app screen to do |
| Plate check | "Friendly feedback on how it looks." | planned |
| Recipe rewriter | "Make it vegan, or under 500 calories." | planned |
| Weekly health summary | "Your numbers in plain words (no advice)." | planned |
| Meal-to-glucose insight | "Which dinners kept you steadier." | planned |
| Budget-aware plans | "Plan the week under your budget." | planned |
| Shopping by aisle | "Your list in the order of the shop." | planned |
| Family mode | "One plan, everyone's diet." | planned |
| Caption helper | "Great photo, no words? Done." | planned |
| Chat reply helper and summaries | "Catch up on a 200-message chat in 5 lines." | planned |
| Smarter moderation (images) | "Safer feed, quietly." | planned |
| Search that understands you | "Light, chicken, under 30 minutes, no oven." | planned |
| Pantry by photo (fridge or receipt) | "Photograph your receipt. Your pantry fills itself." | built (server + app), needs device check |
| What can I cook tonight? | "One tap, one dinner, and why." | built (server + app), needs device check |
| Waste coach | "Your fridge, honestly reviewed." | built (server + app), needs device check |
| Leftover rescue | "Half a chicken and sad rice? Three ideas." | built (server + app), needs device check |
| Cook-along assistant | "Ask the recipe a question mid-cooking." | built (server + app), needs device check |
| Scale and convert | "Serves 4 to serves 9, in your units." | built (server), see block 20; app screen to do |
| Plate check | "Friendly feedback on how it looks." | built (server + app), needs device check |
| Recipe rewriter | "Make it vegan, or under 500 calories." | built (server + app), needs device check |
| Weekly health summary | "Your numbers in plain words (no advice)." | built (server + app), needs device check |
| Meal-to-glucose insight | "Which dinners kept you steadier." | built (server + app), needs device check |
| Budget-aware plans | "Plan the week under your budget." | built (server + app), needs device check |
| Shopping by aisle | "Your list in the order of the shop." | built (server + app), needs device check |
| Family mode | "One plan, everyone's diet." | built (server + app), needs device check |
| Caption helper | "Great photo, no words? Done." | built (server + app), needs device check |
| Chat reply helper and summaries | "Catch up on a 200-message chat in 5 lines." | built (server + app), needs device check |
| Smarter moderation (images) | "Safer feed, quietly." | built (server + app), needs device check |
| Search that understands you | "Light, chicken, under 30 minutes, no oven." | built (server + app), needs device check |

---

# Content series ideas (reusable)
- **"Fridge roulette":** weekly, cook the winner of a poll using only what is in a follower's pantry list.
- **"Save vs cook":** how many saved recipes did you cook this month? (links to Want to Cook).
- **"Mystery Kitchen Friday":** live room code posted every week.
- **"Waste report":** monthly numbers from the waste tracker (anonymised, opt-in).
- **Build in public:** one honest engineering lesson per week (cost caps, tests, safety choices).

# Build diary (newest first; append one line per shipped change)
- 2026-11-15: Existing accounts keep working: sign in with Firebase as before and the server takes it from there (no password resets, no new accounts to make).
- 2026-11-15: Starter content for a fresh server: official SousChef accounts, 10 recipes, 3 cookbooks, official posts and 14 Daily Dish puzzles from one command. Also fixed calories: amounts in grams were read as ounces, so some recipes showed thousands of calories.
- 2026-11-15: App screens for every AI helper: tonight card, pantry photo scan, waste coach, health summary, cook-along chat, recipe rewriter, plate check, caption helper, smart search, shop-order list, chat reply/summary, scaling notes while posting.
- 2026-11-15: Cook-to-scale for any headcount: Gemini estimates, creators' notes teach it, the app labels where numbers came from.
- 2026-11-15: AI substitutions, AI meal plans and cookbook-page scanning moved to the server (allergy rules enforced in code). PR #25.
- 2026-11-15: Chat pictures and voice notes, communities, stories, health consent screen, Google/Apple sign-in through the server. PR #24.
- 2026-11-15: Background jobs, deploy files, runbook, load-test script. PR #23.
- 2026-11-15: Moderation layers, suspension, verified-chef badge. PR #22.
- 2026-11-15: Encrypted health tracking. PR #21.
- 2026-11-15: Daily Dish and Mystery Kitchen. PR #20.
