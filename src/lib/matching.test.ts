import { describe, expect, it } from "vitest";
import { campusLandmarks, listings, roommateProfiles } from "../data/listings";
import {
  aiSearch,
  detectDuplicates,
  matchRoommates,
  pricePerBed,
  travelEstimate,
} from "./matching";

describe("listing intelligence", () => {
  it("normalizes roommate listing prices to a comparable per-bed price", () => {
    const axton = listings.find((listing) => listing.id === "axton-lease-takeover");
    const lakelawn = listings.find((listing) => listing.id === "lakelawn-roommate");

    expect(axton && pricePerBed(axton)).toBe(2210);
    expect(lakelawn && pricePerBed(lakelawn)).toBe(965);
  });

  it("finds natural-language matches by budget, category, and amenities", () => {
    const results = aiSearch("cat and LGBTQ friendly roommate under $1000 by the lake", listings);

    expect(results[0].listing.id).toBe("lakelawn-roommate");
    expect(results[0].score).toBeGreaterThan(70);
  });

  it("flags likely duplicate reposts", () => {
    const duplicates = detectDuplicates(listings);

    expect(duplicates.some((match) => match.a.id === "lakelawn-roommate" && match.b.id === "lakefront-repost")).toBe(
      true,
    );
  });

  it("scores roommate compatibility with vector similarity", () => {
    const matches = matchRoommates(
      {
        cleanliness: 8,
        schedule: "Flexible",
        noiseTolerance: 4,
        socialEnergy: 7,
        pets: "Cats ok",
        inclusivity: 10,
        budget: 1000,
        genderPreference: "Women preferred",
      },
      roommateProfiles,
    );

    expect(matches[0].profile.id).toBe("julia");
    expect(matches[0].score).toBeGreaterThan(90);
  });

  it("computes distance estimates to a selected campus building", () => {
    const listing = listings.find((item) => item.id === "mifflin-studio");
    const landmark = campusLandmarks.find((item) => item.id === "memorial-union");

    expect(listing && landmark && travelEstimate(listing, landmark).walkMinutes).toBeGreaterThan(0);
  });
});
