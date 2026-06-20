import {
  AlertTriangle,
  Bike,
  Brain,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Home,
  MapPin,
  Route,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sofa,
  Sparkles,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { campusLandmarks, listings, roommateProfiles, sourceConfigs } from "./data/listings";
import {
  aiSearch,
  detectDuplicates,
  formatDate,
  formatMoney,
  matchRoommates,
  normalizedBedroomLabel,
  pricePerBed,
  travelEstimate,
} from "./lib/matching";
import type { Listing, ListingCategory, QuizAnswers } from "./types";

const categoryOptions = ["All", "Sublease", "Lease Takeover", "Roommate", "Furniture", "Vehicle"] as const;
type CategoryFilter = (typeof categoryOptions)[number];

const categoryIcons: Record<ListingCategory, JSX.Element> = {
  Sublease: <Home size={16} />,
  "Lease Takeover": <Building2 size={16} />,
  Roommate: <Users size={16} />,
  Furniture: <Sofa size={16} />,
  Vehicle: <Bike size={16} />,
};

const defaultQuiz: QuizAnswers = {
  cleanliness: 8,
  schedule: "Flexible",
  noiseTolerance: 4,
  socialEnergy: 7,
  pets: "Cats ok",
  inclusivity: 10,
  budget: 1000,
  genderPreference: "Women preferred",
};

const categoryPriority: Record<ListingCategory, number> = {
  Sublease: 80,
  "Lease Takeover": 76,
  Roommate: 74,
  Furniture: 28,
  Vehicle: 24,
};

function field(value: string | number | undefined | null) {
  if (value === undefined || value === null || value === "") {
    return "N/A";
  }

  return value;
}

function App() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("All");
  const [maxPrice, setMaxPrice] = useState(2400);
  const [neighborhood, setNeighborhood] = useState("All");
  const [sort, setSort] = useState("Recommended");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [petFriendlyOnly, setPetFriendlyOnly] = useState(false);
  const [landmarkId, setLandmarkId] = useState(campusLandmarks[0].id);
  const [aiQuery, setAiQuery] = useState("cat and LGBTQ friendly roommate under $1000 by the lake");
  const [quiz, setQuiz] = useState<QuizAnswers>(defaultQuiz);
  const [selectedListingId, setSelectedListingId] = useState(listings[0].id);

  const selectedLandmark = campusLandmarks.find((item) => item.id === landmarkId) ?? campusLandmarks[0];
  const duplicateMatches = useMemo(() => detectDuplicates(listings), []);
  const aiResults = useMemo(() => aiSearch(aiQuery, listings), [aiQuery]);
  const roommateMatches = useMemo(() => matchRoommates(quiz, roommateProfiles), [quiz]);

  const neighborhoods = useMemo(
    () => ["All", ...Array.from(new Set(listings.map((listing) => listing.neighborhood))).sort()],
    [],
  );

  const filteredListings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = listings.filter((listing) => {
      const searchable = [
        listing.title,
        listing.category,
        listing.neighborhood,
        listing.address,
        listing.description,
        listing.tags.join(" "),
        listing.amenities.join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesQuery = normalizedQuery === "" || searchable.includes(normalizedQuery);
      const matchesCategory = category === "All" || listing.category === category;
      const matchesNeighborhood = neighborhood === "All" || listing.neighborhood === neighborhood;
      const matchesPrice = pricePerBed(listing) <= maxPrice;
      const matchesVerified = !verifiedOnly || listing.verified;
      const matchesPets =
        !petFriendlyOnly ||
        listing.amenities.includes("Pet Friendly") ||
        listing.amenities.includes("Cat Friendly");

      return (
        matchesQuery &&
        matchesCategory &&
        matchesNeighborhood &&
        matchesPrice &&
        matchesVerified &&
        matchesPets
      );
    });

    return [...filtered].sort((a, b) => {
      if (sort === "Lowest price") {
        return pricePerBed(a) - pricePerBed(b);
      }

      if (sort === "Closest to campus") {
        const distanceA = travelEstimate(a, selectedLandmark).miles ?? Number.MAX_SAFE_INTEGER;
        const distanceB = travelEstimate(b, selectedLandmark).miles ?? Number.MAX_SAFE_INTEGER;
        return distanceA - distanceB;
      }

      if (sort === "Newest") {
        return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
      }

      const score = (listing: Listing) =>
        categoryPriority[listing.category] +
        (listing.verified ? 9 : 0) +
        (listing.urgency === "High" ? 8 : listing.urgency === "Medium" ? 4 : 0) -
        pricePerBed(listing) / 1000;

      return score(b) - score(a) || pricePerBed(a) - pricePerBed(b);
    });
  }, [category, maxPrice, neighborhood, petFriendlyOnly, query, selectedLandmark, sort, verifiedOnly]);

  const selectedListing = listings.find((listing) => listing.id === selectedListingId) ?? filteredListings[0] ?? listings[0];

  const stats = useMemo(() => {
    const housingListings = listings.filter((listing) => ["Sublease", "Lease Takeover", "Roommate"].includes(listing.category));
    const sortedPrices = housingListings.map(pricePerBed).sort((a, b) => a - b);
    const median = sortedPrices[Math.floor(sortedPrices.length / 2)] ?? 0;

    return [
      { label: "Listings indexed", value: listings.length.toString(), detail: "from 5 source types" },
      { label: "Median per bed", value: formatMoney(median), detail: "normalized for roommates" },
      { label: "Duplicate alerts", value: duplicateMatches.length.toString(), detail: "ready for review" },
      { label: "Verified posts", value: listings.filter((listing) => listing.verified).length.toString(), detail: "source confidence" },
    ];
  }, [duplicateMatches.length]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">UW-Madison marketplace intelligence</p>
          <h1>Sublet Scout</h1>
        </div>
        <div className="topbar-actions" aria-label="Product highlights">
          <span>
            <ShieldCheck size={16} /> Verified-first
          </span>
          <span>
            <Sparkles size={16} /> AI Finder
          </span>
          <span>
            <Route size={16} /> Campus distance
          </span>
        </div>
      </header>

      <section className="search-band" aria-label="Search and filters">
        <div className="search-row">
          <label className="search-box">
            <Search size={20} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search studio, lakefront, bike, cat friendly, Axton..."
            />
          </label>
          <label className="select-field">
            <span>Sort</span>
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option>Recommended</option>
              <option>Lowest price</option>
              <option>Closest to campus</option>
              <option>Newest</option>
            </select>
          </label>
        </div>

        <div className="category-tabs" role="tablist" aria-label="Listing categories">
          {categoryOptions.map((option) => (
            <button
              key={option}
              className={category === option ? "active" : ""}
              onClick={() => setCategory(option)}
              type="button"
            >
              {option === "All" ? <SlidersHorizontal size={16} /> : categoryIcons[option]}
              {option}
              <strong>{option === "All" ? listings.length : listings.filter((listing) => listing.category === option).length}</strong>
            </button>
          ))}
        </div>

        <div className="filter-grid">
          <label className="range-field">
            <span>Max price per bed</span>
            <strong>{formatMoney(maxPrice)}</strong>
            <input
              min="50"
              max="2500"
              step="25"
              type="range"
              value={maxPrice}
              onChange={(event) => setMaxPrice(Number(event.target.value))}
            />
          </label>
          <label className="select-field">
            <span>Neighborhood</span>
            <select value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)}>
              {neighborhoods.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="select-field">
            <span>Distance to</span>
            <select value={landmarkId} onChange={(event) => setLandmarkId(event.target.value)}>
              {campusLandmarks.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="check-field">
            <input
              checked={verifiedOnly}
              onChange={(event) => setVerifiedOnly(event.target.checked)}
              type="checkbox"
            />
            Verified only
          </label>
          <label className="check-field">
            <input
              checked={petFriendlyOnly}
              onChange={(event) => setPetFriendlyOnly(event.target.checked)}
              type="checkbox"
            />
            Pet friendly
          </label>
        </div>
      </section>

      <section className="stat-grid" aria-label="Marketplace statistics">
        {stats.map((stat) => (
          <article key={stat.label} className="stat-card">
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
            <p>{stat.detail}</p>
          </article>
        ))}
      </section>

      <section className="content-grid">
        <div className="market-column">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Browse</p>
              <h2>{filteredListings.length} matching listings</h2>
            </div>
            <p>Missing source fields render as N/A in the detail panel.</p>
          </div>

          <div className="listing-grid">
            {filteredListings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                landmark={selectedLandmark}
                selected={selectedListing.id === listing.id}
                onSelect={() => setSelectedListingId(listing.id)}
              />
            ))}
          </div>
        </div>

        <aside className="insight-column" aria-label="AI and listing intelligence">
          <AiFinder query={aiQuery} setQuery={setAiQuery} />
          <ListingDetails listing={selectedListing} landmark={selectedLandmark} />
          <RoommateMatcher quiz={quiz} setQuiz={setQuiz} matches={roommateMatches} />
          <DuplicatePanel matches={duplicateMatches} />
          <SourcePanel />
        </aside>
      </section>
    </main>
  );
}

type ListingCardProps = {
  listing: Listing;
  landmark: (typeof campusLandmarks)[number];
  selected: boolean;
  onSelect: () => void;
};

function ListingCard({ listing, landmark, selected, onSelect }: ListingCardProps) {
  const travel = travelEstimate(listing, landmark);

  return (
    <article id={listing.id} className={`listing-card ${selected ? "selected" : ""}`}>
      <button className="listing-image" type="button" onClick={onSelect} aria-label={`View ${listing.title}`}>
        <img src={listing.image} alt={listing.title} />
        <span className="category-pill">
          {categoryIcons[listing.category]}
          {listing.category}
        </span>
      </button>

      <div className="listing-body">
        <div className="listing-title-row">
          <div>
            <p className="source-line">
              {listing.source}
              {listing.verified ? (
                <span className="verified">
                  <CheckCircle2 size={14} /> verified
                </span>
              ) : (
                <span className="unverified">review</span>
              )}
            </p>
            <h3>{listing.title}</h3>
          </div>
          <button className="icon-button" type="button" onClick={onSelect} aria-label="Open listing details">
            <ChevronRight size={18} />
          </button>
        </div>

        <p className="listing-description">{listing.description}</p>

        <div className="price-row">
          <strong>{formatMoney(listing.price)}</strong>
          <span>{listing.priceLabel ?? `${formatMoney(pricePerBed(listing))} / bed`}</span>
        </div>

        <div className="mini-metrics" aria-label="Listing summary">
          <span>{normalizedBedroomLabel(listing)}</span>
          <span>{field(listing.bathrooms)} bath</span>
          <span>{field(listing.squareFeet)} sqft</span>
          <span>{travel.walkMinutes ? `${travel.walkMinutes} min walk` : "N/A walk"}</span>
        </div>

        <div className="tag-row">
          {listing.amenities.slice(0, 4).map((amenity) => (
            <span key={amenity}>{amenity}</span>
          ))}
        </div>
      </div>
    </article>
  );
}

function AiFinder({ query, setQuery }: { query: string; setQuery: (value: string) => void }) {
  const results = useMemo(() => aiSearch(query, listings), [query]);

  return (
    <section className="panel ai-panel">
      <div className="panel-heading">
        <span className="panel-icon">
          <Brain size={18} />
        </span>
        <div>
          <p className="eyebrow">AI Finder</p>
          <h2>Ask for exactly what you need</h2>
        </div>
      </div>
      <textarea value={query} onChange={(event) => setQuery(event.target.value)} rows={4} />
      <div className="ai-results">
        {results.length ? (
          results.map((result) => (
            <button
              className="ai-result"
              type="button"
              key={result.listing.id}
              onClick={() => document.getElementById(result.listing.id)?.scrollIntoView({ behavior: "smooth", block: "center" })}
            >
              <strong>{result.score}% fit</strong>
              <span>{result.listing.title}</span>
              <small>{result.reasons.join(" | ")}</small>
            </button>
          ))
        ) : (
          <p className="empty-state">Try a request with budget, location, category, or preferences.</p>
        )}
      </div>
    </section>
  );
}

function ListingDetails({ listing, landmark }: { listing: Listing; landmark: (typeof campusLandmarks)[number] }) {
  const travel = travelEstimate(listing, landmark);
  const rows = [
    ["Category", listing.category],
    ["Address", listing.address],
    ["Bedrooms", normalizedBedroomLabel(listing)],
    ["Bathrooms", listing.bathrooms],
    ["Square feet", listing.squareFeet],
    ["Lease start", formatDate(listing.leaseStart)],
    ["Lease end", formatDate(listing.leaseEnd)],
    ["Furnished", listing.furnished === undefined ? undefined : listing.furnished ? "Yes" : "No"],
    ["Utilities", listing.utilities?.length ? listing.utilities.join(", ") : undefined],
    ["Contact", listing.contactHint],
  ];

  return (
    <section className="panel detail-panel">
      <div className="panel-heading">
        <span className="panel-icon">
          <CircleDollarSign size={18} />
        </span>
        <div>
          <p className="eyebrow">Listing detail</p>
          <h2>{listing.title}</h2>
        </div>
      </div>

      <div className="detail-price">
        <strong>{formatMoney(pricePerBed(listing))}</strong>
        <span>normalized per bed or item</span>
      </div>

      <dl className="detail-list">
        {rows.map(([label, value]) => (
          <div key={String(label)}>
            <dt>{label}</dt>
            <dd>{field(value as string | number | undefined)}</dd>
          </div>
        ))}
      </dl>

      <div className="distance-strip">
        <div>
          <MapPin size={18} />
          <strong>{landmark.name}</strong>
        </div>
        <span>{travel.miles ? `${travel.miles.toFixed(1)} mi` : "N/A"}</span>
        <span>{travel.walkMinutes ? `${travel.walkMinutes} min walk` : "N/A"}</span>
        <span>{travel.bikeMinutes ? `${travel.bikeMinutes} min bike` : "N/A"}</span>
        <span>{travel.busMinutes ? `${travel.busMinutes} min bus` : "N/A"}</span>
      </div>
    </section>
  );
}

type RoommateMatcherProps = {
  quiz: QuizAnswers;
  setQuiz: (quiz: QuizAnswers) => void;
  matches: ReturnType<typeof matchRoommates>;
};

function RoommateMatcher({ quiz, setQuiz, matches }: RoommateMatcherProps) {
  return (
    <section className="panel roommate-panel">
      <div className="panel-heading">
        <span className="panel-icon">
          <Users size={18} />
        </span>
        <div>
          <p className="eyebrow">Roommate quiz</p>
          <h2>Compatibility match</h2>
        </div>
      </div>

      <div className="quiz-grid">
        <RangeQuiz
          label="Cleanliness"
          value={quiz.cleanliness}
          onChange={(value) => setQuiz({ ...quiz, cleanliness: value })}
        />
        <RangeQuiz
          label="Noise tolerance"
          value={quiz.noiseTolerance}
          onChange={(value) => setQuiz({ ...quiz, noiseTolerance: value })}
        />
        <RangeQuiz
          label="Social energy"
          value={quiz.socialEnergy}
          onChange={(value) => setQuiz({ ...quiz, socialEnergy: value })}
        />
        <RangeQuiz
          label="Inclusivity"
          value={quiz.inclusivity}
          onChange={(value) => setQuiz({ ...quiz, inclusivity: value })}
        />
        <label className="select-field compact">
          <span>Schedule</span>
          <select
            value={quiz.schedule}
            onChange={(event) => setQuiz({ ...quiz, schedule: event.target.value as QuizAnswers["schedule"] })}
          >
            <option>Early</option>
            <option>Flexible</option>
            <option>Night</option>
          </select>
        </label>
        <label className="select-field compact">
          <span>Pets</span>
          <select value={quiz.pets} onChange={(event) => setQuiz({ ...quiz, pets: event.target.value as QuizAnswers["pets"] })}>
            <option>No pets</option>
            <option>Cats ok</option>
            <option>Dogs ok</option>
            <option>Pet friendly</option>
          </select>
        </label>
      </div>

      <label className="range-field compact">
        <span>Budget</span>
        <strong>{formatMoney(quiz.budget)}</strong>
        <input
          min="400"
          max="2200"
          step="25"
          type="range"
          value={quiz.budget}
          onChange={(event) => setQuiz({ ...quiz, budget: Number(event.target.value) })}
        />
      </label>

      <div className="match-list">
        {matches.map(({ profile, score, notes }) => (
          <article key={profile.id} className="match-row">
            <div className="score-ring">{score}</div>
            <div>
              <strong>{profile.name}</strong>
              <span>{profile.program}</span>
              <p>{notes.join(" | ")}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function RangeQuiz({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="range-field compact">
      <span>{label}</span>
      <strong>{value}/10</strong>
      <input min="1" max="10" type="range" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function DuplicatePanel({ matches }: { matches: ReturnType<typeof detectDuplicates> }) {
  return (
    <section className="panel duplicate-panel">
      <div className="panel-heading">
        <span className="panel-icon warning">
          <AlertTriangle size={18} />
        </span>
        <div>
          <p className="eyebrow">Duplicate watch</p>
          <h2>Repost detection</h2>
        </div>
      </div>

      {matches.map((match) => (
        <article key={`${match.a.id}-${match.b.id}`} className="duplicate-row">
          <strong>{match.confidence}% likely duplicate</strong>
          <span>
            {match.a.title} + {match.b.title}
          </span>
          <small>{match.reasons.join(" | ")}</small>
        </article>
      ))}
    </section>
  );
}

function SourcePanel() {
  return (
    <section className="panel source-panel">
      <div className="panel-heading">
        <span className="panel-icon">
          <CalendarDays size={18} />
        </span>
        <div>
          <p className="eyebrow">Ingestion</p>
          <h2>Source pipeline</h2>
        </div>
      </div>
      <div className="source-list">
        {sourceConfigs.map((source) => (
          <article key={source.name}>
            <div>
              <strong>{source.name}</strong>
              <span>{source.status}</span>
            </div>
            <p>{source.note}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default App;
