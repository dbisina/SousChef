// Importing a recipe from a link: a video (YouTube, TikTok, Instagram) or any recipe web page.
import type { ImportedRecipe } from './kitchen';

export type ImportPlatform = 'youtube' | 'tiktok' | 'instagram' | 'website';

export interface AddVideoRequest {
  /** The video file's own address, as the platform's page gave it to the phone. */
  videoUrl: string;
  /** The cookie the platform gave the phone with it (the file is refused without it). */
  cookie?: string;
}

export interface SearchImportRequest {
  /** What the person wants to cook, in their own words ("a good vegan lasagne"). */
  query: string;
}

export interface CreateImportRequest {
  /** A link to a video or to a page with a recipe on it. */
  url: string;
}

/** Frames taken from the video on the phone, when the caption did not hold the recipe. Finished `import_frame` uploads. */
export interface AddFramesRequest {
  uploadIds: string[];
}

export interface ImportResult {
  id: string;
  /** `needs_frames`: the video's caption has no recipe, so send a few frames from the video to read it from the pictures. */
  status: 'done' | 'needs_frames';
  platform: ImportPlatform;
  recipe: ImportedRecipe | null;
  /** True when someone already imported the same link, so this cost nothing. */
  cached: boolean;
  message: string | null;
}
