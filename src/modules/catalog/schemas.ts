import { z } from "zod";

export const SORT_OPTIONS = ["relevance", "price_asc", "price_desc", "rating", "newest"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const listingParamsSchema = z.object({
  q: z.string().trim().max(200).optional(),
  category: z.string().trim().max(120).optional(),
  minPrice: z.coerce.number().int().min(0).max(10_000_000).optional(),
  maxPrice: z.coerce.number().int().min(0).max(10_000_000).optional(),
  minRating: z.coerce.number().min(1).max(5).optional(),
  brand: z.string().trim().max(120).optional(),
  inStock: z
    .union([z.literal("true"), z.literal("false"), z.literal("1"), z.literal("0")])
    .transform((v) => v === "true" || v === "1")
    .optional(),
  sort: z.enum(SORT_OPTIONS).default("relevance"),
  page: z.coerce.number().int().min(1).max(500).default(1),
});

export type ListingParams = z.infer<typeof listingParamsSchema>;

export const PAGE_SIZE = 24;

export function parseListingParams(searchParams: Record<string, string | string[] | undefined>) {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(searchParams)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) flat[key] = first;
  }
  return listingParamsSchema.safeParse(flat);
}
