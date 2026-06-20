# Sublet Scout

Sublet Scout is a full-stack UW-Madison marketplace prototype that helps students browse sublets, lease takeovers, roommate listings, furniture, bikes, textbooks, electronics, parking, free items, and other campus-adjacent listings from fragmented sources.

The app focuses on the pain points from the product brief:

- Academic Modern UI inspired by the attached BadgerMatch design reference, including bento cards, immersive detail views, map pages, and a seamless dark mode toggle.
- Backend API for listing search, source metadata, hidden duplicate filtering, AI-style search, roommate matching, post submissions, distance estimates, and ingestion status.
- Amazon-style browsing with category filters, price sliders, location filters, richer sort controls, and scannable listing cards.
- Dedicated AI Concierge page for queries like "cat and LGBTQ friendly roommate under $1000 by the lake."
- Roommate compatibility quiz with vector-style matching across cleanliness, schedule, noise tolerance, pets, inclusivity, social energy, and budget.
- Duplicate/repost detection for forwarded or copied listings. Duplicate items are hidden before the frontend receives the public feed.
- Price-per-bed normalization so roommate and apartment listings sort fairly.
- Distance estimates to campus and Madison landmarks such as Memorial Union, State Street, Grainger Hall, Engineering Hall, UW Hospital, Camp Randall, Capitol Square, and Hilldale.
- Listing detail fields render `N/A` when source data is missing.

## Run locally

```bash
npm install
npm run dev
```

`npm run dev` starts both:

- Frontend: `http://localhost:5174/`
- Backend: `http://localhost:8787/api/health`

The frontend port defaults to `5174` because this workspace already had another local server on the usual Vite port.

## Verify

```bash
npm run test
npm run build
```

## Notes

The backend uses deterministic local scoring so it works without API keys. The API is structured so production adapters can replace the local seed/import layer with approved source ingestion, LLM extraction, embeddings, and Google Maps geocoding.

Facebook group content is represented through approved/import-style seed records. The app does not bypass private Facebook access controls; production imports should use permitted exports, user-submitted post data, or official integrations.
