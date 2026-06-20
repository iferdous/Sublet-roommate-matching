import { describe, expect, it } from "vitest";
import { aiSearch, bootstrap, detectDuplicates, filterListings, matchRoommates, publicListings } from "./intelligence.mjs";

describe("backend marketplace intelligence", () => {
  it("keeps duplicate reposts out of the public listing feed", () => {
    const duplicates = detectDuplicates();
    const publicIds = publicListings().map((listing) => listing.id);

    expect(duplicates.length).toBeGreaterThan(0);
    expect(publicIds).not.toContain("lakefront-repost");
  });

  it("returns a strong AI result for a natural language apartment request", () => {
    const results = aiSearch("sunny studio near Mifflin under $1100 with balcony");

    expect(results[0].listing.id).toBe("mifflin-studio");
    expect(results[0].score).toBeGreaterThan(50);
  });

  it("filters category and price server-side", () => {
    const filtered = filterListings({ category: "Free", maxPrice: "0" });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("free-desk-lamp");
  });

  it("matches roommates with vector-style quiz similarity", () => {
    const matches = matchRoommates({
      cleanliness: 8,
      schedule: "Flexible",
      noiseTolerance: 4,
      socialEnergy: 7,
      pets: "Cats ok",
      inclusivity: 10,
      budget: 1000,
      genderPreference: "Women preferred",
    });

    expect(matches[0].profile.id).toBe("julia");
    expect(matches[0].score).toBeGreaterThan(90);
  });

  it("bootstraps categories and source metadata for the frontend", () => {
    const data = bootstrap();

    expect(data.categories.some((category) => category.name === "Electronics")).toBe(true);
    expect(data.sources.length).toBeGreaterThanOrEqual(4);
  });
});
