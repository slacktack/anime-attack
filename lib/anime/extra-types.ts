import { z } from "zod";
import { AnimeSummarySchema, type AnimeSummary } from "./types";

export const CharacterCardSchema = z.object({
  id: z.number(),
  name: z.string(),
  image: z.string().nullable(),
  favourites: z.number(),
});
export type CharacterCard = z.infer<typeof CharacterCardSchema>;

export const CharacterFullSchema = CharacterCardSchema.extend({
  native: z.string().nullable(),
  description: z.string().nullable(),
  gender: z.string().nullable(),
  age: z.string().nullable(),
  media: z.array(AnimeSummarySchema),
});
export type CharacterFull = z.infer<typeof CharacterFullSchema> & { media: AnimeSummary[] };

export const ScheduleEntrySchema = z.object({
  id: z.number(),
  title: z.string(),
  cover: z.string(),
  episode: z.number(),
  airingAt: z.number(),
});
export type ScheduleEntry = z.infer<typeof ScheduleEntrySchema>;

export const AnimeExtrasSchema = z.object({
  idMal: z.number().nullable(),
  color: z.string().nullable(),
});
export type AnimeExtras = z.infer<typeof AnimeExtrasSchema>;
