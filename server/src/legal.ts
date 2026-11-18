import type { FastifyInstance } from 'fastify';

/**
 * Public web pages the app stores ask for: privacy policy, terms and how to delete an account.
 * Plain HTML, no scripts, no cookies. The wording matches Settings > Privacy and Terms in the app.
 */
const CONTACT = 'danielbisina.t@gmail.com';

const page = (title: string, body: string): string => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · enplace</title>
<style>body{font:16px/1.55 system-ui,sans-serif;max-width:680px;margin:0 auto;padding:24px 16px;color:#1a1a1a;background:#fff}
h1{font-size:28px}h2{font-size:18px;margin-top:28px}a{color:#b5451b}@media(prefers-color-scheme:dark){body{background:#0b0b0b;color:#eee}a{color:#ff9a6b}}</style>
</head><body><h1>${title}</h1>${body}<p><small>enplace · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/delete-account">Delete your account</a></small></p></body></html>`;

const privacy = page(
  'Privacy policy',
  `<p>This explains what enplace collects, why, and your choices.</p>
<h2>What we collect</h2><ul>
<li>Account details: email, name, profile photo.</li>
<li>What you make: recipes, posts, comments, stories, messages, voice notes, photos you choose or take, pantry and meal plans.</li>
<li>Health and diet details you choose to enter (dietary needs, weight goals, health logs). Used only for features you asked for.</li>
<li>Feed activity (what was on screen, likes, saves, "not interested") to personalise your own feed. Raw records are deleted after 30 days. You can turn this off in Settings.</li>
<li>Subscription status (the App Store or Google Play and RevenueCat handle payment; we never see your card) and a push token if you allow notifications.</li>
<li>Reports and blocks you make.</li></ul>
<h2>AI features</h2><p>When you use portion scan, substitutions, voice help or meal ideas, what you scan, say or type is sent to our AI provider (currently Google Gemini) to produce the result. It is not used for advertising and we do not send your name or email with it. AI results can be wrong and are not medical advice.</p>
<h2>Who processes data for us</h2><p>Railway (hosting and database), Cloudflare R2 and Cloudinary (images and video), Firebase (sign-in), RevenueCat (subscriptions), Expo (push notifications), Google Gemini (AI). We do not sell personal data. We use no advertising SDKs, do not track you across other apps or sites, and do not read your advertising ID.</p>
<h2>Your rights</h2><p>You can access, correct and delete your data. Delete your account in the app (More &gt; Delete account) or see <a href="/delete-account">how to delete your account</a>. Backups are removed within 30 days.</p>
<h2>Children</h2><p>enplace is not for children under 13 and we do not knowingly collect their data.</p>
<h2>Reporting and blocking</h2><p>You can report any post, comment or person and block people from the more button. Our team reviews reports, usually within a day.</p>
<h2>Contact</h2><p><a href="mailto:${CONTACT}">${CONTACT}</a></p>`,
);

const terms = page(
  'Terms of use',
  `<p>By using enplace you agree to these terms.</p>
<h2>Your content</h2><p>You keep ownership of what you post. You give enplace a non-exclusive, worldwide, royalty-free licence to show and distribute it inside the service.</p>
<h2>Rules</h2><p>No objectionable content: hate, harassment, threats, sexual or violent material, or anything that endangers children. No spam, scams, dangerous cooking or health advice, infringing content, scraping, or access to other people's accounts.</p>
<h2>Reports, blocking and enforcement</h2><p>There is no tolerance for objectionable content or abusive people. Report or block from the more button on any post, comment, profile or chat. We review reports, usually within 24 hours, remove content that breaks these terms and may suspend or remove accounts.</p>
<h2>Subscriptions</h2><p>Paid features renew automatically until you cancel in your App Store or Google Play subscriptions. Refunds follow the store's policy.</p>
<h2>AI features</h2><p>AI results are estimates for information only. Always check allergies and dietary needs yourself.</p>
<h2>Contact</h2><p><a href="mailto:${CONTACT}">${CONTACT}</a></p>`,
);

const deletion = page(
  'Delete your enplace account',
  `<h2>In the app</h2><p>Open <strong>More &gt; Delete account</strong>, then confirm with your password (or type DELETE if you signed in with Google or Apple). Your account and everything you made are deleted.</p>
<h2>Without the app</h2><p>Email <a href="mailto:${CONTACT}?subject=Delete%20my%20enplace%20account">${CONTACT}</a> from the address on your account with the subject "Delete my enplace account". We delete it within 30 days and confirm by email.</p>
<h2>What is deleted</h2><p>Profile, recipes, posts, comments, stories, messages, pantry, meal plans, health logs, feed activity and your taste profile. Backups are removed within 30 days. Reports you made about others, and records we must keep by law, may be kept longer.</p>`,
);

export function legalRoutes(app: FastifyInstance): void {
  const send = (html: string) => async (_request: unknown, reply: { type: (t: string) => { header: (k: string, v: string) => { send: (b: string) => unknown } } }) =>
    reply.type('text/html; charset=utf-8').header('cache-control', 'public, max-age=3600').send(html);
  app.get('/privacy', send(privacy));
  app.get('/terms', send(terms));
  app.get('/delete-account', send(deletion));
}
