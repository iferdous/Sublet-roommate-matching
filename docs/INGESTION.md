# Ingestion Plan

Sublet Scout should ingest listings only from allowed sources and preserve enough source metadata for trust, deduplication, and cleanup.

## Source Strategy

- Facebook group posts: use user-submitted URLs, approved exports, or a moderation workflow. Do not bypass platform access controls. Preserve original image URLs when post data is supplied.
- UW Sublets: build a structured adapter if the site allows automated access or provides feeds.
- Craigslist Madison: respect the site's terms and rate limits. Store source URL, title, price, location, body text, posted date, and image URLs.
- Manual campus import: support CSV upload and form submissions for club chats, GroupMe threads, and department boards.

## Normalization

Every imported listing should map to:

- category: sublease, lease takeover, roommate, furniture, vehicle, textbooks, electronics, parking, free, or other
- normalized price and price per bed
- address and geocode confidence
- lease start and end dates
- amenities and utilities
- source URL and source type
- image URLs
- extracted contact instructions
- duplicate fingerprint

Missing fields should render as `N/A` in the UI instead of being silently hidden.

## AI Pipeline

1. Extract structured fields from raw post text with an LLM JSON schema.
2. Geocode addresses and cache coordinates.
3. Generate text embeddings for title, description, amenities, and roommate preferences.
4. Use vector similarity for roommate matching and semantic search.
5. Use duplicate detection that combines normalized address, price, dates, image hashes, and embedding similarity.
6. Hide duplicate records from the public API response and retain them in the admin duplicate endpoint.
7. Send low-confidence records to a review queue before publishing.

## Local API

- `GET /api/bootstrap`: public listings, categories, landmarks, source metadata, stats, and sort options.
- `GET /api/listings`: filtered and sorted deduped public listings.
- `POST /api/ai/search`: AI-style semantic search over public listings.
- `POST /api/roommates/match`: roommate compatibility scoring.
- `GET /api/map`: map-ready listing coordinates and commute estimates.
- `POST /api/listings`: local post-listing submission.
- `GET /api/admin/duplicates`: backend-only duplicate review data.

## Trust And Safety

Sublet Scout should remain a discovery platform, not a direct messaging platform. Listing cards should point users back to the source and make verification status clear.
