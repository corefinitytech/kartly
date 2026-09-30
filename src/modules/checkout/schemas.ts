import { z } from "zod";
import { COUNTRY_CODES } from "@/modules/addresses/schemas";
import { voucherCodeSchema } from "@/modules/vouchers/schemas";

export const shippingAddressSchema = z.object({
  fullName: z.string().trim().min(1, "Enter the full name.").max(100),
  line1: z.string().trim().min(1, "Enter the street address.").max(200),
  line2: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().min(1, "Enter the city.").max(100),
  region: z.string().trim().max(100).optional().or(z.literal("")),
  postalCode: z.string().trim().min(1, "Enter the postal code.").max(20),
  country: z.enum(COUNTRY_CODES),
  phone: z
    .string()
    .trim()
    .regex(/^[+\d][\d\s()-]{4,20}$/)
    .optional()
    .or(z.literal("")),
});

export type ShippingAddress = z.infer<typeof shippingAddressSchema>;

export const quoteSchema = z.object({
  country: z.enum(COUNTRY_CODES),
  shippingMethodCode: z.string().trim().min(1).max(40),
  voucherCode: voucherCodeSchema.optional(),
});

export const placeOrderSchema = z.object({
  contactEmail: z.string().trim().toLowerCase().email(),
  address: shippingAddressSchema,
  shippingMethodCode: z.string().trim().min(1).max(40),
  saveAddress: z.boolean().optional(),
  voucherCode: voucherCodeSchema.optional(),
});

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
