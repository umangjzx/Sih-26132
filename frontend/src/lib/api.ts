const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ---------------------------------------------------------------------------
// Phase 1 types
// ---------------------------------------------------------------------------

export type CropMarketOption = {
  crop: string;
  market: string;
  district: string;
  state?: string;
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
  data_source?: string;
  as_of?: string | null;
};

export type NearestMarketComparison = {
  market: string;
  district: string;
  distance_km: number | null;
  modal_price: number;
  date: string;
};

export type SignalFactor = {
  key: "price" | "arrivals" | "weather" | "forecast";
  weight: number;
  score: number;
  contribution: number;
};

export type SellWaitSignalResponse = {
  recommendation: "sell_now" | "wait" | "hold";
  reasons: string[];
  current_price: number;
  ma_7: number;
  ma_30: number | null;
  volume_trend_pct: number | null;
  days_of_data: number;
  forecast_bias?: number;
  forecast_note?: string | null;
  forecast_change_pct_7d?: number | null;
  total_score?: number;
  factors?: SignalFactor[];
};

export type ForecastPoint = { date: string; yhat: number; lo: number; hi: number };
export type PriceForecast = {
  available: boolean;
  crop: string;
  market: string;
  method: string;
  horizon_days: number;
  last_price: number;
  trend_per_day: number;
  weekly_pattern: Record<string, number>;
  change_pct_7d: number | null;
  change_pct_30d: number | null;
  note: string;
  points: ForecastPoint[];
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
  quality_grade_min?: string | null;
  price_band_min: number;
  price_band_max: number;
  delivery_window: string;
  delivery_district?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type DemandResponse = {
  id: number;
  buyer_id: number;
  crop: string;
  quantity_kg: number;
  quality_spec: string;
  quality_grade_min?: string | null;
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
  base?: number;
  quality_factor?: number;
  timing_factor?: number;
  tier?: "strong" | "good" | "fair" | "weak";
};

export type CounterpartySummary = {
  id: number;
  name: string;
  district: string;
  kyc_status: string;
  verification_status?: "unverified" | "pending" | "verified" | "rejected";
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
  payment_method?: string | null;
  payment_reference?: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Phase 3 types
// ---------------------------------------------------------------------------

export type DealDetailResponse = DealResponse & {
  lot: LotSummary;
  demand: DemandSummary;
  counterparty: CounterpartySummary | null;
};

export type DisputeCreate = { reason: string };

export type DisputeResponse = {
  id: number;
  deal_id: number;
  raised_by: number;
  reason: string;
  status: string;
  created_at: string;
};

export type HistoryResponse = {
  lots: LotResponse[];
  demands: DemandResponse[];
  deals: DealDetailResponse[];
};

export type PriceTrendPoint = { date: string; avg_modal_price: number };

export type DisputeSummary = {
  id: number;
  deal_id: number;
  raised_by: number;
  reason: string;
  status: string;
  created_at: string;
};

export type DistrictPriceGap = {
  district: string;
  avg_modal_price: number;
  gap_vs_state_pct: number;
};
export type PriceAnomaly = {
  crop: string;
  market: string;
  modal_price: number;
  avg_7d: number;
  deviation_pct: number;
};

export type AdminDashboardResponse = {
  total_lots: number;
  open_lots: number;
  total_demands: number;
  open_demands: number;
  total_deals: number;
  open_disputes_count: number;
  price_trend_summary: PriceTrendPoint[];
  dispute_queue: DisputeSummary[];
  district_price_gaps: DistrictPriceGap[];
  disputes_by_district: Record<string, number>;
  price_anomalies: PriceAnomaly[];
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

export async function patchJson<T>(
  path: string,
  body: unknown,
  token?: string,
  method: "PATCH" | "PUT" = "PATCH",
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: JSON.stringify(body ?? {}),
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

export function fetchOptions(
  state?: string,
  coords?: { lat?: number | null; lon?: number | null; radiusKm?: number | null },
): Promise<CropMarketOption[]> {
  const p = new URLSearchParams();
  if (state) p.set("state", state);
  if (typeof coords?.lat === "number" && typeof coords?.lon === "number") {
    p.set("lat", String(coords.lat));
    p.set("lon", String(coords.lon));
    if (typeof coords.radiusKm === "number") p.set("radius_km", String(coords.radiusKm));
  }
  const q = p.toString();
  return getJson(`/api/options${q ? `?${q}` : ""}`);
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

export function fetchForecast(
  crop: string,
  market: string,
  horizon = 30,
): Promise<PriceForecast> {
  const params = new URLSearchParams({ crop, market, horizon: String(horizon) });
  return getJson(`/api/prices/forecast?${params.toString()}`);
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

type AuthPayload = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: import("@/lib/auth").StoredUser;
};

export type LatLon = { latitude?: number | null; longitude?: number | null };
export type SignupLocation = LatLon & { district?: string | null; state?: string | null };

export function login(phone: string, password: string): Promise<AuthPayload> {
  return postJson("/api/auth/login", { phone, password });
}

export function register(
  phone: string,
  name: string,
  role: string,
  password: string,
  location?: SignupLocation,
): Promise<AuthPayload> {
  return postJson("/api/auth/register", { phone, name, role, password, ...(location ?? {}) });
}

export function refreshTokens(
  refreshToken: string,
): Promise<{ access_token: string; refresh_token: string }> {
  return postJson("/api/auth/refresh", { refresh_token: refreshToken });
}

export type ProfilePatch = {
  name?: string;
  district?: string;
  state?: string;
  taluka?: string;
  latitude?: number | null;
  longitude?: number | null;
};

export function updateProfile(
  patch: ProfilePatch,
  token: string,
): Promise<import("@/lib/auth").StoredUser> {
  return patchJson("/api/auth/me", patch, token);
}

export function requestVerification(
  body: { note?: string; reference?: string },
  token: string,
): Promise<import("@/lib/auth").StoredUser> {
  return postJson("/api/auth/me/request-verification", body, token);
}

// ---- admin user management -------------------------------------------------
export type AdminUser = {
  id: number;
  name: string;
  phone: string;
  role: string;
  district: string;
  state: string;
  kyc_status: string;
  verification_status: "unverified" | "pending" | "verified" | "rejected";
  verification_note: string | null;
  verification_ref: string | null;
  is_active: boolean;
  created_at: string | null;
  lots: number;
  demands: number;
  deals: number;
};

export function getAdminUsers(
  token: string,
  opts: { role?: string; verification?: string; q?: string } = {},
): Promise<AdminUser[]> {
  const p = new URLSearchParams();
  if (opts.role) p.set("role", opts.role);
  if (opts.verification) p.set("verification", opts.verification);
  if (opts.q) p.set("q", opts.q);
  const qs = p.toString();
  return getJson(`/api/admin/users${qs ? `?${qs}` : ""}`, token);
}

export function verifyUser(
  id: number,
  status: "verified" | "rejected" | "unverified",
  note: string | undefined,
  token: string,
): Promise<AdminUser> {
  return patchJson(`/api/admin/users/${id}/verify`, { status, note }, token);
}

export function setUserActive(id: number, isActive: boolean, token: string): Promise<AdminUser> {
  return patchJson(`/api/admin/users/${id}/active`, { is_active: isActive }, token);
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

// ---- discovery boards (v1.4 phase 2) ------------------------------------
export type BrowseLot = {
  id: number;
  crop: string;
  quantity_kg: number;
  quality_grade: string;
  expected_price: number;
  available_from: string;
  location: string;
  distance_km: number | null;
  farmer_id: number;
  farmer_name: string;
  farmer_district: string;
  farmer_verified: boolean;
};

export type BrowseDemand = {
  id: number;
  crop: string;
  quantity_kg: number;
  quality_spec: string;
  quality_grade_min?: string | null;
  price_band_min: number;
  price_band_max: number;
  delivery_window: string;
  delivery_district: string;
  distance_km: number | null;
  buyer_id: number;
  buyer_name: string;
  buyer_district: string;
  buyer_verified: boolean;
};

export type ExpressInterestResult = {
  matched: boolean;
  match_id: number | null;
  score: number | null;
  reason: string | null;
};

function browseParams(o: { crop?: string; radiusKm?: number | null }): string {
  const p = new URLSearchParams();
  if (o.crop) p.set("crop", o.crop);
  if (typeof o.radiusKm === "number") p.set("radius_km", String(o.radiusKm));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function browseLots(token: string, o: { crop?: string; radiusKm?: number | null } = {}): Promise<BrowseLot[]> {
  return getJson(`/api/lots/browse${browseParams(o)}`, token);
}

export function browseDemands(token: string, o: { crop?: string; radiusKm?: number | null } = {}): Promise<BrowseDemand[]> {
  return getJson(`/api/demands/browse${browseParams(o)}`, token);
}

export function expressInterestInLot(lotId: number, token: string): Promise<ExpressInterestResult> {
  return postJson(`/api/lots/${lotId}/express-interest`, {}, token);
}

export function expressInterestInDemand(demandId: number, token: string): Promise<ExpressInterestResult> {
  return postJson(`/api/demands/${demandId}/express-interest`, {}, token);
}

export type OcrLotDraft = {
  available: boolean;
  crop: string | null;
  quantity_kg: number | null;
  grade: string | null;
  expected_price: number | null;
  available_from: string | null;
  confidence: number | null;
  note: string | null;
};

export async function scanLotSlip(file: File, token: string): Promise<OcrLotDraft> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_URL}/api/ocr/lot-slip`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json() as Promise<OcrLotDraft>;
}

// ---------------------------------------------------------------------------
// v1.3 — group / pooled requests (FPO collective bargaining)
// ---------------------------------------------------------------------------

export type PoolSummary = {
  id: number;
  organizer_id: number;
  organizer_name: string | null;
  crop: string;
  title: string;
  target_quantity_kg: number;
  floor_price: number;
  grade: string;
  delivery_window: string;
  location: string;
  status: "open" | "locked" | "matched" | "closed";
  created_at: string;
  members: number;
  committed_quantity_kg: number;
  fill_pct: number;
};

export type PoolMemberOut = {
  id: number;
  farmer_id: number;
  farmer_name: string | null;
  lot_id: number | null;
  quantity_kg: number;
  expected_price: number;
  status: "committed" | "withdrawn";
};

export type PoolAggregate = {
  members: number;
  quantity_kg: number;
  weighted_price: number;
  floor_price: number;
  effective_price: number;
  fill_pct: number;
  target_quantity_kg: number;
};

export type PoolDemandCandidate = {
  demand_id: number;
  buyer_name: string;
  buyer_district: string;
  buyer_kyc: string;
  quantity_kg: number;
  price_band_min: number;
  price_band_max: number;
  delivery_window: string;
  score: number;
  tier: "strong" | "good" | "fair" | "weak";
  score_detail: string;
};

export type PoolDetail = PoolSummary & {
  matched_deal_id: number | null;
  aggregate: PoolAggregate;
  member_list: PoolMemberOut[];
  candidates: PoolDemandCandidate[];
  is_organizer: boolean;
  my_membership: PoolMemberOut | null;
};

export type PoolDealResult = {
  deal_id: number;
  lot_id: number;
  match_id: number;
  agreed_price: number;
  agreed_quantity_kg: number;
};

export type PoolCreate = {
  crop: string;
  title: string;
  target_quantity_kg: number;
  floor_price: number;
  grade?: string;
  delivery_window?: string;
  location?: string;
};

export function listPools(
  token: string,
  opts: { crop?: string; mine?: boolean; lat?: number | null; lon?: number | null; radiusKm?: number | null } = {},
): Promise<PoolSummary[]> {
  const p = new URLSearchParams();
  if (opts.crop) p.set("crop", opts.crop);
  if (opts.mine) p.set("mine", "true");
  if (typeof opts.lat === "number" && typeof opts.lon === "number") {
    p.set("lat", String(opts.lat));
    p.set("lon", String(opts.lon));
    if (typeof opts.radiusKm === "number") p.set("radius_km", String(opts.radiusKm));
  }
  const qs = p.toString();
  return getJson(`/api/pools${qs ? `?${qs}` : ""}`, token);
}

export function getPool(id: number, token: string): Promise<PoolDetail> {
  return getJson(`/api/pools/${id}`, token);
}

export function createPool(body: PoolCreate, token: string): Promise<PoolSummary> {
  return postJson("/api/pools", body, token);
}

export function joinPool(
  id: number,
  body: { quantity_kg: number; expected_price: number; lot_id?: number | null },
  token: string,
): Promise<PoolMemberOut> {
  return postJson(`/api/pools/${id}/join`, body, token);
}

export function withdrawPool(id: number, token: string): Promise<PoolMemberOut> {
  return postJson(`/api/pools/${id}/withdraw`, {}, token);
}

export function setPoolStatus(
  id: number,
  status: PoolSummary["status"],
  token: string,
): Promise<PoolSummary> {
  return postJson(`/api/pools/${id}/status`, { status }, token);
}

export function acceptDemandForPool(
  poolId: number,
  body: { demand_id: number; agreed_price?: number },
  token: string,
): Promise<PoolDealResult> {
  return postJson(`/api/pools/${poolId}/accept-demand`, body, token);
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

// ---------------------------------------------------------------------------
// Phase 3 fetch functions
// ---------------------------------------------------------------------------

export function listMyDeals(token: string): Promise<DealDetailResponse[]> {
  return getJson("/api/deals/mine", token);
}

export function getDealById(
  dealId: number | string,
  token: string,
): Promise<DealDetailResponse> {
  return getJson(`/api/deals/${dealId}`, token);
}

export function advanceDeal(
  dealId: number | string,
  token: string,
  body: { payment_method?: string; payment_reference?: string; note?: string } = {},
): Promise<DealDetailResponse> {
  return patchJson(`/api/deals/${dealId}/advance`, body, token);
}

export type DealLogistics = {
  deal_id: number;
  mode: string;
  transporter_name: string | null;
  transporter_phone: string | null;
  vehicle_type: string | null;
  pickup_date: string | null;
  pickup_point: string | null;
  drop_point: string | null;
  distance_km: number | null;
  est_cost_inr: number | null;
  status: string;
  notes: string | null;
  updated_at: string | null;
  is_draft: boolean;
};

export function getDealLogistics(dealId: number | string, token: string): Promise<DealLogistics> {
  return getJson(`/api/deals/${dealId}/logistics`, token);
}

export function saveDealLogistics(
  dealId: number | string,
  body: Partial<Omit<DealLogistics, "deal_id" | "is_draft" | "updated_at" | "distance_km">>,
  token: string,
): Promise<DealLogistics> {
  return patchJson(`/api/deals/${dealId}/logistics`, body, token, "PUT");
}

// ---- payments, audit timeline, transporters, receipt (v1.4 phase 2) ------
export type DealPayment = {
  id: number;
  deal_id: number;
  payer_id: number;
  amount_inr: number;
  method: string;
  reference: string | null;
  note: string | null;
  paid_at: string;
};

export type DealEvent = {
  id: number;
  actor_id: number | null;
  entity_type: string;
  entity_id: number;
  action: string;
  detail: Record<string, unknown> | null;
  created_at: string | null;
};

export type Transporter = {
  id: number;
  name: string;
  phone: string | null;
  district: string | null;
  state: string | null;
  vehicle_types: string | null;
  rate_per_km_per_qtl: number | null;
  max_capacity_tonnes: number | null;
  distance_km: number | null;
};

export function getDealPayments(dealId: number | string, token: string): Promise<DealPayment[]> {
  return getJson(`/api/deals/${dealId}/payments`, token);
}

export function recordPayment(
  dealId: number | string,
  body: { amount_inr: number; method?: string; reference?: string | null; note?: string | null },
  token: string,
): Promise<DealPayment> {
  return postJson(`/api/deals/${dealId}/payments`, body, token);
}

export function getDealEvents(dealId: number | string, token: string): Promise<DealEvent[]> {
  return getJson(`/api/deals/${dealId}/events`, token);
}

export function nearbyTransporters(
  opts: { district?: string; state?: string; lat?: number | null; lon?: number | null; limit?: number },
  token: string,
): Promise<Transporter[]> {
  const p = new URLSearchParams();
  if (opts.district) p.set("district", opts.district);
  if (opts.state) p.set("state", opts.state);
  if (typeof opts.lat === "number" && typeof opts.lon === "number") {
    p.set("lat", String(opts.lat));
    p.set("lon", String(opts.lon));
  }
  if (opts.limit) p.set("limit", String(opts.limit));
  return getJson(`/api/transporters/nearby?${p.toString()}`, token);
}

/**
 * Fetch the auth-gated receipt HTML and show it in a new tab.
 *
 * The tab is opened synchronously inside the click so the browser doesn't
 * treat it as a pop-up; the HTML is written in once the fetch resolves. If the
 * pop-up is still blocked, we fall back to a same-tab data-URL navigation.
 */
export async function openDealReceipt(dealId: number | string, token: string): Promise<void> {
  const win = typeof window !== "undefined" ? window.open("about:blank", "_blank") : null;
  if (win) {
    win.document.write(
      "<!doctype html><title>Receipt…</title><p style='font:14px system-ui;padding:24px'>Preparing receipt…</p>",
    );
  }
  try {
    const res = await fetch(`${API_URL}/api/deals/${dealId}/receipt`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    const html = await res.text();
    if (win && !win.closed) {
      win.document.open();
      win.document.write(html);
      win.document.close();
    } else {
      // pop-up blocked — navigate the current tab to the receipt instead
      window.location.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    }
  } catch (err) {
    if (win && !win.closed) win.close();
    throw err;
  }
}

export function getDealDisputes(
  dealId: number | string,
  token: string,
): Promise<DisputeResponse[]> {
  return getJson(`/api/deals/${dealId}/disputes`, token);
}

export function raiseDisputeOnDeal(
  dealId: number | string,
  body: DisputeCreate,
  token: string,
): Promise<DisputeResponse> {
  return postJson(`/api/deals/${dealId}/disputes`, body, token);
}

export function closeDispute(
  disputeId: number,
  token: string,
): Promise<DisputeResponse> {
  return patchJson(`/api/disputes/${disputeId}/close`, {}, token);
}

export function getMyHistory(token: string): Promise<HistoryResponse> {
  return getJson("/api/history", token);
}

export function getAdminDashboard(
  token: string,
): Promise<AdminDashboardResponse> {
  return getJson("/api/admin/dashboard", token);
}

export type MatchingHealth = {
  total_matches: number;
  buckets: {
    consistent: number;
    drifted: number;
    degraded: number;
    crop_mismatch: number;
    orphaned: number;
  };
  tier_distribution: Record<string, number>;
  mean_abs_score_delta: number;
  precision: number;
  healthy: boolean;
};

export function getMatchingHealth(token: string): Promise<MatchingHealth> {
  return getJson("/api/admin/matching-health", token);
}

export type AdminEvent = {
  id: number;
  actor_id: number | null;
  actor_name: string;
  entity_type: string;
  entity_id: number;
  action: string;
  detail: Record<string, unknown> | null;
  created_at: string | null;
};

export function getAdminEvents(token: string, limit = 60): Promise<AdminEvent[]> {
  return getJson(`/api/admin/events?limit=${limit}`, token);
}

/** Fetch the ledger CSV with auth and trigger a download. */
export async function downloadAdminEventsCsv(token: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/events.csv`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = "agrilink_transaction_log.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export type AdminAnalytics = {
  gmv_inr: number;
  avg_deal_value_inr: number;
  users_total: number;
  users_by_role: Record<string, number>;
  markets_tracked: number;
  districts_tracked: number;
  states_tracked: number;
  price_index_latest: number;
  price_index_change_pct: number;
  match_conversion_pct: number;
  funnel: { stage: string; count: number }[];
  deal_pipeline: Record<string, number>;
  supply_demand: {
    crop: string;
    supply_kg: number;
    demand_kg: number;
    open_lots: number;
    open_demands: number;
    tightness: number;
  }[];
  score_distribution: { label: string; count: number }[];
  weekly_activity: { week: string; deals: number; offers: number; new_users: number }[];
  price_pulse: { crop: string; latest: number; avg_30d: number; change_pct: number }[];
  lots_by_crop: Record<string, number>;
  demands_by_crop: Record<string, number>;
  deal_success_rate_pct: number;
  payment_status_split: Record<string, number>;
  avg_hours_to_deal: number | null;
  price_vs_msp: { crop: string; modal_price: number; msp: number; gap_pct: number }[];
};

export function getAdminAnalytics(token: string): Promise<AdminAnalytics> {
  return getJson("/api/admin/analytics", token);
}

// ===========================================================================
// v1.1 — weather, MSP, calendar, storage/FPO, best market, alerts, public
// ===========================================================================

export type WeatherDay = {
  date: string;
  precip_mm: number;
  temp_max_c: number | null;
  wind_kmh: number | null;
  rain_prob: number | null;
};
export type WeatherCurrent = {
  temp_c: number | null;
  feels_like_c: number | null;
  humidity_pct: number | null;
  wind_kmh: number | null;
  conditions: string | null;
};
export type WeatherForecast = {
  latitude: number;
  longitude: number;
  days: WeatherDay[];
  next3_rain_mm: number | null;
  sell_bias: number;
  note: string;
  source: string;
  current?: WeatherCurrent;
  rain_anomaly?: {
    recent_mm: number | null;
    normal_mm: number | null;
    pct_of_normal: number | null;
    note: string;
  };
};

export type MspInfo = {
  crop: string;
  has_msp: boolean;
  msp_price?: number;
  season?: string;
  unit?: string;
  latest_modal_price: number | null;
  gap_vs_msp?: number;
  below_msp?: boolean;
  note?: string;
};

export type CropCalendar = {
  crop: string;
  sow_months: string;
  harvest_months: string;
  peak_arrival_months: string;
  current_phase: string;
  glut_risk: boolean;
  note: string;
};

export type ColdStorage = {
  name: string;
  type: string;
  district: string;
  lat: number;
  lon: number;
  capacity_tonnes: number;
  crops: string;
  distance_km: number | null;
};

export type FpoInfo = {
  name: string;
  district: string;
  crops: string;
  members: number;
  contact: string;
  distance_km: number | null;
};

export type BestMarketRow = {
  market: string;
  district: string;
  modal_price: number;
  road_km: number;
  drive_min: number | null;
  transport_cost_per_qtl: number;
  net_price_per_qtl: number;
  distance_source: string;
  date: string;
};
export type FreightRate = {
  rate_per_qtl_km: number;
  diesel_inr_per_l: number;
  truck_kmpl: number;
  quintals_per_truck: number;
  breakdown: { handling: number; fuel: number };
  source: string;
  as_of: string;
  distance_km?: number | null;
  est_total_inr?: number | null;
};
export type BestMarketResponse = {
  crop: string;
  origin: { latitude: number; longitude: number };
  best: BestMarketRow;
  here: BestMarketRow | null;
  ranked: BestMarketRow[];
  note: string | null;
  freight?: FreightRate;
};

export type HolidayInfo = { date: string; name: string; in_days: number };

export type PublicOverview = {
  as_of: string | null;
  crops: { crop: string; avg_modal_price: number; change_7d_pct: number | null }[];
  gainers: { crop: string; avg_modal_price: number; change_7d_pct: number }[];
  losers: { crop: string; avg_modal_price: number; change_7d_pct: number }[];
  price_trend: { date: string; avg_modal_price: number }[];
  activity: Record<string, number> & { state?: string };
};

export type PriceAlert = {
  id: number;
  user_id: number;
  crop: string;
  market: string;
  direction: "above" | "below";
  threshold: number;
  active: boolean;
  last_triggered_at: string | null;
  created_at: string;
};
export type PriceAlertCreate = {
  crop: string;
  market: string;
  direction: "above" | "below";
  threshold: number;
};
export type AppNotification = {
  id: number;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  created_at: string;
};

const qs = (o: Record<string, string | number | boolean | undefined>) =>
  new URLSearchParams(
    Object.entries(o).filter(([, v]) => v !== undefined && v !== "") as [string, string][],
  ).toString();

export type ResolvedLocation = {
  state: string;
  district: string;
  display_name: string;
  latitude: number | null;
  longitude: number | null;
  source: string;
  has_prices?: boolean;
};

export function resolveLocation(args: {
  lat?: number;
  lon?: number;
  place?: string;
  ensurePrices?: boolean;
}): Promise<ResolvedLocation> {
  return getJson(
    `/api/location/resolve?${qs({
      lat: args.lat,
      lon: args.lon,
      place: args.place,
      ensure_prices: args.ensurePrices,
    })}`,
  );
}
export function listDistricts(state: string): Promise<string[]> {
  return getJson(`/api/location/districts?state=${encodeURIComponent(state)}`);
}

export function listStates(): Promise<string[]> {
  return getJson("/api/location/states");
}

export function fetchWeather(
  opts: {
    market?: string;
    district?: string;
    lat?: number | null;
    lon?: number | null;
    includeAnomaly?: boolean;
    lang?: string;
  } = {},
): Promise<WeatherForecast> {
  return getJson(
    `/api/weather/forecast?${qs({
      market: opts.market,
      district: opts.district,
      lat: opts.lat ?? undefined,
      lon: opts.lon ?? undefined,
      include_anomaly: opts.includeAnomaly,
      lang: opts.lang,
    })}`,
  );
}
export function fetchMsp(crop: string, market?: string): Promise<MspInfo> {
  return getJson(`/api/msp?${qs({ crop, market })}`);
}
export function fetchCalendar(crop: string): Promise<CropCalendar> {
  return getJson(`/api/calendar?${qs({ crop })}`);
}
export function fetchStorageNearby(
  district: string,
  state?: string,
  coords?: { lat?: number; lon?: number },
): Promise<ColdStorage[]> {
  return getJson(
    `/api/storage/nearby?${qs({ district, state, lat: coords?.lat, lon: coords?.lon })}`,
  );
}
export function fetchFpoNearby(
  district: string,
  crop?: string,
  state?: string,
  coords?: { lat?: number; lon?: number },
): Promise<FpoInfo[]> {
  return getJson(
    `/api/fpo/nearby?${qs({ district, crop, state, lat: coords?.lat, lon: coords?.lon })}`,
  );
}
export function fetchBestMarkets(
  crop: string,
  market: string,
  fast = true,
): Promise<BestMarketResponse> {
  return getJson(`/api/markets/best?${qs({ crop, market, fast })}`);
}
export function fetchHolidays(days = 30): Promise<{ holidays: HolidayInfo[]; note: string | null }> {
  return getJson(`/api/holidays/upcoming?${qs({ days })}`);
}

export type BriefAction = {
  rank: number;
  kind: "sell" | "wait" | "hold" | "msp" | "best_market" | "holiday" | "weather" | "calendar" | "buyers" | "storage";
  urgency: "now" | "soon" | "watch";
  title: string;
  detail: string;
};
export type DecisionBrief = {
  crop: string;
  reference_market: string;
  district: string | null;
  state: string | null;
  as_of: string;
  headline: { action: "sell_now" | "wait" | "hold"; score: number; confidence: "high" | "moderate" | "low" };
  price: { latest_per_qtl: number; ma_7: number; ma_30: number | null; trend_note: string };
  signal: { recommendation: string; total_score: number; factors: unknown[]; reasons: string[] };
  forecast: { available: boolean; change_pct_7d: number | null; note: string | null };
  best_market: {
    here: BestMarketRow | null;
    best: BestMarketRow | null;
    better_alternative: (BestMarketRow & { net_gain_per_qtl: number }) | null;
    freight: FreightRate;
  };
  msp: { price: number; gap: number; below: boolean; season: string } | null;
  weather: { note: string | null; next3_rain_mm: number | null; sell_bias: number | null } | null;
  calendar: CropCalendar | null;
  holiday: HolidayInfo | null;
  buyers_nearby: {
    count: number;
    top: {
      demand_id: number;
      buyer_name: string;
      buyer_district: string;
      buyer_verified: boolean;
      quantity_kg: number;
      price_band: [number, number];
      distance_km: number | null;
    }[];
  };
  storage_nearby: { name: string; type?: string; district?: string; distance_km?: number }[];
  actions: BriefAction[];
  summary: string;
};
export function fetchBrief(params: {
  crop: string;
  market?: string;
  district?: string;
  lat?: number;
  lon?: number;
  radiusKm?: number;
  lang?: string;
}): Promise<DecisionBrief> {
  return getJson(
    `/api/brief?${qs({
      crop: params.crop,
      market: params.market,
      district: params.district,
      lat: params.lat,
      lon: params.lon,
      radius_km: params.radiusKm,
      lang: params.lang,
    })}`,
  );
}
export function fetchPublicOverview(state?: string): Promise<PublicOverview> {
  return getJson(`/api/public/overview?${qs({ state })}`);
}

export function listAlerts(token: string): Promise<PriceAlert[]> {
  return getJson("/api/alerts", token);
}
export function createAlert(body: PriceAlertCreate, token: string): Promise<PriceAlert> {
  return postJson("/api/alerts", body, token);
}
export function toggleAlert(id: number, token: string): Promise<PriceAlert> {
  return patchJson(`/api/alerts/${id}/toggle`, {}, token);
}
export async function deleteAlert(id: number, token: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/alerts/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 204) throw new Error(`Request failed: ${res.status}`);
}
export function listNotifications(token: string, unreadOnly = false): Promise<AppNotification[]> {
  return getJson(`/api/notifications?${qs({ unread_only: unreadOnly })}`, token);
}
export function notificationUnreadCount(token: string): Promise<{ unread: number }> {
  return getJson("/api/notifications/unread-count", token);
}
export function markNotificationRead(id: number, token: string): Promise<AppNotification> {
  return patchJson(`/api/notifications/${id}/read`, {}, token);
}
export async function markAllNotificationsRead(token: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/notifications/read-all`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 204) throw new Error(`Request failed: ${res.status}`);
}

// ===========================================================================
// v1.3 — LLM readability layer (OpenRouter). All degrade to null without a key.
// ===========================================================================

export function fetchAdvisorSummary(
  crop: string,
  market: string,
  lang: string,
): Promise<{ available: boolean; summary: string | null; lang?: string }> {
  return getJson(`/api/advisor/summary?${qs({ crop, market, lang })}`);
}

export type AssistantSource = { title: string; topic: string; score: number };
export function askAssistant(body: {
  question: string;
  crop?: string;
  market?: string;
  lang: string;
}): Promise<{
  available: boolean;
  answer: string | null;
  lang?: string;
  sources?: AssistantSource[];
  reference?: { title: string; text: string }[];
}> {
  return postJson("/api/assistant/ask", body);
}

export function assistantSearch(
  q: string,
  k = 5,
): Promise<{ query: string; results: { title: string; topic: string; score: number; text: string }[] }> {
  return getJson(`/api/assistant/search?${qs({ q, k })}`);
}
