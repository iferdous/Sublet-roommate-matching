import type { Listing, QuizAnswers } from "./types";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API ${response.status}: ${await response.text()}`);
  }

  return response.json() as Promise<T>;
}

export function getBootstrap() {
  return request<BootstrapResponse>("/api/bootstrap");
}

export function getListings(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && value !== false) {
      search.set(key, String(value));
    }
  }
  return request<{ listings: Listing[]; total: number }>(`/api/listings?${search.toString()}`);
}

export function runAiSearch(query: string, landmarkId: string) {
  return request<AiSearchResponse>("/api/ai/search", {
    method: "POST",
    body: JSON.stringify({ query, landmarkId }),
  });
}

export function matchRoommates(answers: QuizAnswers) {
  return request<RoommateMatchResponse>("/api/roommates/match", {
    method: "POST",
    body: JSON.stringify(answers),
  });
}

export function createListing(payload: Partial<Listing>) {
  return request<Listing>("/api/listings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function runIngestion() {
  return request<IngestionRunResponse>("/api/ingestion/run", { method: "POST" });
}

export type BootstrapResponse = {
  listings: Listing[];
  categories: Array<{ name: string; count: number }>;
  landmarks: Array<{ id: string; name: string; type?: string; coordinates: { lat: number; lng: number } }>;
  sources: Array<{ name: string; url: string; kind: string; status: string; sections?: string[]; note: string }>;
  roommateProfiles: Array<Record<string, unknown>>;
  stats: Array<{ label: string; value: string; detail: string }>;
  duplicatesHidden: number;
  sortOptions: string[];
  neighborhoods: string[];
};

export type AiSearchResponse = {
  message: string;
  results: Array<{ listing: Listing; score: number; reasons: string[] }>;
};

export type RoommateMatchResponse = {
  matches: Array<{ profile: Record<string, unknown>; score: number; notes: string[] }>;
};

export type IngestionRunResponse = {
  ok: boolean;
  note: string;
  sources: Array<{ name: string; recordsSeen: number; visibleAfterDedupe: number; status: string }>;
};
