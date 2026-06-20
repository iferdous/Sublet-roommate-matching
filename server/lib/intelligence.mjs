import { campusLandmarks, listings, roommateProfiles, sourceConfigs } from "../data/seed.mjs";

const moneyPattern = /\$?\b([0-9]{1,5})(?:\s*\/?\s*(?:mo|month|monthly|person|bed))?\b/gi;
const categoryPriority = {
  Sublease: 96,
  "Lease Takeover": 92,
  Roommate: 88,
  Parking: 66,
  Furniture: 58,
  Vehicle: 56,
  Electronics: 52,
  Textbooks: 48,
  Free: 46,
};

export function formatMoney(value) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function pricePerBed(listing) {
  if (listing.category === "Roommate") {
    return listing.price;
  }

  if (listing.bedrooms && listing.bedrooms > 0) {
    return Math.round(listing.price / listing.bedrooms);
  }

  return listing.price;
}

function normalizeAddress(value = "") {
  return value
    .toLowerCase()
    .replace(/\bstreet\b/g, "st")
    .replace(/\bplace\b/g, "pl")
    .replace(/\beast\b/g, "e")
    .replace(/\bwest\b/g, "w")
    .replace(/\bnorth\b/g, "n")
    .replace(/\bsouth\b/g, "s")
    .replace(/[^a-z0-9]/g, "");
}

function tokenize(value) {
  return new Set(
    String(value)
      .toLowerCase()
      .replace(/[^a-z0-9\s+]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2),
  );
}

function jaccard(a, b) {
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

export function detectDuplicates(items = listings) {
  const duplicates = [];

  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const a = items[i];
      const b = items[j];
      const addressA = normalizeAddress(a.address);
      const addressB = normalizeAddress(b.address);
      const addressMatch = addressA !== "" && addressA === addressB;
      const textSimilarity = jaccard(tokenize(`${a.title} ${a.description}`), tokenize(`${b.title} ${b.description}`));
      const priceMatch = Math.abs(pricePerBed(a) - pricePerBed(b)) <= 40;
      const duplicateGroupMatch = a.duplicateGroup && a.duplicateGroup === b.duplicateGroup;
      const confidence = Math.round(
        (addressMatch ? 42 : 0) +
          (priceMatch ? 18 : 0) +
          textSimilarity * 36 +
          (duplicateGroupMatch ? 28 : 0) +
          (a.hiddenDuplicate || b.hiddenDuplicate ? 18 : 0),
      );

      if (confidence >= 55) {
        duplicates.push({
          keepId: a.hiddenDuplicate ? b.id : a.id,
          hiddenId: a.hiddenDuplicate ? a.id : b.id,
          a,
          b,
          confidence: Math.min(confidence, 99),
          reasons: [
            addressMatch ? "same normalized address" : "",
            priceMatch ? "similar normalized price" : "",
            textSimilarity > 0.24 ? "high text similarity" : "",
            duplicateGroupMatch ? "same imported duplicate group" : "",
          ].filter(Boolean),
        });
      }
    }
  }

  return duplicates.sort((a, b) => b.confidence - a.confidence);
}

export function publicListings(items = listings) {
  const duplicateIds = new Set(detectDuplicates(items).map((match) => match.hiddenId));
  return items.filter((item) => !item.hiddenDuplicate && !duplicateIds.has(item.id));
}

export function extractBudget(query = "") {
  const matches = [...String(query).matchAll(moneyPattern)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value));
  return matches.length ? Math.max(...matches) : undefined;
}

function containsAny(haystack, terms) {
  return terms.some((term) => haystack.includes(term));
}

export function scoreListing(query, listing, landmark = campusLandmarks[0]) {
  const normalized = String(query).toLowerCase();
  const searchable = [
    listing.title,
    listing.category,
    listing.neighborhood,
    listing.address,
    listing.description,
    listing.amenities?.join(" "),
    listing.tags?.join(" "),
    listing.sourceSection,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const budget = extractBudget(query);
  let score = 0;
  const reasons = [];

  for (const term of normalized.split(/[^a-z0-9+]+/).filter(Boolean)) {
    if (term.length > 2 && searchable.includes(term)) {
      score += 4;
    }
  }

  if (budget !== undefined) {
    const price = pricePerBed(listing);
    if (price <= budget) {
      score += 24;
      reasons.push(`${formatMoney(price)} is within budget`);
    } else if (price <= budget * 1.15) {
      score += 8;
      reasons.push(`${formatMoney(price)} is close to budget`);
    }
  }

  const categoryRules = [
    [["roommate", "roomate", "housemate"], "Roommate", "roommate search"],
    [["sublet", "sublease", "summer", "studio"], "Sublease", "sublet"],
    [["takeover", "lease"], "Lease Takeover", "lease takeover"],
    [["furniture", "sofa", "desk", "chair"], "Furniture", "furniture"],
    [["bike", "car", "vehicle"], "Vehicle", "vehicle"],
    [["textbook", "book", "class"], "Textbooks", "textbook"],
    [["laptop", "electronics", "macbook"], "Electronics", "electronics"],
    [["parking"], "Parking", "parking"],
    [["free"], "Free", "free item"],
  ];

  for (const [terms, category, reason] of categoryRules) {
    if (containsAny(normalized, terms) && listing.category === category) {
      score += 22;
      reasons.push(`matches ${reason}`);
    }
  }

  const amenityRules = [
    [["cat", "cats"], "Cat Friendly", 16],
    [["lgbt", "lgbtq", "inclusive"], "LGBTQ+ Friendly", 16],
    [["lake", "lakefront", "mendota"], "Lakefront", 16],
    [["parking", "car"], "Parking", 10],
    [["furnished", "furniture"], "Furnished", 10],
    [["dishwasher"], "Dishwasher", 8],
    [["balcony"], "Balcony", 8],
    [["utilities", "included"], "Utilities Included", 8],
    [["bus", "transit"], "Bus Line", 8],
    [["gym"], "Gym", 8],
    [["study"], "Study Room", 8],
  ];

  for (const [terms, amenity, weight] of amenityRules) {
    if (containsAny(normalized, terms) && listing.amenities?.includes(amenity)) {
      score += weight;
      reasons.push(`has ${amenity.toLowerCase()}`);
    }
  }

  if (containsAny(normalized, ["urgent", "soon", "asap"]) && listing.urgency === "High") {
    score += 10;
    reasons.push("marked urgent");
  }

  if (containsAny(normalized, ["near", "close", "walk", "bike", "bus"]) && listing.coordinates) {
    const estimate = travelEstimate(listing, landmark);
    if (estimate.walkMinutes && estimate.walkMinutes <= 15) {
      score += 10;
      reasons.push(`near ${landmark.name}`);
    }
  }

  if (containsAny(normalized, ["verified", "safe"]) && listing.verified) {
    score += 8;
    reasons.push("verified source");
  }

  if (!reasons.length && score > 0) {
    reasons.push("keyword overlap");
  }

  return { listing, score: Math.min(100, Math.round(score)), reasons: reasons.slice(0, 5) };
}

export function aiSearch(query, items = publicListings(), options = {}) {
  const landmark = campusLandmarks.find((item) => item.id === options.landmarkId) ?? campusLandmarks[0];
  if (!String(query).trim()) {
    return [];
  }

  return items
    .map((listing) => scoreListing(query, listing, landmark))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || pricePerBed(a.listing) - pricePerBed(b.listing))
    .slice(0, 8);
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

export function distanceMiles(a, b) {
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

export function travelEstimate(listing, landmark) {
  if (!listing.coordinates || !landmark?.coordinates) {
    return { miles: null, walkMinutes: null, bikeMinutes: null, busMinutes: null };
  }

  const miles = distanceMiles(listing.coordinates, landmark.coordinates);
  return {
    miles,
    walkMinutes: Math.max(2, Math.round((miles / 3) * 60)),
    bikeMinutes: Math.max(2, Math.round((miles / 10) * 60)),
    busMinutes: Math.max(6, Math.round((miles / 13) * 60 + 6)),
  };
}

function scheduleValue(schedule) {
  return schedule === "Early" ? 0.15 : schedule === "Flexible" ? 0.55 : 0.95;
}

function petsValue(pets) {
  return {
    "No pets": 0.05,
    "Cats ok": 0.45,
    "Dogs ok": 0.65,
    "Pet friendly": 0.95,
  }[pets];
}

function genderValue(genderPreference) {
  return {
    "No preference": 0.5,
    "Women preferred": 0.75,
    "Men preferred": 0.25,
  }[genderPreference];
}

function quizVector(value) {
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

function cosine(a, b) {
  const dot = a.reduce((total, current, index) => total + current * b[index], 0);
  const magnitudeA = Math.sqrt(a.reduce((total, current) => total + current * current, 0));
  const magnitudeB = Math.sqrt(b.reduce((total, current) => total + current * current, 0));
  return dot / (magnitudeA * magnitudeB);
}

export function matchRoommates(answers, profiles = roommateProfiles) {
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

export function filterListings(query = {}, items = publicListings()) {
  const search = String(query.search ?? "").toLowerCase();
  const maxPrice = Number(query.maxPrice ?? 99999);
  const minPrice = Number(query.minPrice ?? 0);
  const category = query.category ?? "All";
  const neighborhood = query.neighborhood ?? "All";
  const landmark = campusLandmarks.find((item) => item.id === query.landmarkId) ?? campusLandmarks[0];
  const maxDistance = query.maxDistance ? Number(query.maxDistance) : null;

  return items.filter((listing) => {
    const searchable = [
      listing.title,
      listing.category,
      listing.neighborhood,
      listing.address,
      listing.description,
      listing.tags?.join(" "),
      listing.amenities?.join(" "),
      listing.sourceSection,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const price = pricePerBed(listing);
    const distance = travelEstimate(listing, landmark).miles;

    return (
      (!search || searchable.includes(search)) &&
      (category === "All" || listing.category === category) &&
      (neighborhood === "All" || listing.neighborhood === neighborhood) &&
      price >= minPrice &&
      price <= maxPrice &&
      (!query.verifiedOnly || listing.verified) &&
      (!query.petFriendlyOnly || listing.amenities?.includes("Pet Friendly") || listing.amenities?.includes("Cat Friendly")) &&
      (!maxDistance || (distance !== null && distance <= maxDistance))
    );
  });
}

export function sortListings(items, sort = "Recommended", landmarkId = "memorial-union") {
  const landmark = campusLandmarks.find((item) => item.id === landmarkId) ?? campusLandmarks[0];
  const score = (listing) =>
    (categoryPriority[listing.category] ?? 30) +
    (listing.verified ? 9 : 0) +
    (listing.urgency === "High" ? 9 : listing.urgency === "Medium" ? 4 : 0) +
    (listing.extractionConfidence ?? 0.5) * 4 -
    pricePerBed(listing) / 1400;

  return [...items].sort((a, b) => {
    if (sort === "Lowest price") return pricePerBed(a) - pricePerBed(b);
    if (sort === "Highest price") return pricePerBed(b) - pricePerBed(a);
    if (sort === "Newest") return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
    if (sort === "Closest to selected place") {
      return (travelEstimate(a, landmark).miles ?? Infinity) - (travelEstimate(b, landmark).miles ?? Infinity);
    }
    if (sort === "Most urgent") {
      const urgency = { High: 3, Medium: 2, Low: 1 };
      return (urgency[b.urgency] ?? 0) - (urgency[a.urgency] ?? 0);
    }
    if (sort === "Verified first") return Number(b.verified) - Number(a.verified);
    if (sort === "Highest AI match") return (b.extractionConfidence ?? 0) - (a.extractionConfidence ?? 0);
    return score(b) - score(a) || pricePerBed(a) - pricePerBed(b);
  });
}

export function listingWithDistances(listing, landmarkId = "memorial-union") {
  const selected = campusLandmarks.find((item) => item.id === landmarkId) ?? campusLandmarks[0];
  const commutes = campusLandmarks.slice(0, 6).map((landmark) => ({
    landmark,
    ...travelEstimate(listing, landmark),
  }));
  return {
    ...listing,
    selectedDistance: travelEstimate(listing, selected),
    commutes,
  };
}

export function categories(items = publicListings()) {
  const names = ["All", "Sublease", "Lease Takeover", "Roommate", "Furniture", "Vehicle", "Textbooks", "Electronics", "Parking", "Free"];
  return names.map((name) => ({
    name,
    count: name === "All" ? items.length : items.filter((listing) => listing.category === name).length,
  }));
}

export function stats(items = publicListings()) {
  const housing = items.filter((listing) => ["Sublease", "Lease Takeover", "Roommate"].includes(listing.category));
  const prices = housing.map(pricePerBed).sort((a, b) => a - b);
  const median = prices[Math.floor(prices.length / 2)] ?? 0;
  return [
    { label: "Live listings", value: String(items.length), detail: "deduped across sources" },
    { label: "Median per bed", value: formatMoney(median), detail: "normalized for roommates" },
    { label: "Source sections", value: String(new Set(items.map((listing) => listing.sourceSection)).size), detail: "Facebook, Craigslist, campus" },
    { label: "Verified posts", value: String(items.filter((listing) => listing.verified).length), detail: "higher trust signals" },
  ];
}

export function bootstrap() {
  const visible = publicListings();
  return {
    listings: sortListings(visible),
    categories: categories(visible),
    landmarks: campusLandmarks,
    sources: sourceConfigs,
    roommateProfiles,
    stats: stats(visible),
    duplicatesHidden: detectDuplicates(listings).length,
    sortOptions: [
      "Recommended",
      "Lowest price",
      "Highest price",
      "Newest",
      "Closest to selected place",
      "Highest AI match",
      "Most urgent",
      "Verified first",
    ],
    neighborhoods: ["All", ...Array.from(new Set(visible.map((listing) => listing.neighborhood))).sort()],
  };
}

export function aiReply(query, results) {
  if (!results.length) {
    return "I could not find a strong match yet. Try adding a budget, neighborhood, category, or must-have amenity.";
  }
  const top = results[0];
  return `I found ${results.length} promising option${results.length === 1 ? "" : "s"}. Best match: ${top.listing.title} at ${formatMoney(
    pricePerBed(top.listing),
  )}. Why: ${top.reasons.join(", ")}.`;
}

export function ingestionStatus() {
  return sourceConfigs.map((source) => ({
    ...source,
    lastRun: "2026-06-20T03:30:00.000Z",
    recordsSeen: listings.filter((listing) => listing.source === source.kind).length,
    visibleAfterDedupe: publicListings().filter((listing) => listing.source === source.kind).length,
  }));
}

export function createListing(input) {
  const id = `manual-${Date.now()}`;
  const listing = {
    id,
    title: input.title || "Untitled campus listing",
    category: input.category || "Sublease",
    source: "Manual",
    sourceSection: "User submission",
    sourceUrl: input.sourceUrl || "",
    verified: false,
    neighborhood: input.neighborhood || "Madison",
    address: input.address || "Madison, WI",
    coordinates: input.coordinates || { lat: 43.0731, lng: -89.4012 },
    image: input.image || "https://images.unsplash.com/photo-1560184897-ae75f418493e?auto=format&fit=crop&w=1400&q=82",
    price: Number(input.price || 0),
    bedrooms: input.bedrooms === "" || input.bedrooms === undefined ? null : Number(input.bedrooms),
    bathrooms: input.bathrooms === "" || input.bathrooms === undefined ? null : Number(input.bathrooms),
    amenities: input.amenities || [],
    tags: String(input.description || "").toLowerCase().split(/\s+/).filter((term) => term.length > 4).slice(0, 8),
    description: input.description || "User-submitted listing awaiting review.",
    contactHint: "Submitted locally; connect a real account/source before publishing publicly.",
    postedAt: new Date().toISOString().slice(0, 10),
    urgency: "Medium",
    extractionConfidence: 0.62,
  };
  listings.unshift(listing);
  return listingWithDistances(listing);
}
