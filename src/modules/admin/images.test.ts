import { describe, expect, it } from "vitest";
import { MAX_IMAGE_BYTES, checkImageUpload, randomImageName, sniffImageType } from "./images";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const webp = new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]);

describe("sniffImageType", () => {
  it("detects JPEG, PNG and WebP by content", () => {
    expect(sniffImageType(jpeg)).toBe("image/jpeg");
    expect(sniffImageType(png)).toBe("image/png");
    expect(sniffImageType(webp)).toBe("image/webp");
  });

  it("rejects SVG, HTML and GIF even when named like an image", () => {
    expect(sniffImageType(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"))).toBeNull();
    expect(sniffImageType(Buffer.from("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffImageType(Buffer.from("GIF89a"))).toBeNull();
  });
});

describe("checkImageUpload", () => {
  it("accepts a small valid image", () => {
    expect(checkImageUpload(png)).toEqual({ ok: true, type: "image/png" });
  });

  it("rejects empty, oversized and unknown files", () => {
    expect(checkImageUpload(new Uint8Array())).toMatchObject({ ok: false });
    const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
    big.set(jpeg);
    expect(checkImageUpload(big)).toMatchObject({ ok: false, message: expect.stringMatching(/2 MB/) });
    expect(checkImageUpload(Buffer.from("hello"))).toMatchObject({ ok: false });
  });
});

describe("randomImageName", () => {
  it("is random, unguessable and uses the sniffed extension", () => {
    const a = randomImageName("image/webp");
    const b = randomImageName("image/webp");
    expect(a).toMatch(/^products\/[0-9a-f]{32}\.webp$/);
    expect(a).not.toBe(b);
  });
});
