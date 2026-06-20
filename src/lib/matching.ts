import type { Landmark, Listing, QuizAnswers, RoommateProfile } from "../types";

const moneyPattern = /\$?\b([0-9]{3,5})(?:\s*\/?\s*(?:mo|month|monthly|person|bed))?\b/gi;

export function formatMoney(value?: number) {
  if (value === undefined || Number.isNaN(value)) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value?: string) {
  if (!value) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function pricePerBed(listing: Listing) {
  if (listing.category === "Roommate") {
    return listing.price;
  }

  if (listing.bedrooms && listing.bedrooms > 0) {
    return Math.round(listing.price / listing.bedrooms);
  }

  return listing.price;
}

export function normalizedBedroomLabel(listing: Listing) {
  if (listing.bedrooms === undefined) {
    return "N/A";
  }

  if (listing.bedrooms === 0) {
    return "Studio";
  }

  return `${listing.bedrooms} bed`;
}

export function extractBudget(query: string) {
  const matches = [...query.matchAll(moneyPattern)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value));

  if (!matches.length) {
    return undefined;
  }

  return Math.max(...matches);
}

function containsAny(haystack: string, terms: string[]) {
  return terms.some((term) => haystack.includes(term));
}

export function scoreListing(query: string, listing: Listing) {
  const normalized = query.toLowerCase();
  const searchable = [
    listing.title,
    listing.category,
    listing.neighborhood,
    listing.address,
    listing.description,
    listing.amenities.join(" "),
    listing.tags.join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const budget = extractBudget(query);
  let score = 0;
  const reasons: string[] = [];

  for (const term of normalized.split(/[^a-z0-9+]+/).filter(Boolean)) {
    if (term.length > 2 && searchable.includes(term)) {
      score += 4;
    }
  }

  if (budget !== undefined) {
    const price = pricePerBed(listing);
    if (price <= budget) {
      score += 24;
      reasons.push(`${formatMoney(price)} per bed is within budget`);
    } else if (price <= budget * 1.15) {
      score += 8;
      reasons.push(`${formatMoney(price)} per bed is slightly above budget`);
    }
  }

  const categoryRules: Array<[string[], Listing["category"], string]> = [
    [["roommate", "roomate", "housemate"], "Roommate", "roommate search"],
    [["sublet", "sublease", "summer"], "Sublease", "sublease"],
    [["takeover", "lease"], "Lease Takeover", "lease takeover"],
    [["furniture", "sofa", "desk", "chair"], "Furniture", "furniture"],
    [["bike", "car", "vehicle"], "Vehicle", "vehicle"],
  ];

  for (const [terms, category, reason] of categoryRules) {
    if (containsAny(normalized, terms) && listing.category === category) {
      score += 24;
      reasons.push(`matches ${reason}`);
    }
  }

  const amenityRules: Array<[string[], string, number]> = [
    [["cat", "cats"], "Cat Friendly", 16],
    [["lgbt", "lgbtq", "inclusive"], "LGBTQ+ Friendly", 16],
    [["lake", "lakefront", "mendota"], "Lakefront", 16],
    [["parking", "car"], "Parking", 10],
    [["furnished", "furniture"], "Furnished", 10],
    [["dishwasher"], "Dishwasher", 8],
    [["balcony"], "Balcony", 8],
    [["utilities", "included"], "Utilities Included", 8],
    [["bus", "transit"], "Bus Line", 8],
  ];

  for (const [terms, amenity, weight] of amenityRules) {
    if (containsAny(normalized, terms) && listing.amenities.includes(amenity as never)) {
      score += weight;
      reasons.push(`has ${amenity.toLowerCase()}`);
    }
  }

  if (containsAny(normalized, ["urgent", "soon", "asap"]) && listing.urgency === "High") {
    score += 10;
    reasons.push("marked urgent");
  }

  if (containsAny(normalized, ["downtown", "state street"]) && listing.neighborhood === "Downtown") {
    score += 12;
    reasons.push("downtown location");
  }

  if (containsAny(normalized, ["grad", "graduate"]) && listing.neighborhood === "Eagle Heights") {
    score += 10;
    reasons.push("graduate housing fit");
  }

  if (containsAny(normalized, ["verified", "safe"]) && listing.verified) {
    score += 8;
    reasons.push("verified source");
  }

  if (!reasons.length && score > 0) {
    reasons.push("keyword overlap with listing details");
  }

  return {
    listing,
    score: Math.min(100, Math.round(score)),
    reasons: reasons.slice(0, 4),
  };
}

export function aiSearch(query: string, listings: Listing[]) {
  if (!query.trim()) {
    return [];
  }

  return listings
    .map((listing) => scoreListing(query, listing))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || pricePerBed(a.listing) - pricePerBed(b.listing))
    .slice(0, 4);
}

function tokenize(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2),
  );
}

function jaccard(a: Set<string>, b: Set<string>) {
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

function normalizeAddress(value?: string) {
  return (value ?? "")
    .toLowerCase()
    .replace(/\bstreet\b/g, "st")
    .replace(/\bplace\b/g, "pl")
    .replace(/\beast\b/g, "e")
    .replace(/\bwest\b/g, "w")
    .replace(/[^a-z0-9]/g, "");
}

export function detectDuplicates(listings: Listing[]) {
  const duplicates: Array<{
    a: Listing;
    b: Listing;
    confidence: number;
    reasons: string[];
  }> = [];

  for (let i = 0; i < listings.length; i += 1) {
    for (let j = i + 1; j < listings.length; j += 1) {
      const a = listings[i];
      const b = listings[j];
      const addressMatch =
        normalizeAddress(a.address) !== "" && normalizeAddress(a.address) === normalizeAddress(b.address);
      const textSimilarity = jaccard(tokenize(`${a.title} ${a.description}`), tokenize(`${b.title} ${b.description}`));
      const priceMatch = Math.abs(pricePerBed(a) - pricePerBed(b)) <= 40;
      const duplicateGroupMatch = a.duplicateGroup && a.duplicateGroup === b.duplicateGroup;
      const confidence = Math.round(
        (addressMatch ? 42 : 0) +
          (priceMatch ? 18 : 0) +
          textSimilarity * 36 +
          (duplicateGroupMatch ? 24 : 0),
      );

      if (confidence >= 55) {
        duplicates.push({
          a,
          b,
          confidence: Math.min(confidence, 99),
          reasons: [
            addressMatch ? "same normalized address" : "",
            priceMatch ? "similar per-person price" : "",
            textSimilarity > 0.25 ? "high description overlap" : "",
            duplicateGroupMatch ? "same imported duplicate group" : "",
          ].filter(Boolean),
        });
      }
    }
  }

  return duplicates.sort((a, b) => b.confidence - a.confidence);
}

function scheduleValue(schedule: QuizAnswers["schedule"]) {
  return schedule === "Early" ? 0.15 : schedule === "Flexible" ? 0.55 : 0.95;
}

function petsValue(pets: QuizAnswers["pets"]) {
  const map = {
    "No pets": 0.05,
    "Cats ok": 0.45,
    "Dogs ok": 0.65,
    "Pet friendly": 0.95,
  };
  return map[pets];
}

function genderValue(genderPreference: QuizAnswers["genderPreference"]) {
  const map = {
    "No preference": 0.5,
    "Women preferred": 0.75,
    "Men preferred": 0.25,
  };
  return map[genderPreference];
}

function quizVector(value: QuizAnswers | RoommateProfile) {
  return [
    value.cleanliness / 10,
    scheduleValue(value.schedule),
    value.noiseTolerance / 10,
    value.socialEnergy / 10,
    petsValue(value.pets),
    value.inclusivity / 10,
    Math.min(value.budget, 2500) / 2500,
    genderValue(value.genderPreference),
  ];
}

function cosine(a: number[], b: number[]) {
  const dot = a.reduce((total, current, index) => total + current * b[index], 0);
  const magnitudeA = Math.sqrt(a.reduce((total, current) => total + current * current, 0));
  const magnitudeB = Math.sqrt(b.reduce((total, current) => total + current * current, 0));
  return dot / (magnitudeA * magnitudeB);
}

export function matchRoommates(answers: QuizAnswers, profiles: RoommateProfile[]) {
  const vector = quizVector(answers);

  return profiles
    .map((profile) => {
      const similarity = cosine(vector, quizVector(profile));
      const budgetFit = Math.max(0, 1 - Math.abs(answers.budget - profile.budget) / 1200);
      const score = Math.round((similarity * 0.8 + budgetFit * 0.2) * 100);
      return {
        profile,
        score,
        notes: [
          Math.abs(answers.cleanliness - profile.cleanliness) <= 2 ? "similar cleanliness expectations" : "",
          answers.schedule === profile.schedule || answers.schedule === "Flexible" || profile.schedule === "Flexible"
            ? "compatible schedules"
            : "",
          answers.pets === profile.pets || profile.pets === "Pet friendly" || answers.pets === "Pet friendly"
            ? "pet preferences align"
            : "",
          Math.abs(answers.budget - profile.budget) <= 150 ? "budget is close" : "",
          answers.inclusivity >= 8 && profile.inclusivity >= 8 ? "strong inclusivity match" : "",
        ].filter(Boolean),
      };
    })
    .sort((a, b) => b.score - a.score);
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceMiles(a: Landmark["coordinates"], b: Landmark["coordinates"]) {
  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(h));
}

export function travelEstimate(listing: Listing, landmark: Landmark) {
  if (!listing.coordinates) {
    return {
      miles: undefined,
      walkMinutes: undefined,
      bikeMinutes: undefined,
      busMinutes: undefined,
    };
  }

  const miles = distanceMiles(listing.coordinates, landmark.coordinates);

  return {
    miles,
    walkMinutes: Math.max(2, Math.round((miles / 3) * 60)),
    bikeMinutes: Math.max(2, Math.round((miles / 10) * 60)),
    busMinutes: Math.max(6, Math.round((miles / 13) * 60 + 6)),
  };
}
