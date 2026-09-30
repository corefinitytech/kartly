import Stripe from "stripe";
import { env } from "./env";

export function stripeClient(): Stripe | null {
  if (!env.STRIPE_SECRET_KEY) return null;
  return new Stripe(env.STRIPE_SECRET_KEY);
}

export function requireStripeClient(): Stripe {
  const client = stripeClient();
  if (!client) {
    throw new Error("Stripe is not configured");
  }
  return client;
}
