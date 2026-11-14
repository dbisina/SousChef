import { ME_ID } from '@/types/social';
import type {
  Author,
  Challenge,
  Comment,
  Community,
  CommunityEvent,
  Post,
  Reel,
  Story,
} from '@/types/social';
import { minutesAgo } from './util';

export const CURRENT_USER: Author = {
  id: ME_ID,
  handle: 'you',
  displayName: 'You',
  avatar: 'chef',
};

export const AUTHORS: Author[] = [
  CURRENT_USER,
  { id: 'ama', handle: 'ama.cooks', displayName: 'Ama', avatar: 'p_woman', online: true },
  { id: 'tolu', handle: 'tolu.eats', displayName: 'Tolu', avatar: 'p_man' },
  { id: 'dayo', handle: 'dayo.grills', displayName: 'Dayo', avatar: 'p_knit' },
  { id: 'kemi', handle: 'kemi', displayName: 'Kemi', avatar: 'family' },
];

export const buildPosts = (now: Date = new Date()): Post[] => [
  {
    id: 'post-katsu',
    authorId: 'ama',
    kind: 'recipe',
    photo: 'ricebowl',
    title: 'Chicken katsu rice bowl',
    caption: 'Crispy chicken katsu, sticky rice and a 5-minute curry sauce. Weeknight-proof.',
    meta: '35 min · Easy',
    recipeId: 'sample-katsu',
    likes: 2400,
    commentCount: 152,
    saves: 880,
    createdAt: minutesAgo(120, now),
  },
  {
    id: 'post-plan',
    authorId: 'tolu',
    kind: 'plan',
    photo: 'toast',
    title: '5-day high protein plan',
    caption: 'Shared a meal plan: 5 days · high protein · 1.2k uses',
    meta: '5 days · high protein',
    likes: 640,
    commentCount: 31,
    saves: 1200,
    createdAt: minutesAgo(300, now),
  },
  {
    id: 'post-gnocchi',
    authorId: 'kemi',
    kind: 'made-this',
    photo: 'gnocchi',
    title: 'Walnut gnocchi',
    caption: 'Made your walnut gnocchi. Reply to say hi.',
    recipeId: 'sample-gnocchi',
    likes: 86,
    commentCount: 8,
    saves: 12,
    createdAt: minutesAgo(240, now),
  },
  {
    id: 'post-chilli',
    authorId: 'tolu',
    kind: 'made-this',
    photo: 'tacos',
    title: 'Lentil chilli',
    caption: 'Bulk-cooked lentil chilli for 5 days, £4.20 total. Recipe in the cookbook.',
    communityId: 'budget',
    likes: 310,
    commentCount: 24,
    saves: 140,
    createdAt: minutesAgo(180, now),
  },
];

export const buildReels = (now: Date = new Date()): Reel[] => [
  {
    id: 'reel-ribeye',
    authorId: 'dayo',
    photo: 'plating',
    title: 'Steak in 60 seconds',
    caption: 'Reverse-seared ribeye, garlic butter baste. Save it for Friday.',
    likes: 48000,
    commentCount: 1300,
    saves: 9200,
    views: 48000,
    recipePhoto: 'beef',
    recipeTitle: 'Garlic butter ribeye',
    recipeMeta: '25 min · 7 ingredients',
    createdAt: minutesAgo(1400, now),
  },
  {
    id: 'reel-ramen',
    authorId: 'ama',
    photo: 'ramen',
    title: 'Spicy egg ramen',
    caption: 'Ten minutes, one pot.',
    likes: 21000,
    commentCount: 640,
    saves: 4100,
    views: 21000,
    recipePhoto: 'ramen',
    recipeTitle: 'Spicy egg ramen',
    recipeMeta: '10 min · 6 ingredients',
    createdAt: minutesAgo(2800, now),
  },
  {
    id: 'reel-pizza',
    authorId: 'tolu',
    photo: 'pizza',
    title: 'Pizza bianca',
    caption: 'No sauce, all crust.',
    likes: 9000,
    commentCount: 210,
    saves: 1800,
    views: 9000,
    recipePhoto: 'pizza',
    recipeTitle: 'Pizza bianca',
    recipeMeta: '40 min · 5 ingredients',
    createdAt: minutesAgo(4200, now),
  },
];

export const buildStories = (now: Date = new Date()): Story[] => [
  { id: 'story-ama', authorId: 'ama', photo: 'ricebowl', segments: 3, recipeId: 'sample-katsu', createdAt: minutesAgo(120, now) },
  { id: 'story-tolu', authorId: 'tolu', photo: 'tacos2', segments: 2, createdAt: minutesAgo(200, now) },
  { id: 'story-dayo', authorId: 'dayo', photo: 'plating', segments: 1, createdAt: minutesAgo(260, now) },
  { id: 'story-kemi', authorId: 'kemi', photo: 'gnocchi', segments: 2, createdAt: minutesAgo(300, now) },
];

export const buildComments = (now: Date = new Date()): Comment[] => [
  {
    id: 'c1',
    postId: 'post-katsu',
    authorId: 'tolu',
    text: 'Made this with brown rice, still crispy. The sauce is unreal.',
    likes: 24,
    createdAt: minutesAgo(60, now),
  },
  {
    id: 'c2',
    postId: 'post-katsu',
    authorId: 'ama',
    parentId: 'c1',
    text: 'Brown rice works so well here.',
    likes: 5,
    isAuthor: true,
    createdAt: minutesAgo(50, now),
  },
  {
    id: 'c3',
    postId: 'post-katsu',
    authorId: 'dayo',
    text: 'Can I air-fry the chicken?',
    likes: 6,
    createdAt: minutesAgo(40, now),
  },
];

export const COMMUNITIES: Community[] = [
  {
    id: 'budget',
    name: 'Student Budget Meals',
    photo: 'tacos',
    visibility: 'public',
    memberCount: 4200,
    memberAvatars: ['p_woman', 'p_man', 'p_knit'],
  },
];

export const CHALLENGES: Challenge[] = [
  {
    id: 'ch-5-dinner',
    communityId: 'budget',
    title: 'The £5 dinner',
    photo: 'tacos2',
    entries: 48,
    endsLabel: 'voting Sunday',
  },
];

export const buildEvents = (now: Date = new Date()): CommunityEvent[] => {
  const d = new Date(now);
  d.setMonth(10, 21); // 21 Nov
  d.setHours(18, 0, 0, 0);
  if (d.getTime() < now.getTime()) d.setFullYear(d.getFullYear() + 1);
  return [
    {
      id: 'ev-pasta',
      communityId: 'budget',
      title: 'Live cook-along: one-pan pasta',
      date: d.toISOString(),
      detail: '7:00–8:00 pm · hosted by @ama.cooks',
    },
  ];
};
