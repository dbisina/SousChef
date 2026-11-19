// Inviting friends, and enplace's own labeled "house" accounts. Dates are ISO strings.
import type { Participant } from './chat';
import type { PostKind } from './social';

/** How many friends have to start using the app before the reward. */
export const INVITES_PER_REWARD = 10;

export interface InviteStatus {
  /** Your code to share, for example "K7QM2XPD". */
  code: string;
  /** Friends who joined with it and have done something real (saved a recipe, posted, ...). */
  qualified: number;
  /** Friends who joined with it and have not yet. */
  pending: number;
  /** Friends needed per reward. */
  target: number;
  /** How many more friends until the next reward. */
  untilNextReward: number;
  /** Rewards earned so far (each is a month of Pro for you and for those friends). */
  rewardsEarned: number;
  /** When your earned Pro time ends, or null if none is running. */
  proUntil: string | null;
}

export interface RedeemInviteRequest {
  code: string;
}

export interface RedeemInviteResponse {
  inviter: Participant;
}

/* ---------------------------------------------------------------- house accounts */

/** An official enplace account. Shown with a badge; it can never sign in or pretend to be a person. */
export interface HouseAccount {
  user: Participant;
  bio: string;
  postCount: number;
  createdAt: string;
}

export interface CreateHouseAccountRequest {
  displayName: string;
  /** Lowercase letters, digits, underscores; made from the name if left out. */
  handle?: string;
  bio?: string;
  photoUrl?: string;
}

export interface CreateHousePostRequest {
  kind: PostKind;
  title: string;
  caption?: string;
  meta?: string;
  recipeId?: string;
  photoUrl: string;
  videoUrl?: string;
}

export interface HouseSwitchResult {
  /** Posts changed by the switch. */
  posts: number;
}
