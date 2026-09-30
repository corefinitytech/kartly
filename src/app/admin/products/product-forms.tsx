"use client";

import Image from "next/image";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit, FormMessage, SelectField, Submit, TextField, TextareaField, useAdminForm } from "@/components/admin/form";
import type { AdminFormState } from "@/modules/admin/schemas";
import {
  addVariantAction,
  createProductAction,
  deleteImageAction,
  deleteProductAction,
  deleteVariantAction,
  moveImageAction,
  setProductStatusAction,
  updateImageAltAction,
  updateProductAction,
  updateVariantAction,
  uploadImageAction,
} from "@/modules/admin/actions";

type Option = { value: string; label: string };

export interface ProductValues {
  id: string;
  title: string;
  slug: string;
  brand: string | null;
  description: string | null;
  categoryId: string | null;
  status: string;
}

export interface VariantValues {
  id: string;
  sku: string;
  options: string;
  price: string;
  compareAt: string;
  lowStockThreshold: number;
  stockQty: number;
  ordered: boolean;
}

function ProductFields({ state, product, categories }: { state: AdminFormState | undefined; product?: ProductValues; categories: Option[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField id="title" name="title" label="Title" state={state} defaultValue={product?.title} required maxLength={200} fieldClassName="sm:col-span-2" />
      <TextField
        id="slug"
        name="slug"
        label="URL slug"
        state={state}
        defaultValue={product?.slug}
        maxLength={80}
        autoComplete="off"
        hint={product ? `Store link: /p/${product.slug}` : "Leave empty to make one from the title."}
      />
      <TextField id="brand" name="brand" label="Brand (optional)" state={state} defaultValue={product?.brand ?? ""} maxLength={100} />
      <SelectField
        id="categoryId"
        name="categoryId"
        label="Category"
        state={state}
        defaultValue={product?.categoryId ?? ""}
        options={[{ value: "", label: "No category" }, ...categories]}
      />
      <SelectField
        id="status"
        name="status"
        label="Visibility"
        state={state}
        defaultValue={product?.status ?? "draft"}
        options={[
          { value: "draft", label: "Draft (hidden from the store)" },
          { value: "active", label: "Live (visible in the store)" },
        ]}
      />
      <TextareaField id="description" name="description" label="Description" state={state} defaultValue={product?.description ?? ""} maxLength={5000} fieldClassName="sm:col-span-2" />
    </div>
  );
}

function VariantFields({ state, prefix, variant }: { state: AdminFormState | undefined; prefix: string; variant?: VariantValues }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <TextField id={`${prefix}-sku`} name="sku" label="SKU" state={state} defaultValue={variant?.sku} required maxLength={64} autoComplete="off" />
      <TextField
        id={`${prefix}-options`}
        name="options"
        label="Options"
        state={state}
        defaultValue={variant?.options}
        placeholder="Color: Red, Size: M"
        maxLength={300}
        autoComplete="off"
        fieldClassName="lg:col-span-2"
      />
      <TextField id={`${prefix}-price`} name="price" label="Price (USD)" state={state} defaultValue={variant?.price} inputMode="decimal" required autoComplete="off" />
      <TextField
        id={`${prefix}-compareAt`}
        name="compareAt"
        label="Was price (optional)"
        state={state}
        defaultValue={variant?.compareAt}
        inputMode="decimal"
        autoComplete="off"
      />
      <TextField
        id={`${prefix}-lowStockThreshold`}
        name="lowStockThreshold"
        label="Low stock at"
        state={state}
        defaultValue={variant?.lowStockThreshold ?? 5}
        inputMode="numeric"
        required
        autoComplete="off"
      />
    </div>
  );
}

// New product ----------------------------------------------------------------

export function NewProductForm({ categories }: { categories: Option[] }) {
  const [state, action, pending] = useAdminForm(createProductAction);
  return (
    <form action={action} className="space-y-6" noValidate>
      <fieldset className="rounded-card border border-line bg-surface p-4 sm:p-5">
        <legend className="px-1 text-lg font-semibold">Details</legend>
        <ProductFields state={state} categories={categories} />
      </fieldset>
      <fieldset className="rounded-card border border-line bg-surface p-4 sm:p-5">
        <legend className="px-1 text-lg font-semibold">First variant</legend>
        <p className="mb-4 text-sm text-inkSoft">Every product needs one. Leave options empty if it comes in one version only.</p>
        <VariantFields state={state} prefix="new" />
      </fieldset>
      <FormMessage state={state} />
      <Submit pending={pending} pendingLabel="Creating">
        Create product
      </Submit>
    </form>
  );
}

// Existing product -----------------------------------------------------------

export function ProductDetailsForm({ product, categories }: { product: ProductValues; categories: Option[] }) {
  const [state, action, pending] = useAdminForm(updateProductAction);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="productId" value={product.id} />
      <ProductFields state={state} product={product} categories={categories} />
      <FormMessage state={state} />
      <Submit pending={pending}>Save details</Submit>
    </form>
  );
}

export function PublishForm({ productId, status }: { productId: string; status: string }) {
  const [state, action, pending] = useAdminForm(setProductStatusAction);
  const live = status === "active";
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="status" value={live ? "draft" : "active"} />
      <Button type="submit" variant={live ? "tertiary" : "secondary"} disabled={pending} className="w-full">
        {pending ? "Saving" : live ? "Unpublish" : "Publish"}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}

export function DeleteProductForm({ productId, canDelete }: { productId: string; canDelete: boolean }) {
  const [state, action, pending] = useAdminForm(deleteProductAction);
  if (!canDelete) {
    return <p className="text-sm text-inkSoft">This product has orders, so it stays on record. Unpublish it to hide it.</p>;
  }
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="productId" value={productId} />
      <p className="text-sm text-inkSoft">It has never been ordered, so it can be deleted with its images.</p>
      <FormMessage state={state} />
      <ConfirmSubmit pending={pending} label="Delete product" confirmLabel="Delete for good" question="Delete this product?" />
    </form>
  );
}

// Variants -------------------------------------------------------------------

export function VariantForm({ variant, onlyVariant }: { variant: VariantValues; onlyVariant: boolean }) {
  const [state, action, pending] = useAdminForm(updateVariantAction);
  const [deleteState, deleteAction, deleting] = useActionState(deleteVariantAction, undefined);
  return (
    <div className="space-y-3 py-4 first:pt-0 last:pb-0">
      <form action={action} className="space-y-3" noValidate>
        <input type="hidden" name="variantId" value={variant.id} />
        <VariantFields state={state} prefix={`v-${variant.id}`} variant={variant} />
        <div className="flex flex-wrap items-center gap-3">
          <Submit pending={pending} size="sm">
            Save variant
          </Submit>
          <span className="text-sm text-inkSoft">
            <span className="tabular-nums">{variant.stockQty}</span> in stock ·{" "}
            <a href={`/admin/inventory?q=${encodeURIComponent(variant.sku)}`} className="text-brandLink underline underline-offset-4">
              Adjust in Inventory
            </a>
          </span>
        </div>
        <FormMessage state={state} />
      </form>
      {!variant.ordered && !onlyVariant ? (
        <form action={deleteAction}>
          <input type="hidden" name="variantId" value={variant.id} />
          <ConfirmSubmit pending={deleting} label="Delete variant" confirmLabel="Delete" question={`Delete ${variant.sku}?`} />
          <FormMessage state={deleteState} className="mt-2" />
        </form>
      ) : null}
    </div>
  );
}

export function AddVariantForm({ productId }: { productId: string }) {
  const [state, action, pending] = useAdminForm(addVariantAction);
  return (
    <form action={action} className="space-y-3" noValidate>
      <input type="hidden" name="productId" value={productId} />
      <VariantFields state={state} prefix="add" />
      <FormMessage state={state} />
      <Submit pending={pending} size="sm" pendingLabel="Adding">
        Add variant
      </Submit>
    </form>
  );
}

// Images ---------------------------------------------------------------------

export interface ImageValues {
  id: string;
  url: string;
  alt: string | null;
}

export function ImagesManager({ productId, images, uploadsEnabled }: { productId: string; images: ImageValues[]; uploadsEnabled: boolean }) {
  return (
    <div className="space-y-4">
      {images.length === 0 ? (
        <p className="text-sm text-inkSoft">No images yet. The store shows a plain tile until you add one.</p>
      ) : (
        <ol className="grid gap-3 sm:grid-cols-2">
          {images.map((image, index) => (
            <ImageItem key={image.id} image={image} index={index} last={index === images.length - 1} />
          ))}
        </ol>
      )}
      {uploadsEnabled ? (
        <UploadForm productId={productId} />
      ) : (
        <p className="rounded-badge bg-sunken px-3 py-2 text-sm text-inkSoft">
          Uploads are off: set BLOB_READ_WRITE_TOKEN (Vercel Blob) to turn them on.
        </p>
      )}
    </div>
  );
}

function ImageItem({ image, index, last }: { image: ImageValues; index: number; last: boolean }) {
  const [altState, altAction, savingAlt] = useAdminForm(updateImageAltAction);
  const [moveState, moveAction, moving] = useActionState(moveImageAction, undefined);
  const [deleteState, deleteAction, deleting] = useActionState(deleteImageAction, undefined);
  return (
    <li className="rounded-card border border-line p-3">
      <div className="flex gap-3">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-badge bg-sunken">
          <Image src={image.url} alt={image.alt ?? ""} fill sizes="80px" className="object-contain p-1" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{index === 0 ? "Cover image" : `Image ${index + 1}`}</p>
          <form action={moveAction} className="mt-1 flex gap-1">
            <input type="hidden" name="imageId" value={image.id} />
            <Button type="submit" name="direction" value="up" size="icon" variant="tertiary" disabled={index === 0 || moving} aria-label="Move earlier">
              <ArrowUp strokeWidth={1.75} className="h-4 w-4" />
            </Button>
            <Button type="submit" name="direction" value="down" size="icon" variant="tertiary" disabled={last || moving} aria-label="Move later">
              <ArrowDown strokeWidth={1.75} className="h-4 w-4" />
            </Button>
          </form>
          <FormMessage state={moveState} className="mt-1" />
        </div>
      </div>
      <form action={altAction} className="mt-3 flex items-end gap-2" noValidate>
        <input type="hidden" name="imageId" value={image.id} />
        <TextField id={`alt-${image.id}`} name="alt" label="Image description (alt text)" state={altState} defaultValue={image.alt ?? ""} maxLength={200} fieldClassName="flex-1" />
        <Submit pending={savingAlt} variant="tertiary">
          Save
        </Submit>
      </form>
      <FormMessage state={altState} className="mt-2" />
      <form action={deleteAction} className="mt-3">
        <input type="hidden" name="imageId" value={image.id} />
        <ConfirmSubmit pending={deleting} label="Remove image" confirmLabel="Remove" question="Remove this image?" />
        <FormMessage state={deleteState} className="mt-2" />
      </form>
    </li>
  );
}

function UploadForm({ productId }: { productId: string }) {
  const [state, action, pending] = useAdminForm(uploadImageAction);
  const error = state?.fieldErrors?.image;
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="productId" value={productId} />
      <label htmlFor="image-upload" className="block text-sm text-inkSoft">
        Add an image (JPEG, PNG or WebP, up to 2 MB)
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="image-upload"
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          aria-invalid={error ? true : undefined}
          className="min-h-11 max-w-full text-sm file:mr-3 file:min-h-11 file:rounded-btn file:border file:border-lineStrong file:bg-surface file:px-4 file:text-ink hover:file:bg-sunken"
        />
        <Submit pending={pending} pendingLabel="Uploading">
          Upload
        </Submit>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <FormMessage state={state} />
    </form>
  );
}
