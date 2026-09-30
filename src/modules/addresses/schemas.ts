import { z } from "zod";

export const COUNTRY_CODES = [
  "US","GB","DE","PK","CA","AE","AU","AT","BE","BR","CN","DK","EG","ES","FI","FR","GR","NL","IE","IN","IT","JP",
  "MY","MX","NZ","NO","PH","PL","PT","SA","SE","CH","TR","UA","ZA",
] as const;

export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export const addressSchema = z.object({
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
    .regex(/^[+\d][\d\s()-]{4,20}$/, "Enter a valid phone number.")
    .optional()
    .or(z.literal("")),
});

export type AddressInput = z.infer<typeof addressSchema>;

export const MAX_ADDRESSES = 10;
