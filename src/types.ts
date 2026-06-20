export type ListingCategory =
  | "Sublease"
  | "Lease Takeover"
  | "Roommate"
  | "Furniture"
  | "Vehicle";

export type ListingSource =
  | "Facebook"
  | "UW Sublets"
  | "Craigslist"
  | "Campus Import"
  | "Manual";

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
  | "Natural Light";

export type Coordinates = {
  lat: number;
  lng: number;
};

export type Listing = {
  id: string;
  title: string;
  category: ListingCategory;
  source: ListingSource;
  verified: boolean;
  neighborhood: string;
  address?: string;
  coordinates?: Coordinates;
  image: string;
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
};

export type Landmark = {
  id: string;
  name: string;
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
  status: "Prototype" | "Manual review required" | "Ready for API";
  note: string;
};
