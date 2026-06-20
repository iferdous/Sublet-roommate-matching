export type ListingCategory =
  | "All"
  | "Sublease"
  | "Lease Takeover"
  | "Roommate"
  | "Furniture"
  | "Vehicle"
  | "Textbooks"
  | "Electronics"
  | "Parking"
  | "Free";

export type ListingSource =
  | "Facebook"
  | "UW Sublets"
  | "Craigslist"
  | "Campus Import"
  | "Manual"
  | "Imported Feed";

export type Amenity =
  | "Balcony"
  | "Dishwasher"
  | "Furnished"
  | "Lakefront"
  | "Laundry"
  | "Parking"
  | "Pet Friendly"
  | "Utilities Included"
  | "LGBTQ+ Friendly"
  | "Cat Friendly"
  | "Bus Line"
  | "Natural Light"
  | "Air Conditioning"
  | "Gym"
  | "Study Room"
  | "Bike Storage"
  | "Free"
  | "Negotiable";

export type Coordinates = {
  lat: number;
  lng: number;
};

export type Listing = {
  id: string;
  title: string;
  category: ListingCategory;
  source: ListingSource;
  sourceUrl?: string;
  verified: boolean;
  neighborhood: string;
  address?: string;
  coordinates?: Coordinates;
  image: string;
  gallery?: string[];
  price: number;
  priceLabel?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFeet?: number;
  leaseStart?: string;
  leaseEnd?: string;
  availableNow?: boolean;
  furnished?: boolean;
  roommateSplit?: number;
  utilities?: string[];
  amenities: Amenity[];
  tags: string[];
  description: string;
  contactHint: string;
  postedAt: string;
  duplicateGroup?: string;
  urgency?: "Low" | "Medium" | "High";
  floor?: string;
  extractionConfidence?: number;
  sourceSection?: string;
  hiddenDuplicate?: boolean;
  selectedDistance?: {
    miles: number | null;
    walkMinutes: number | null;
    bikeMinutes: number | null;
    busMinutes: number | null;
  };
  commutes?: Array<{
    landmark: Landmark;
    miles: number | null;
    walkMinutes: number | null;
    bikeMinutes: number | null;
    busMinutes: number | null;
  }>;
};

export type Landmark = {
  id: string;
  name: string;
  type?: "Campus" | "Madison" | "Transit" | "Health" | "Nightlife";
  coordinates: Coordinates;
};

export type RoommateProfile = {
  id: string;
  name: string;
  listingId: string;
  age?: number;
  program: string;
  cleanliness: number;
  schedule: "Early" | "Flexible" | "Night";
  noiseTolerance: number;
  socialEnergy: number;
  pets: "No pets" | "Cats ok" | "Dogs ok" | "Pet friendly";
  inclusivity: number;
  budget: number;
  genderPreference: "No preference" | "Women preferred" | "Men preferred";
  bio: string;
  interests: string[];
};

export type QuizAnswers = {
  cleanliness: number;
  schedule: "Early" | "Flexible" | "Night";
  noiseTolerance: number;
  socialEnergy: number;
  pets: "No pets" | "Cats ok" | "Dogs ok" | "Pet friendly";
  inclusivity: number;
  budget: number;
  genderPreference: "No preference" | "Women preferred" | "Men preferred";
};

export type SourceConfig = {
  name: string;
  url: string;
  kind: ListingSource;
  status: "Prototype" | "Manual review required" | "Ready for API" | "Connected";
  note: string;
};

export type SortOption =
  | "Recommended"
  | "Lowest price"
  | "Highest price"
  | "Newest"
  | "Closest to selected place"
  | "Highest AI match"
  | "Most urgent"
  | "Verified first";

export type AppView = "market" | "ai" | "roommates" | "map" | "post";
