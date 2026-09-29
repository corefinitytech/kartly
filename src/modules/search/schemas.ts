import { z } from "zod";

export const suggestQuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
});

export type SuggestQuery = z.infer<typeof suggestQuerySchema>;
