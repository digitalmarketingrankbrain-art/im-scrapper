import { describe, expect, it } from "vitest";
import { limitImages, MAX_IMAGES_PER_PRODUCT } from "./product";

describe("limitImages", () => {
  it("keeps at most 5 images in their original order", () => {
    const images = Array.from({ length: 40 }, (_, i) => ({ url: `https://5.imimg.com/data5/SELLER/p${i}-500x500.jpg` }));
    const kept = limitImages(images);
    expect(kept).toHaveLength(MAX_IMAGES_PER_PRODUCT);
    expect(kept.map((i) => i.url)).toEqual(images.slice(0, 5).map((i) => i.url));
  });

  it("counts the same photo at two sizes once", () => {
    const kept = limitImages([
      { url: "https://5.imimg.com/a/label-250x250.jpg" },
      { url: "https://5.imimg.com/a/label-500x500.jpg" },
      { url: "https://5.imimg.com/a/other-500x500.jpg" },
    ]);
    expect(kept.map((i) => i.url)).toEqual(["https://5.imimg.com/a/label-250x250.jpg", "https://5.imimg.com/a/other-500x500.jpg"]);
  });

  it("handles missing input", () => {
    expect(limitImages(undefined)).toEqual([]);
  });
});
