import type { AiRouter } from '../ai/router';
import type { InviteService } from '../invites/service';
import type { MysteryKitchenService } from '../play/mysteryKitchen';
import type { ModerationService } from '../moderation/service';
import type { StoryService } from '../social/stories';
import type { UploadService } from '../uploads/service';
import type { Job } from './runner';
import type { Maintenance } from './maintenance';

const MINUTE = 60_000;

export interface JobServices {
  uploads: UploadService;
  stories: StoryService;
  invites: InviteService;
  games: MysteryKitchenService;
  moderation: ModerationService;
  maintenance: Maintenance;
  ai: AiRouter;
}

/** Everything that runs in the background, and how often. */
export function backgroundJobs(s: JobServices): Job[] {
  return [
    // Mystery Kitchen games whose clock ran out are finished, and stale lobbies go.
    { name: 'games', everyMs: 5 * MINUTE, run: async () => describe(await s.games.sweep()) },
    // Waits for the AI quietly: if it is off or over budget, posts stay in line.
    {
      name: 'moderation',
      everyMs: MINUTE,
      run: async () => (s.ai.available('moderate') ? describe(await s.moderation.reviewPending()) : 'AI off, skipped'),
    },
    { name: 'invites', everyMs: 5 * MINUTE, run: async () => `settled ${await s.invites.settleAll()} inviters` },
    { name: 'stories', everyMs: 10 * MINUTE, run: async () => `removed ${await s.stories.sweepExpired()} old stories` },
    { name: 'uploads', everyMs: 10 * MINUTE, run: async () => `removed ${await s.uploads.sweepExpired()} unfinished uploads` },
    { name: 'maintenance', everyMs: 60 * MINUTE, run: async () => describe(await s.maintenance.purge()) },
  ];
}

const describe = (counts: object): string =>
  Object.entries(counts)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(' ');
