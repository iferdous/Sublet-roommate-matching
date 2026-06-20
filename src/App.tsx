import {
  ArrowUpRight,
  Bike,
  BookOpen,
  Bot,
  Building2,
  Car,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Computer,
  Filter,
  Gift,
  Heart,
  Home,
  Layers,
  Map,
  MapPin,
  MessageSquare,
  Moon,
  Navigation,
  ParkingCircle,
  Plus,
  Route,
  Search,
  Send,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Sofa,
  Sparkles,
  Sun,
  Users,
  WandSparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  type AiSearchResponse,
  type BootstrapResponse,
  createListing,
  getBootstrap,
  getListings,
  matchRoommates as matchRoommatesApi,
  runAiSearch,
  runIngestion,
} from "./api";
import { formatDate, formatMoney, normalizedBedroomLabel, pricePerBed } from "./lib/matching";
import type { AppView, Listing, ListingCategory, QuizAnswers } from "./types";

const fallbackQuiz: QuizAnswers = {
  cleanliness: 8,
  schedule: "Flexible",
  noiseTolerance: 4,
  socialEnergy: 7,
  pets: "Cats ok",
  inclusivity: 10,
  budget: 1000,
  genderPreference: "Women preferred",
};

const categoryIcons: Partial<Record<ListingCategory, JSX.Element>> = {
  All: <Layers size={18} />,
  Sublease: <Home size={18} />,
  "Lease Takeover": <Building2 size={18} />,
  Roommate: <Users size={18} />,
  Furniture: <Sofa size={18} />,
  Vehicle: <Bike size={18} />,
  Textbooks: <BookOpen size={18} />,
  Electronics: <Computer size={18} />,
  Parking: <ParkingCircle size={18} />,
  Free: <Gift size={18} />,
};

const navItems: Array<{ id: AppView; label: string; icon: JSX.Element }> = [
  { id: "market", label: "Marketplace", icon: <Home size={17} /> },
  { id: "ai", label: "AI Concierge", icon: <WandSparkles size={17} /> },
  { id: "roommates", label: "Roommate Matcher", icon: <Users size={17} /> },
  { id: "map", label: "Map View", icon: <Map size={17} /> },
  { id: "post", label: "Post Listing", icon: <Plus size={17} /> },
];

type PostDraft = {
  title: string;
  category: string;
  price: string;
  neighborhood: string;
  address: string;
  description: string;
};

function field(value: string | number | undefined | null) {
  return value === undefined || value === null || value === "" ? "N/A" : value;
}

function useDarkMode() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("sublet-scout-theme") === "dark");

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    localStorage.setItem("sublet-scout-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  return [darkMode, setDarkMode] as const;
}

function App() {
  const [darkMode, setDarkMode] = useDarkMode();
  const [view, setView] = useState<AppView>("market");
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [status, setStatus] = useState("Connecting to backend...");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [neighborhood, setNeighborhood] = useState("All");
  const [sort, setSort] = useState("Recommended");
  const [maxPrice, setMaxPrice] = useState(2400);
  const [landmarkId, setLandmarkId] = useState("memorial-union");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [petFriendlyOnly, setPetFriendlyOnly] = useState(false);
  const [aiQuery, setAiQuery] = useState("Find me a sunny studio near Mifflin under $1100 with a balcony.");
  const [aiResponse, setAiResponse] = useState<AiSearchResponse | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [quiz, setQuiz] = useState<QuizAnswers>(fallbackQuiz);
  const [roommateMatches, setRoommateMatches] = useState<Array<{ profile: Record<string, unknown>; score: number; notes: string[] }>>([]);
  const [toast, setToast] = useState("");
  const [mapFocusId, setMapFocusId] = useState<string | null>(null);
  const [postDraft, setPostDraft] = useState({
    title: "",
    category: "Sublease",
    price: "",
    neighborhood: "Downtown",
    address: "",
    description: "",
  });

  useEffect(() => {
    getBootstrap()
      .then((data) => {
        setBootstrap(data);
        setListings(data.listings);
        setStatus(`Backend online. ${data.duplicatesHidden} duplicate repost hidden before display.`);
      })
      .catch((error) => {
        setStatus(`Backend unavailable: ${error.message}`);
      });
  }, []);

  useEffect(() => {
    if (!bootstrap) return;
    getListings({
      search: query,
      category,
      neighborhood,
      sort,
      maxPrice,
      landmarkId,
      verifiedOnly,
      petFriendlyOnly,
    })
      .then((data) => setListings(data.listings))
      .catch((error) => setStatus(`Listing refresh failed: ${error.message}`));
  }, [bootstrap, category, landmarkId, maxPrice, neighborhood, petFriendlyOnly, query, sort, verifiedOnly]);

  useEffect(() => {
    matchRoommatesApi(quiz)
      .then((data) => setRoommateMatches(data.matches))
      .catch(() => setRoommateMatches([]));
  }, [quiz]);

  const selectedLandmark = bootstrap?.landmarks.find((landmark) => landmark.id === landmarkId) ?? bootstrap?.landmarks[0];
  const activeListing = selectedListing ?? listings[0] ?? null;
  const featuredListings = listings.slice(0, 3);
  const focusedMapListing = listings.find((listing) => listing.id === mapFocusId) ?? activeListing;

  async function handleAiSearch() {
    setAiBusy(true);
    try {
      const response = await runAiSearch(aiQuery, landmarkId);
      setAiResponse(response);
      setStatus("AI Concierge searched deduped backend listings.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "AI search failed");
    } finally {
      setAiBusy(false);
    }
  }

  async function handlePostListing(event: React.FormEvent) {
    event.preventDefault();
    const created = await createListing({
      ...postDraft,
      price: Number(postDraft.price || 0),
      amenities: [],
    } as Partial<Listing>);
    setListings((current) => [created, ...current]);
    setSelectedListing(created);
    setToast("Listing saved locally and queued for moderation.");
    setPostDraft({ title: "", category: "Sublease", price: "", neighborhood: "Downtown", address: "", description: "" });
    setView("market");
  }

  async function handleRunIngestion() {
    const result = await runIngestion();
    setToast(result.note);
  }

  return (
    <main className="app-shell">
      <header className="app-topbar">
        <button className="brand-button" type="button" onClick={() => setView("market")}>
          <span className="brand-mark">BM</span>
          <span>
            <strong>BadgerMatch</strong>
            <small>Campus Marketplace</small>
          </span>
        </button>

        <nav className="top-nav" aria-label="Primary navigation">
          {navItems.slice(0, 4).map((item) => (
            <button key={item.id} className={view === item.id ? "active" : ""} type="button" onClick={() => setView(item.id)}>
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="top-actions">
          <label className="global-search">
            <Search size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Madison..." />
          </label>
          <button className="post-button" type="button" onClick={() => setView("post")}>
            <Plus size={17} />
            Post Listing
          </button>
          <button className="theme-toggle" type="button" onClick={() => setDarkMode(!darkMode)} aria-label="Toggle dark mode">
            <span className={darkMode ? "" : "active"}>
              <Sun size={15} />
            </span>
            <span className={darkMode ? "active" : ""}>
              <Moon size={15} />
            </span>
          </button>
        </div>
      </header>

      <div className="status-bar">
        <span>
          <ShieldCheck size={16} /> {status}
        </span>
        <button type="button" onClick={handleRunIngestion}>
          <Sparkles size={16} />
          Run source sync
        </button>
      </div>

      {view === "market" && bootstrap && (
        <section className="dashboard-layout">
          <FilterRail
            bootstrap={bootstrap}
            category={category}
            setCategory={setCategory}
            neighborhood={neighborhood}
            setNeighborhood={setNeighborhood}
            landmarkId={landmarkId}
            setLandmarkId={setLandmarkId}
            maxPrice={maxPrice}
            setMaxPrice={setMaxPrice}
            verifiedOnly={verifiedOnly}
            setVerifiedOnly={setVerifiedOnly}
            petFriendlyOnly={petFriendlyOnly}
            setPetFriendlyOnly={setPetFriendlyOnly}
            setView={setView}
          />
          <section className="feed-column">
            <div className="feed-header">
              <div>
                <p className="eyebrow">Map View & Listings</p>
                <h1>Madison campus marketplace</h1>
                <p>Showing {listings.length} deduped results near {selectedLandmark?.name ?? "campus"}</p>
              </div>
              <label className="select-pill">
                Sort by
                <select value={sort} onChange={(event) => setSort(event.target.value)}>
                  {bootstrap.sortOptions.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="stat-grid">
              {bootstrap.stats.map((stat) => (
                <article key={stat.label} className="stat-card">
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                  <p>{stat.detail}</p>
                </article>
              ))}
            </div>

            <div className="bento-grid">
              {featuredListings[0] && <HeroListingCard listing={featuredListings[0]} onOpen={setSelectedListing} />}
              {featuredListings.slice(1).map((listing) => (
                <ListingCard key={listing.id} listing={listing} onOpen={setSelectedListing} compact />
              ))}
              <MiniMapCard listings={listings} onOpenMap={() => setView("map")} setMapFocusId={setMapFocusId} />
            </div>

            <div className="listing-grid">
              {listings.slice(3).map((listing) => (
                <ListingCard key={listing.id} listing={listing} onOpen={setSelectedListing} />
              ))}
            </div>
          </section>
        </section>
      )}

      {view === "ai" && bootstrap && (
        <AiConcierge
          query={aiQuery}
          setQuery={setAiQuery}
          response={aiResponse}
          busy={aiBusy}
          onSearch={handleAiSearch}
          onOpenListing={setSelectedListing}
        />
      )}

      {view === "roommates" && (
        <RoommateHub quiz={quiz} setQuiz={setQuiz} matches={roommateMatches} onOpenListing={setSelectedListing} listings={listings} />
      )}

      {view === "map" && bootstrap && (
        <MapView
          listings={listings}
          landmarks={bootstrap.landmarks}
          focused={focusedMapListing}
          onFocus={setMapFocusId}
          onOpenListing={setSelectedListing}
        />
      )}

      {view === "post" && (
        <PostListingPage draft={postDraft} setDraft={setPostDraft} onSubmit={handlePostListing} onCancel={() => setView("market")} />
      )}

      {selectedListing && (
        <ListingDetailModal
          listing={selectedListing}
          onClose={() => setSelectedListing(null)}
          onToast={setToast}
          onMap={() => {
            setMapFocusId(selectedListing.id);
            setView("map");
          }}
        />
      )}

      {toast && (
        <button className="toast" type="button" onClick={() => setToast("")}>
          {toast}
        </button>
      )}
    </main>
  );
}

type FilterRailProps = {
  bootstrap: BootstrapResponse;
  category: string;
  setCategory: (value: string) => void;
  neighborhood: string;
  setNeighborhood: (value: string) => void;
  landmarkId: string;
  setLandmarkId: (value: string) => void;
  maxPrice: number;
  setMaxPrice: (value: number) => void;
  verifiedOnly: boolean;
  setVerifiedOnly: (value: boolean) => void;
  petFriendlyOnly: boolean;
  setPetFriendlyOnly: (value: boolean) => void;
  setView: (value: AppView) => void;
};

function FilterRail(props: FilterRailProps) {
  return (
    <aside className="filter-rail">
      <div>
        <p className="rail-title">Filters & AI</p>
        <p className="rail-location">Madison, WI</p>
      </div>
      <div className="rail-section">
        <span>Categories</span>
        {props.bootstrap.categories.map((item) => (
          <button
            key={item.name}
            type="button"
            className={props.category === item.name ? "active" : ""}
            onClick={() => props.setCategory(item.name)}
          >
            {categoryIcons[item.name as ListingCategory] ?? <SlidersHorizontal size={18} />}
            <strong>{item.name}</strong>
            <em>{item.count}</em>
          </button>
        ))}
      </div>

      <button className="ai-rail-button" type="button" onClick={() => props.setView("ai")}>
        <Bot size={18} /> Ask AI Concierge
      </button>

      <div className="rail-section controls">
        <label className="range-field">
          <span>Max price per bed/item</span>
          <strong>{formatMoney(props.maxPrice)}</strong>
          <input
            type="range"
            min="0"
            max="2500"
            step="25"
            value={props.maxPrice}
            onChange={(event) => props.setMaxPrice(Number(event.target.value))}
          />
        </label>
        <label className="select-field">
          <span>Neighborhood</span>
          <select value={props.neighborhood} onChange={(event) => props.setNeighborhood(event.target.value)}>
            {props.bootstrap.neighborhoods.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="select-field">
          <span>Distance to</span>
          <select value={props.landmarkId} onChange={(event) => props.setLandmarkId(event.target.value)}>
            {props.bootstrap.landmarks.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="checkbox-row">
          <input checked={props.verifiedOnly} onChange={(event) => props.setVerifiedOnly(event.target.checked)} type="checkbox" />
          Verified only
        </label>
        <label className="checkbox-row">
          <input checked={props.petFriendlyOnly} onChange={(event) => props.setPetFriendlyOnly(event.target.checked)} type="checkbox" />
          Pet friendly
        </label>
      </div>
      <div className="rail-footer">
        <button type="button" onClick={() => props.setView("ai")}>
          <MessageSquare size={16} />
          Find for me
        </button>
        <button type="button" onClick={() => props.setView("map")}>
          <Map size={16} />
          Campus map
        </button>
      </div>
    </aside>
  );
}

function HeroListingCard({ listing, onOpen }: { listing: Listing; onOpen: (listing: Listing) => void }) {
  return (
    <article className="hero-listing-card">
      <button className="hero-image" type="button" onClick={() => onOpen(listing)}>
        <img src={listing.image} alt={listing.title} />
        <span>{listing.category}</span>
      </button>
      <div className="hero-info">
        <div className="listing-meta">
          <span>{listing.sourceSection}</span>
          {listing.verified && <CheckCircle2 size={15} />}
        </div>
        <h2>{listing.title}</h2>
        <p>{listing.description}</p>
        <div className="price-row">
          <strong>{formatMoney(listing.price)}</strong>
          <span>{listing.priceLabel ?? `${formatMoney(pricePerBed(listing))} normalized`}</span>
        </div>
        <MetricGrid listing={listing} />
        <div className="card-actions">
          <button type="button" onClick={() => onOpen(listing)}>
            View Details
          </button>
          <button className="icon-action" type="button" aria-label="Share listing">
            <Share2 size={18} />
          </button>
        </div>
      </div>
    </article>
  );
}

function ListingCard({ listing, onOpen, compact = false }: { listing: Listing; onOpen: (listing: Listing) => void; compact?: boolean }) {
  return (
    <article className={`listing-card ${compact ? "compact" : ""}`}>
      <button className="listing-image" type="button" onClick={() => onOpen(listing)}>
        <img src={listing.image} alt={listing.title} />
        <span>{listing.category}</span>
        <button className="save-button" type="button" aria-label="Save listing">
          <Heart size={17} />
        </button>
      </button>
      <div className="listing-body">
        <div className="listing-meta">
          <span>{listing.source}</span>
          {listing.verified ? <CheckCircle2 size={15} /> : <ShieldCheck size={15} />}
        </div>
        <h3>{listing.title}</h3>
        <div className="price-row">
          <strong>{listing.price === 0 ? "Free" : formatMoney(listing.price)}</strong>
          <span>{listing.priceLabel ?? `${formatMoney(pricePerBed(listing))} / normalized`}</span>
        </div>
        <MetricGrid listing={listing} />
        <p>{listing.description}</p>
        <div className="tag-row">
          {listing.amenities.slice(0, 3).map((amenity) => (
            <span key={amenity}>{amenity}</span>
          ))}
        </div>
        <button className="outline-button" type="button" onClick={() => onOpen(listing)}>
          View details <ChevronRight size={16} />
        </button>
      </div>
    </article>
  );
}

function MetricGrid({ listing }: { listing: Listing }) {
  return (
    <div className="metric-grid">
      <span>{normalizedBedroomLabel(listing)}</span>
      <span>{field(listing.bathrooms)} bath</span>
      <span>{field(listing.squareFeet)} sqft</span>
      <span>{listing.selectedDistance?.walkMinutes ? `${listing.selectedDistance.walkMinutes} min walk` : "N/A walk"}</span>
    </div>
  );
}

function MiniMapCard({
  listings,
  onOpenMap,
  setMapFocusId,
}: {
  listings: Listing[];
  onOpenMap: () => void;
  setMapFocusId: (id: string) => void;
}) {
  return (
    <article className="mini-map-card">
      <div className="map-canvas">
        <span className="map-label">
          <MapPin size={17} /> Madison, WI Campus Area
        </span>
        {listings.slice(0, 8).map((listing, index) => (
          <button
            key={listing.id}
            className="map-pin"
            style={{ left: `${22 + ((index * 17) % 58)}%`, top: `${28 + ((index * 23) % 48)}%` }}
            type="button"
            onClick={() => {
              setMapFocusId(listing.id);
              onOpenMap();
            }}
            aria-label={`Open ${listing.title} on map`}
          >
            {listing.price === 0 ? "Free" : formatMoney(pricePerBed(listing))}
          </button>
        ))}
      </div>
      <button type="button" onClick={onOpenMap}>
        <Search size={17} />
        Search this area
      </button>
    </article>
  );
}

function AiConcierge({
  query,
  setQuery,
  response,
  busy,
  onSearch,
  onOpenListing,
}: {
  query: string;
  setQuery: (value: string) => void;
  response: AiSearchResponse | null;
  busy: boolean;
  onSearch: () => void;
  onOpenListing: (listing: Listing) => void;
}) {
  return (
    <section className="ai-page">
      <div className="ai-hero">
        <div>
          <p className="eyebrow">AI Concierge</p>
          <h1>Tell Scout what you need. It will search the deduped backend.</h1>
          <p>
            Ask for budget, square footage, commute, pets, roommate preferences, furniture, bikes, free items, or anything
            else in the Madison marketplace.
          </p>
        </div>
        <div className="ai-orb">
          <Bot size={54} />
        </div>
      </div>
      <div className="ai-chat-shell">
        <div className="chat-thread">
          <div className="assistant-bubble">
            Hi! I can search housing, roommates, furniture, vehicles, textbooks, electronics, parking, and free items. What
            are you looking for today?
          </div>
          <div className="user-bubble">{query}</div>
          {response && <div className="assistant-bubble">{response.message}</div>}
        </div>
        <div className="ai-input-row">
          <textarea value={query} onChange={(event) => setQuery(event.target.value)} rows={3} />
          <button type="button" onClick={onSearch} disabled={busy}>
            {busy ? "Searching..." : "Ask Scout"} <Send size={17} />
          </button>
        </div>
      </div>
      <div className="ai-result-grid">
        {(response?.results ?? []).map((result) => (
          <article key={result.listing.id} className="ai-result-card">
            <strong>{result.score}% match</strong>
            <h3>{result.listing.title}</h3>
            <p>{result.reasons.join(" | ")}</p>
            <button type="button" onClick={() => onOpenListing(result.listing)}>
              View listing <ArrowUpRight size={16} />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function RoommateHub({
  quiz,
  setQuiz,
  matches,
  onOpenListing,
  listings,
}: {
  quiz: QuizAnswers;
  setQuiz: (value: QuizAnswers) => void;
  matches: Array<{ profile: Record<string, unknown>; score: number; notes: string[] }>;
  onOpenListing: (listing: Listing) => void;
  listings: Listing[];
}) {
  return (
    <section className="roommate-page">
      <div className="roommate-hero">
        <div>
          <p className="eyebrow">Roommate Matcher</p>
          <h1>
            Find your <span>perfect match</span>
          </h1>
          <p>Update the quiz and the backend recomputes compatibility against roommate profiles and listings.</p>
        </div>
        <button type="button">
          <ClipboardList size={18} /> Take Compatibility Quiz
        </button>
      </div>
      <div className="roommate-grid">
        <section className="quiz-panel">
          <RangeQuiz label="Cleanliness" value={quiz.cleanliness} onChange={(value) => setQuiz({ ...quiz, cleanliness: value })} />
          <RangeQuiz label="Noise tolerance" value={quiz.noiseTolerance} onChange={(value) => setQuiz({ ...quiz, noiseTolerance: value })} />
          <RangeQuiz label="Social energy" value={quiz.socialEnergy} onChange={(value) => setQuiz({ ...quiz, socialEnergy: value })} />
          <RangeQuiz label="Inclusivity" value={quiz.inclusivity} onChange={(value) => setQuiz({ ...quiz, inclusivity: value })} />
          <label className="range-field">
            <span>Budget</span>
            <strong>{formatMoney(quiz.budget)}</strong>
            <input min="400" max="2200" step="25" type="range" value={quiz.budget} onChange={(event) => setQuiz({ ...quiz, budget: Number(event.target.value) })} />
          </label>
        </section>
        <section className="match-stack">
          {matches.map((match) => {
            const listing = listings.find((item) => item.id === match.profile.listingId);
            return (
              <article key={String(match.profile.id)} className="match-card">
                <div className="score-ring">{match.score}%</div>
                <div>
                  <h3>{String(match.profile.name)}</h3>
                  <p>{String(match.profile.bio)}</p>
                  <div className="tag-row">{match.notes.map((note) => <span key={note}>{note}</span>)}</div>
                </div>
                {listing && <button type="button" onClick={() => onOpenListing(listing)}>View listing</button>}
              </article>
            );
          })}
        </section>
      </div>
    </section>
  );
}

function RangeQuiz({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="range-field">
      <span>{label}</span>
      <strong>{value}/10</strong>
      <input min="1" max="10" type="range" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function MapView({
  listings,
  landmarks,
  focused,
  onFocus,
  onOpenListing,
}: {
  listings: Listing[];
  landmarks: BootstrapResponse["landmarks"];
  focused: Listing | null;
  onFocus: (id: string) => void;
  onOpenListing: (listing: Listing) => void;
}) {
  return (
    <section className="map-page">
      <div className="map-toolbar">
        <div>
          <p className="eyebrow">Interactive Map</p>
          <h1>Drag around Madison and compare nearby listings</h1>
        </div>
        <a href="https://www.google.com/maps/search/Madison+WI+UW+Madison" target="_blank" rel="noreferrer">
          Open Google Maps <ArrowUpRight size={16} />
        </a>
      </div>
      <div className="full-map-shell">
        <div className="full-map-canvas">
          {landmarks.map((landmark, index) => (
            <span key={landmark.id} className="landmark-dot" style={{ left: `${18 + ((index * 13) % 62)}%`, top: `${18 + ((index * 19) % 60)}%` }}>
              {landmark.name}
            </span>
          ))}
          {listings.map((listing, index) => (
            <button
              key={listing.id}
              className={`large-map-pin ${focused?.id === listing.id ? "active" : ""}`}
              style={{ left: `${16 + ((index * 11) % 68)}%`, top: `${25 + ((index * 17) % 55)}%` }}
              type="button"
              onClick={() => onFocus(listing.id)}
            >
              {listing.price === 0 ? "Free" : formatMoney(pricePerBed(listing))}
            </button>
          ))}
        </div>
        {focused && (
          <aside className="map-detail">
            <img src={focused.image} alt={focused.title} />
            <span>{focused.category}</span>
            <h2>{focused.title}</h2>
            <p>{focused.address}</p>
            <strong>{focused.price === 0 ? "Free" : formatMoney(focused.price)}</strong>
            <button type="button" onClick={() => onOpenListing(focused)}>
              View details
            </button>
          </aside>
        )}
      </div>
    </section>
  );
}

function PostListingPage({
  draft,
  setDraft,
  onSubmit,
  onCancel,
}: {
  draft: PostDraft;
  setDraft: (value: PostDraft) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
}) {
  return (
    <section className="post-page">
      <div>
        <p className="eyebrow">Post a Listing</p>
        <h1>Submit once, let Scout normalize it.</h1>
        <p>The backend accepts the listing, classifies fields, and queues it for duplicate and source review.</p>
      </div>
      <form className="post-form" onSubmit={onSubmit}>
        <label>
          Title
          <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required />
        </label>
        <label>
          Category
          <select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>
            {Object.keys(categoryIcons).filter((item) => item !== "All").map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Price
          <input value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} inputMode="numeric" />
        </label>
        <label>
          Neighborhood
          <input value={draft.neighborhood} onChange={(event) => setDraft({ ...draft, neighborhood: event.target.value })} />
        </label>
        <label>
          Address
          <input value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} />
        </label>
        <label className="full">
          Description
          <textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={7} required />
        </label>
        <div className="form-actions">
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="submit">Submit listing</button>
        </div>
      </form>
    </section>
  );
}

function ListingDetailModal({
  listing,
  onClose,
  onToast,
  onMap,
}: {
  listing: Listing;
  onClose: () => void;
  onToast: (value: string) => void;
  onMap: () => void;
}) {
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
  ];

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className="detail-modal">
        <button className="close-button" type="button" onClick={onClose} aria-label="Close listing detail">
          <X size={20} />
        </button>
        <div className="detail-gallery">
          <img src={listing.image} alt={listing.title} />
          <div>
            {(listing.gallery ?? [listing.image]).slice(1, 3).map((image) => (
              <img key={image} src={image} alt="" />
            ))}
          </div>
          <span>{listing.category}</span>
        </div>
        <div className="detail-content">
          <div className="detail-main">
            <p className="eyebrow">{listing.neighborhood}</p>
            <h1>{listing.title}</h1>
            <div className="detail-price-line">
              <strong>{listing.price === 0 ? "Free" : formatMoney(listing.price)}</strong>
              <span>{listing.priceLabel ?? `${formatMoney(pricePerBed(listing))} normalized`}</span>
            </div>
            <p>{listing.description}</p>
            <div className="detail-commutes">
              {(listing.commutes ?? []).slice(0, 4).map((commute) => (
                <span key={commute.landmark.id}>
                  <Navigation size={15} />
                  {commute.landmark.name}: {commute.walkMinutes ?? "N/A"} min walk
                </span>
              ))}
            </div>
            <dl className="detail-list">
              {rows.map(([label, value]) => (
                <div key={String(label)}>
                  <dt>{label}</dt>
                  <dd>{field(value as string | number | undefined | null)}</dd>
                </div>
              ))}
            </dl>
          </div>
          <aside className="detail-side">
            <div className="ai-extraction">
              <Bot size={22} />
              <h3>What AI extracted</h3>
              <p>Confidence: {Math.round((listing.extractionConfidence ?? 0.7) * 100)}%</p>
              <div className="tag-row">{listing.amenities.map((amenity) => <span key={amenity}>{amenity}</span>)}</div>
            </div>
            <div className="tenant-card">
              <strong>{listing.sourceSection ?? listing.source}</strong>
              <p>{listing.contactHint}</p>
              <button type="button" onClick={() => onToast("This platform is discovery-only. Use the original source to contact the poster.")}>
                <ArrowUpRight size={16} />
                Go to source
              </button>
              <button type="button" onClick={onMap}>
                <Route size={16} />
                View on map
              </button>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

export default App;
