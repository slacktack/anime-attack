import { z } from "zod";

/** Base URL for all AniwatchTV API requests. */
export const BASE_URL = "https://aniwatchtv.by";

// ── Episode (WordPress Post) ────────────────────────────────────────────────

export const AniwatchEpisodeSchema = z.object({
  id: z.number(),
  date: z.string(),
  slug: z.string(),
  title: z.string(),
  link: z.string(),
  categoryIds: z.array(z.number()),
  tags: z.array(z.number()),
});
export type AniwatchEpisode = z.infer<typeof AniwatchEpisodeSchema>;

// ── Category (Anime Series) ─────────────────────────────────────────────────

export const AniwatchCategorySchema = z.object({
  id: z.number(),
  count: z.number(),
  name: z.string(),
  slug: z.string(),
});
export type AniwatchCategory = z.infer<typeof AniwatchCategorySchema>;

// ── Video ───────────────────────────────────────────────────────────────────

export const AniwatchVideoQualitySchema = z.object({
  label: z.string(),
  url: z.string(),
});
export type AniwatchVideoQuality = z.infer<typeof AniwatchVideoQualitySchema>;

export const AniwatchVideoSourceSchema = z.object({
  videoUrl: z.string(),
  qualities: z.array(AniwatchVideoQualitySchema),
  thumbnail: z.string().nullable(),
  playerPageUrl: z.string(),
});
export type AniwatchVideoSource = z.infer<typeof AniwatchVideoSourceSchema>;

// ── Bookmark ────────────────────────────────────────────────────────────────

export const AniwatchBookmarkActionSchema = z.object({
  action: z.enum([
    "bookmark_push",
    "bookmark_remove",
    "bookmark_get_order",
    "bookmark_get",
  ]),
  id: z.number(),
  ids: z.array(z.number()).optional(),
});
export type AniwatchBookmarkAction = z.infer<
  typeof AniwatchBookmarkActionSchema
>;

// ── Series Franchise ────────────────────────────────────────────────────────

export const AniwatchSeriesFranchiseSchema = z.object({
  id: z.number(),
  count: z.number(),
  name: z.string(),
  slug: z.string(),
});
export type AniwatchSeriesFranchise = z.infer<
  typeof AniwatchSeriesFranchiseSchema
>;
