"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { ProductDetail } from "@/modules/catalog/types";

export function ProductGallery({ images, title }: { images: ProductDetail["images"]; title: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? images[0];
  const alt = active?.alt || title;

  return (
    <div>
      <div className="aspect-square w-full rounded-card bg-sunken p-3">
        {active ? (
          <Image
            src={active.url}
            alt={alt}
            width={720}
            height={720}
            priority
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-inkMuted">No image</div>
        )}
      </div>
      {images.length > 1 ? (
        <ul className="mt-3 flex gap-2 overflow-x-auto" aria-label="Product images">
          {images.map((image, index) => (
            <li key={image.url}>
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Show image ${index + 1}`}
                aria-current={index === activeIndex}
                className={cn(
                  "h-16 w-16 shrink-0 rounded-btn border bg-sunken p-1.5 transition-colors duration-150",
                  index === activeIndex ? "border-brand" : "border-line hover:border-lineStrong",
                )}
              >
                <Image src={image.url} alt="" width={64} height={64} className="h-full w-full object-contain" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
