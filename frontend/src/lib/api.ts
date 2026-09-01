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
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, {
    method: "PATCH",
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

export function fetchOptions(state?: string): Promise<CropMarketOption[]> {
  const p = new URLSearchParams();
  if (state) p.set("state", state);
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
): Promise<DealDetailResponse> {
  return patchJson(`/api/deals/${dealId}/advance`, {}, token);
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
export type BestMarketResponse = {
  crop: string;
  origin: { latitude: number; longitude: number };
  best: BestMarketRow;
  here: BestMarketRow | null;
  ranked: BestMarketRow[];
  note: string | null;
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
export function listStates(): Promise<string[]> {
  return getJson("/api/location/states");
}

export function fetchWeather(
  opts: { market?: string; lat?: number; lon?: number; includeAnomaly?: boolean } = {},
): Promise<WeatherForecast> {
  return getJson(
    `/api/weather/forecast?${qs({
      market: opts.market,
      lat: opts.lat,
      lon: opts.lon,
      include_anomaly: opts.includeAnomaly,
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
