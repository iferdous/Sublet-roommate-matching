# Sublet Scout

Sublet Scout is a polished first prototype for a UW-Madison marketplace that helps students browse sublets, lease takeovers, roommate listings, furniture, bikes, and other campus-adjacent listings from fragmented sources.

The app focuses on the pain points from the product brief:

- Amazon-style browsing with category tabs, dropdown filters, price filters, sort controls, and scannable listing cards.
- Natural-language AI Finder for queries like "cat and LGBTQ friendly roommate under $1000 by the lake."
- Roommate compatibility quiz with vector-style matching across cleanliness, schedule, noise tolerance, pets, inclusivity, social energy, and budget.
- Duplicate/repost detection for forwarded or copied listings.
- Price-per-bed normalization so roommate and apartment listings sort fairly.
- Distance estimates to campus landmarks such as Memorial Union, Computer Sciences, Engineering Hall, and UW Hospital.
- Listing detail fields render `N/A` when source data is missing.

## Run locally

```bash
npm install
npm run dev
```

The dev server defaults to `http://localhost:5174/` because this workspace already had another local server on the usual Vite port.

## Verify

```bash
npm run test
npm run build
```

## Notes

This is a frontend prototype with deterministic local scoring so it works without API keys. The matching logic is isolated in `src/lib/matching.ts` so a production backend can replace the local scorer with an LLM, embeddings, geocoding, and approved source ingestion.
