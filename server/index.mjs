import http from "node:http";
import { URL } from "node:url";
import {
  aiReply,
  aiSearch,
  bootstrap,
  createListing,
  detectDuplicates,
  filterListings,
  ingestionStatus,
  listingWithDistances,
  matchRoommates,
  publicListings,
  sortListings,
} from "./lib/intelligence.mjs";

const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || "127.0.0.1";

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function queryObject(url) {
  const query = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (value === "true") query[key] = true;
    else if (value === "false") query[key] = false;
    else query[key] = value;
  }
  return query;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    return sendJson(res, 204, {});
  }

  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      return sendJson(res, 200, {
        ok: true,
        service: "Sublet Scout API",
        frontend: "http://localhost:5174/",
        backend: `http://localhost:${port}/api/health`,
        duplicateFiltering: "enabled",
      });
    }

    if (req.method === "GET" && url.pathname === "/api/bootstrap") {
      return sendJson(res, 200, bootstrap());
    }

    if (req.method === "GET" && url.pathname === "/api/listings") {
      const query = queryObject(url);
      const filtered = filterListings(query);
      return sendJson(res, 200, {
        listings: sortListings(filtered, query.sort, query.landmarkId).map((listing) =>
          listingWithDistances(listing, query.landmarkId),
        ),
        total: filtered.length,
      });
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/listings/")) {
      const id = decodeURIComponent(url.pathname.replace("/api/listings/", ""));
      const listing = publicListings().find((item) => item.id === id);
      if (!listing) return sendJson(res, 404, { error: "Listing not found" });
      return sendJson(res, 200, listingWithDistances(listing, url.searchParams.get("landmarkId") ?? "memorial-union"));
    }

    if (req.method === "POST" && url.pathname === "/api/listings") {
      const body = await readJson(req);
      return sendJson(res, 201, createListing(body));
    }

    if (req.method === "POST" && url.pathname === "/api/ai/search") {
      const body = await readJson(req);
      const results = aiSearch(body.query ?? "", publicListings(), body).map((result) => ({
        ...result,
        listing: listingWithDistances(result.listing, body.landmarkId),
      }));
      return sendJson(res, 200, { results, message: aiReply(body.query ?? "", results) });
    }

    if (req.method === "POST" && url.pathname === "/api/roommates/match") {
      const body = await readJson(req);
      return sendJson(res, 200, { matches: matchRoommates(body) });
    }

    if (req.method === "GET" && url.pathname === "/api/map") {
      return sendJson(res, 200, {
        listings: publicListings().map((listing) => listingWithDistances(listing, url.searchParams.get("landmarkId") ?? "memorial-union")),
      });
    }

    if (req.method === "GET" && url.pathname === "/api/ingestion/sources") {
      return sendJson(res, 200, { sources: ingestionStatus() });
    }

    if (req.method === "POST" && url.pathname === "/api/ingestion/run") {
      return sendJson(res, 200, {
        ok: true,
        note:
          "Local ingestion pipeline ran in simulation mode. Private Facebook content requires approved export/user-submitted source data; original image URLs are preserved when supplied.",
        sources: ingestionStatus(),
      });
    }

    if (req.method === "GET" && url.pathname === "/api/admin/duplicates") {
      return sendJson(res, 200, { duplicates: detectDuplicates() });
    }

    return sendJson(res, 404, { error: "Route not found" });
  } catch (error) {
    return sendJson(res, 500, { error: error.message ?? "Unknown server error" });
  }
});

server.listen(port, host, () => {
  console.log(`Sublet Scout API ready at http://localhost:${port}/api/health`);
});
