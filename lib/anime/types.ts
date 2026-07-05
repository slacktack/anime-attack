import { z } from "zod";

export const AnimeTypeSchema = z.enum(["TV", "MOVIE", "OVA", "ONA", "SPECIAL", "MUSIC"]);
export type AnimeType = z.infer<typeof AnimeTypeSchema>;

export const AnimeStatusSchema = z.enum(["RELEASING", "FINISHED", "NOT_YET_RELEASED", "CANCELLED", "HIATUS"]);
export type AnimeStatus = z.infer<typeof AnimeStatusSchema>;

export const AnimeSummarySchema = z.object({
  id: z.number(),
  title: z.string(),
  cover: z.string(),
  banner: z.string().nullable(),
  type: AnimeTypeSchema.nullable().default(null),
  score: z.number().nullable().default(null),
  year: z.number().nullable().default(null),
});
export type AnimeSummary = z.infer<typeof AnimeSummarySchema>;

export const CharacterSchema = z.object({
  id: z.number(),
  name: z.string(),
  image: z.string().nullable(),
  role: z.string().nullable(),
  voiceActor: z.string().nullable().default(null),
});
export type Character = z.infer<typeof CharacterSchema>;

export const EpisodeSchema = z.object({
  number: z.number(),
  title: z.string().nullable(),
  filler: z.boolean().default(false),
});
export type Episode = z.infer<typeof EpisodeSchema>;

export const AnimeSchema = AnimeSummarySchema.extend({
  bannerImage: z.string().nullable().default(null),
  description: z.string().nullable().default(null),
  genres: z.array(z.string()).default([]),
  status: AnimeStatusSchema.nullable().default(null),
  episodes: z.number().nullable().default(null),
  studios: z.array(z.string()).default([]),
});
export type Anime = z.infer<typeof AnimeSchema>;
