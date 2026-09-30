import { z } from "zod";

export const addItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(10),
});

export const setQuantitySchema = z.object({
  quantity: z.coerce.number().int().min(0).max(10),
});

export const estimateSchema = z.object({
  country: z.string().length(2).toUpperCase(),
});

export type AddItemInput = z.infer<typeof addItemSchema>;
export type SetQuantityInput = z.infer<typeof setQuantitySchema>;
export type EstimateInput = z.infer<typeof estimateSchema>;
