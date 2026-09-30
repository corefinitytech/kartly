"use server";

// Admin server actions: authorize, validate, call a service, report back.
// No business rules here (PRD rule 9).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { requireStaffAction } from "./guard";
import * as inventory from "./inventory-service";
import * as orders from "./orders-service";
import * as products from "./products-service";
import type { Permission } from "./permissions";
import {
  type AdminFormState,
  advanceOrderSchema,
  cancelOrderSchema,
  fieldErrors,
  imageAltSchema,
  productSchema,
  refundSchema,
  stockAdjustmentSchema,
  thresholdSchema,
  variantSchema,
} from "./schemas";

const id = z.string().uuid();

function fields(formData: FormData, names: string[]): Record<string, string> {
  return Object.fromEntries(names.map((n) => [n, String(formData.get(n) ?? "")]));
}

function failure(error: unknown): AdminFormState {
  if (error instanceof AppError) return { error: error.message };
  logger.error({ error: error instanceof Error ? error.name : "unknown" }, "admin action failed");
  return { error: "Something went wrong. Please try again." };
}

/**
 * Authorize, run, and turn any error into form state. Failed submissions echo
 * the typed values back, because React resets the form after every action.
 */
async function run(
  permission: Permission,
  formData: FormData,
  fn: (staff: Awaited<ReturnType<typeof requireStaffAction>>) => Promise<AdminFormState>,
): Promise<AdminFormState> {
  let state: AdminFormState;
  try {
    const staff = await requireStaffAction(permission);
    state = await fn(staff);
  } catch (error) {
    state = failure(error);
  }
  if (state.error || state.fieldErrors) {
    const values: Record<string, string> = {};
    for (const [key, value] of formData.entries()) if (typeof value === "string") values[key] = value;
    state.values = values;
  }
  return state;
}

const PRODUCT_FIELDS = ["title", "slug", "brand", "description", "categoryId", "status"];
const VARIANT_FIELDS = ["sku", "options", "price", "compareAt", "lowStockThreshold"];

// Products -------------------------------------------------------------------

export async function createProductAction(_prev: AdminFormState | undefined, formData: FormData): Promise<AdminFormState> {
  let createdId: string | null = null;
  const state = await run("products.manage", formData, async (staff) => {
    const product = productSchema.safeParse(fields(formData, PRODUCT_FIELDS));
    const variant = variantSchema.safeParse(fields(formData, VARIANT_FIELDS));
    if (!product.success || !variant.success) {
      return {
        fieldErrors: {
          ...(product.success ? {} : fieldErrors(product.error)),
          ...(variant.success ? {} : fieldErrors(variant.error)),
        },
      };
    }
    createdId = await products.createProduct(staff, product.data, variant.data);
    return {};
  });
  if (createdId) redirect(`/admin/products/${createdId}?created=1`);
  return state;
}

export async function updateProductAction(_prev: AdminFormState | undefined, formData: FormData): Promise<AdminFormState> {
  return run("products.manage", formData, async (staff) => {
    const productId = id.parse(formData.get("productId"));
    const parsed = productSchema.safeParse(fields(formData, PRODUCT_FIELDS));
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
    await products.updateProduct(staff, productId, parsed.data);
    revalidatePath(`/admin/products/${productId}`);
    return { notice: "Product saved." };
  });
}

export async function setProductStatusAction(_prev: AdminFormState | undefined, formData: FormData): Promise<AdminFormState> {
  return run("products.manage", formData, async (staff) => {
    const productId = id.parse(formData.get("productId"));
    const status = z.enum(["active", "draft"]).parse(formData.get("status"));
    await products.setProductStatus(staff, productId, status);
    revalidatePath(`/admin/products/${productId}`);
    return { notice: status === "active" ? "Published. It is live in the store." : "Unpublished. It is hidden from the store." };
  });
}

export async function deleteProductAction(_prev: AdminFormState | undefined, formData: FormData): Promise<AdminFormState> {
  let deleted = false;
  const state = await run("products.manage", formData, async (staff) => {
    await products.deleteProduct(staff, id.parse(formData.get("productId")));
    deleted = true;
    return {};
  });
  if (deleted) redirect("/admin/products?deleted=1");
  return state;
}

// Variants -------------------------------------------------------------------

export async function addVariantAction(_prev: AdminFormState | undefined, formData: FormData): Promise<AdminFormState> {
  return run("products.manage", formData, async (staff) => {
    const productId = id.parse(formData.get("productId"));
    const parsed = variantSchema.safeParse(fields(formData, VARIANT_FIELDS));
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
    await products.addVariant(staff, productId, parsed.data);
    revalidatePath(`/admin/products/${productId}`);
    return { notice: "Variant added with 0 in stock. Add stock from Inventory." };
  });
}

export async function updateVariantAction(_prev: AdminFormState | undefined, formData: FormData): Promise<AdminFormState> {
  return run("products.manage", formData, async (staff) => {
    const variantId = id.parse(formData.get("variantId"));
    const parsed = variantSchema.safeParse(fields(formData, VARIANT_FIELDS));
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
    await products.updateVariant(staff, variantId, parsed.data);
    revalidatePath("/admin/products", "layout");
    return { notice: "Variant saved." };
  });
}

export async function deleteVariantAction(_prev: AdminFormState | undefined, formData: FormData): Promise<AdminFormState> {
  return run("products.manage", formData, async (staff) => {
    await products.deleteVariant(staff, id.parse(formData.get("variantId")));
    revalidatePath("/admin/products", "layout");
    return { notice: "Variant deleted." };
  });
}

// Images ---------------------------------------------------------------------

export async function uploadImageAction(_prev: AdminFormState | undefined, formData: FormData): Promise<AdminFormState> {
  return run("products.manage", formData, async (staff) => {
    const productId = id.parse(formData.get("productId"));
    const file = formData.get("image");
    if (!(file instanceof File) || file.size === 0) return { fieldErrors: { image: "Choose an image to upload." } };
    await products.uploadImage(staff, productId, file);
    revalidatePath(`/admin/products/${productId}`);
    return { notice: "Image uploaded." };
  });
}

export async function updateImageAltAction(_prev: AdminFormState | undefined, formData: FormData): Promise<AdminFormState> {
  return run("products.manage", formData, async (staff) => {
    const parsed = imageAltSchema.safeParse(fields(formData, ["imageId", "alt"]));
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
    await products.updateImageAlt(staff, parsed.data.imageId, parsed.data.alt);
    revalidatePath("/admin/products", "layout");
    return { notice: "Description saved." };
  });
}

export async function moveImageAction(_prev: AdminFormState | undefined, formData: FormData): Promise<AdminFormState> {
  return run("products.manage", formData, async (staff) => {
    const direction = z.enum(["up", "down"]).parse(formData.get("direction"));
    await products.moveImage(staff, id.parse(formData.get("imageId")), direction);
    revalidatePath("/admin/products", "layout");
    return {};
  });
}

export async function deleteImageAction(_prev: AdminFormState | undefined, formData: FormData): Promise<AdminFormState> {
  return run("products.manage", formData, async (staff) => {
    await products.deleteImage(staff, id.parse(formData.get("imageId")));
    revalidatePath("/admin/products", "layout");
    return { notice: "Image removed." };
  });
}

// Inventory ------------------------------------------------------------------

export async function adjustStockAction(_prev: AdminFormState | undefined, formData: FormData): Promise<AdminFormState> {
  return run("inventory.manage", formData, async (staff) => {
    const parsed = stockAdjustmentSchema.safeParse(fields(formData, ["variantId", "delta", "reason", "note"]));
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
    const { stockAfter } = await inventory.adjustStock(staff, parsed.data);
    revalidatePath("/admin/inventory");
    revalidatePath("/admin/products", "layout");
    return { notice: `Saved. ${stockAfter} now in stock.` };
  });
}

export async function setThresholdAction(_prev: AdminFormState | undefined, formData: FormData): Promise<AdminFormState> {
  return run("inventory.manage", formData, async (staff) => {
    const parsed = thresholdSchema.safeParse(fields(formData, ["variantId", "lowStockThreshold"]));
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
    await inventory.setLowStockThreshold(staff, parsed.data.variantId, parsed.data.lowStockThreshold);
    revalidatePath("/admin/inventory");
    return { notice: "Threshold saved." };
  });
}

// Orders ---------------------------------------------------------------------

export async function advanceOrderAction(_prev: AdminFormState | undefined, formData: FormData): Promise<AdminFormState> {
  return run("orders.fulfil", formData, async (staff) => {
    const parsed = advanceOrderSchema.safeParse(fields(formData, ["orderId", "to", "carrier", "trackingNumber"]));
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
    await orders.advanceOrder(staff, parsed.data);
    const labels = { processing: "Marked as processing.", shipped: "Marked as shipped. The customer was emailed the tracking number.", delivered: "Marked as delivered." };
    return { notice: labels[parsed.data.to] };
  });
}

export async function cancelOrderAction(_prev: AdminFormState | undefined, formData: FormData): Promise<AdminFormState> {
  return run("orders.cancel", formData, async (staff) => {
    const parsed = cancelOrderSchema.safeParse(fields(formData, ["orderId", "reason"]));
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
    const { refundError } = await orders.cancelOrder(staff, parsed.data.orderId, parsed.data.reason);
    if (refundError) {
      return { error: `The order was cancelled and stock restored, but the refund failed: ${refundError} Use Refund to try again.` };
    }
    return { notice: "Order cancelled. Stock was restored and any payment refunded." };
  });
}

export async function refundOrderAction(_prev: AdminFormState | undefined, formData: FormData): Promise<AdminFormState> {
  return run("orders.refund", formData, async (staff) => {
    const parsed = refundSchema.safeParse(fields(formData, ["orderId", "amount", "reason"]));
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
    await orders.refundOrder(staff, parsed.data.orderId, parsed.data.amount, parsed.data.reason);
    return { notice: "Refund issued. The customer was emailed." };
  });
}
