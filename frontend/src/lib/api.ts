const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ---------------------------------------------------------------------------
// Phase 1 types
// ---------------------------------------------------------------------------

export type CropMarketOption = {
  crop: string;
  market: string;
  district: string;
};

export type PricePoint = {
  date: string;
  min_price: number;
  max_price: number;
  modal_price: number;
  arrival_volume: number | null;
};

export type PriceTrendResponse = {
  crop: string;
  market: string;
  district: string;
  points: PricePoint[];
};

export type NearestMarketComparison = {
  market: string;
  district: string;
  distance_km: number | null;
  modal_price: number;
  date: string;
};

export type SellWaitSignalResponse = {
  recommendation: "sell_now" | "wait" | "hold";
  reasons: string[];
  current_price: number;
  ma_7: number;
  ma_30: number | null;
  volume_trend_pct: number | null;
  days_of_data: number;
};

// ---------------------------------------------------------------------------
// Phase 2 types
// ---------------------------------------------------------------------------

export type { StoredUser } from "@/lib/auth";

export type LotCreate = {
  crop: string;
  quantity_kg: number;
  quality_grade: string;
  expected_price: number;
  available_from: string; // ISO date string "YYYY-MM-DD"
  location: string;
  photo_url?: string | null;
};

export type LotResponse = {
  id: number;
  farmer_id: number;
  crop: string;
  quantity_kg: number;
  quality_grade: string;
  photo_url: string | null;
  expected_price: number;
  available_from: string;
  location: string;
  status: string;
};

export type DemandCreate = {
  crop: string;
  quantity_kg: number;
  quality_spec: string;
  price_band_min: number;
  price_band_max: number;
  delivery_window: string;
};

export type DemandResponse = {
  id: number;
  buyer_id: number;
  crop: string;
  quantity_kg: number;
  quality_spec: string;
  price_band_min: number;
  price_band_max: number;
  delivery_window: string;
  status: string;
};

export type ScoreDetail = {
  quantity: number;
  price: number;
  distance: number;
  total: number;
  max: number;
};

export type CounterpartySummary = {
  id: number;
  name: string;
  district: string;
  kyc_status: string;
};

export type LotSummary = {
  id: number;
  farmer_id: number;
  crop: string;
  quantity_kg: number;
  quality_grade: string;
  expected_price: number;
  location: string;
  status: string;
};

export type DemandSummary = {
  id: number;
  crop: string;
  quantity_kg: number;
  price_band_min: number;
  price_band_max: number;
  delivery_window: string;
  status: string;
};

export type MatchResponse = {
  id: number;
  lot: LotSummary;
  demand: DemandSummary;
  score: number;
  score_detail: string | null;
  status: string;
  counterparty: CounterpartySummary | null;
};

export type OfferCreate = {
  price: number;
  quantity: number;
  message?: string | null;
};

export type OfferResponse = {
  id: number;
  match_id: number;
  from_user_id: number;
  price: number;
  quantity: number;
  message: string | null;
  status: string;
  created_at: string;
};

export type DealResponse = {
  id: number;
  match_id: number;
  agreed_price: number;
  agreed_quantity: number;
  logistics_mode: string;
  payment_status: string;
  pipeline_status: string;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Core fetch helpers
// ---------------------------------------------------------------------------

async function getJson<T>(path: string, token?: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { headers });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function postJson<T>(
  path: string,
  body: unknown,
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Request failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Phase 1 fetch functions
// ---------------------------------------------------------------------------

export function fetchOptions(): Promise<CropMarketOption[]> {
  return getJson("/api/options");
}

export function fetchTrend(
  crop: string,
  market: string,
  days: number,
): Promise<PriceTrendResponse> {
  const params = new URLSearchParams({ crop, market, days: String(days) });
  return getJson(`/api/prices/trend?${params.toString()}`);
}

export function fetchSignal(
  crop: string,
  market: string,
): Promise<SellWaitSignalResponse> {
  const params = new URLSearchParams({ crop, market });
  return getJson(`/api/prices/signal?${params.toString()}`);
}

export function fetchNearby(
  crop: string,
  district: string,
): Promise<NearestMarketComparison[]> {
  const params = new URLSearchParams({ crop, district });
  return getJson(`/api/prices/nearby?${params.toString()}`);
}

// ---------------------------------------------------------------------------
// Phase 2 auth fetch functions
// ---------------------------------------------------------------------------

export function requestOtp(
  phone: string,
  name: string,
  role: string,
): Promise<{ detail: string }> {
  return postJson("/api/auth/otp/request", { phone, name, role });
}

export function verifyOtp(
  phone: string,
  code: string,
): Promise<{
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: import("@/lib/auth").StoredUser;
}> {
  return postJson("/api/auth/otp/verify", { phone, code });
}

export function refreshTokens(
  refreshToken: string,
): Promise<{ access_token: string; refresh_token: string }> {
  return postJson("/api/auth/refresh", { refresh_token: refreshToken });
}

// ---------------------------------------------------------------------------
// Phase 2 lot fetch functions
// ---------------------------------------------------------------------------

export function createLot(body: LotCreate, token: string): Promise<LotResponse> {
  return postJson("/api/lots/", body, token);
}

export function listMyLots(token: string): Promise<LotResponse[]> {
  return getJson("/api/lots/mine", token);
}

// ---------------------------------------------------------------------------
// Phase 2 demand fetch functions
// ---------------------------------------------------------------------------

export function createDemand(
  body: DemandCreate,
  token: string,
): Promise<DemandResponse> {
  return postJson("/api/demands/", body, token);
}

export function listMyDemands(token: string): Promise<DemandResponse[]> {
  return getJson("/api/demands/mine", token);
}

// ---------------------------------------------------------------------------
// Phase 2 matching fetch functions
// ---------------------------------------------------------------------------

export function listMyMatches(token: string): Promise<MatchResponse[]> {
  return getJson("/api/matches/mine", token);
}

export function getMatchById(
  matchId: number,
  token: string,
): Promise<MatchResponse> {
  return getJson(`/api/matches/${matchId}`, token);
}

// ---------------------------------------------------------------------------
// Phase 2 offer fetch functions
// ---------------------------------------------------------------------------

export function getMatchOffers(
  matchId: number,
  token: string,
): Promise<OfferResponse[]> {
  return getJson(`/api/matches/${matchId}/offers`, token);
}

export function postOffer(
  matchId: number,
  body: OfferCreate,
  token: string,
): Promise<OfferResponse> {
  return postJson(`/api/matches/${matchId}/offers`, body, token);
}

export function acceptOffer(
  offerId: number,
  token: string,
): Promise<DealResponse> {
  return postJson(`/api/offers/${offerId}/accept`, {}, token);
}

export function declineOffer(
  offerId: number,
  token: string,
): Promise<{ detail: string }> {
  return postJson(`/api/offers/${offerId}/decline`, {}, token);
}
