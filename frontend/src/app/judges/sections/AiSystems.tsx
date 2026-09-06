"use client";

import { Icon } from "@/components/ui";
import { ExpandableCard, JudgeSection } from "./shared";

type Kind = "rule" | "statistical" | "api-ai" | "retrieval";

const KIND_STYLE: Record<Kind, { label: string; cls: string }> = {
  rule: { label: "Rule-based logic — not AI", cls: "bg-[var(--line)] text-[var(--ink-soft)]" },
  statistical: { label: "Statistical model — not ML", cls: "bg-blue-50 text-blue-700" },
  "api-ai": { label: "Real AI — external LLM API", cls: "bg-[var(--green-100)] text-[var(--green-700)]" },
  retrieval: { label: "Classical retrieval — not semantic ML", cls: "bg-[var(--amber-100)] text-[var(--amber-700)]" },
};

function KindBadge({ kind }: { kind: Kind }) {
  const s = KIND_STYLE[kind];
  return <span className={`al-badge normal-case tracking-normal ${s.cls}`}>{s.label}</span>;
}

const SYSTEMS = [
  {
    name: "Sell / Wait / Hold Signal",
    kind: "rule" as Kind,
    problem: "Tell a farmer whether to sell now, wait, or hold — with a reason, not a black box",
    input: "≥7 days of crop+market price history, weather forecast, MSP",
    logic: "total = 2×price_momentum + volume_trend + weather_pressure, thresholded into sell/wait/hold",
    model: "Deterministic Python if/else and arithmetic — README states explicitly this is 'rule-based, not ML'",
    output: "sell_now / wait / hold + a reasons[] list naming every factor and its weight",
    accuracy: "Not applicable — it's a transparent formula, not a trained model with an accuracy score to report",
    limitations: "No arrival-volume data exists in the live feed (data.gov.in has no daily-arrivals field), so that factor only contributes on synthetic fixture data",
    future: "Could be recalibrated with real arrival data if a future data.gov.in resource exposes it",
  },
  {
    name: "Price Forecast",
    kind: "statistical" as Kind,
    problem: "Project where a price is headed over the next 30 days, with honest uncertainty",
    input: "≥14 days of price history",
    logic: "Least-squares linear trend over the last 45 days + day-of-week seasonality from de-trended residuals",
    model: "Classical statistics (trend + seasonality decomposition) — explicitly no ML library involved",
    output: "30-day projection with an ~80% prediction band that widens with horizon",
    accuracy: "Not benchmarked against a held-out labeled test set — the model's honesty comes from showing its own uncertainty band, not a claimed accuracy percentage",
    limitations: "Won't anticipate a sudden policy shock or an unprecedented weather event — it extrapolates from recent history only",
    future: "A backtesting harness (train on N-30 days, score against the real next 30) would let this section report a real MAPE instead of 'not benchmarked'",
  },
  {
    name: "OCR — Mandi Slip Reading",
    kind: "api-ai" as Kind,
    problem: "Read a photographed or handwritten mandi slip and draft the lot form",
    input: "JPEG/PNG/WebP image, ≤ 6 MB",
    logic: "The image is sent as a base64 data URL to a vision-capable LLM via OpenRouter; backend validates and sanitises every returned field",
    model: "A real external multimodal model (OpenRouter, default openai/gpt-4o-mini or any vision-capable model the operator configures) — this is genuine API-powered AI, not in-house rule logic",
    output: "{crop, quantity_kg, grade, expected_price, available_from, confidence} — a draft, never auto-submitted",
    accuracy: "Per-extraction confidence is returned by the model itself; there is no aggregate accuracy benchmark across a labeled slip dataset",
    limitations: "Handwriting legibility, lighting, and slip format all affect read quality; any field the model can't read clearly is omitted rather than guessed",
    future: "A labeled set of real mandi slips would let this be benchmarked properly rather than reviewed case-by-case",
  },
  {
    name: "Ask AgriLink — Knowledge Retrieval",
    kind: "retrieval" as Kind,
    problem: "Answer 'how does X work' questions from real reference text, not just live numbers",
    input: "Free-text question + optional crop/market context",
    logic: "TF-IDF token-overlap scoring + a difflib fuzzy fallback for near-miss tokens + title similarity + a curated query-side synonym expansion (e.g. 'combining harvest with other farmers' -> pool/aggregate/fpo) — explicitly no embeddings, no network call for the search itself, still lexical rather than semantic",
    model: "Classical information retrieval over a ~13-note curated corpus plus documents generated from the MSP/calendar/grading/holiday tables",
    output: "Top-k chunks with scores; POST /assistant/ask injects them as context for an optional LLM to phrase the final answer",
    accuracy: "Retrieval quality is inspectable directly via GET /api/assistant/search (returns the matched chunks + scores for any query) rather than a single claimed accuracy number. A real gap was found and fixed this session: 'combining my harvest with other farmers' returned no FPO/pooling result in the top 4 (ranked 8th); the synonym expansion now surfaces it 1st — see tests/test_knowledge.py::test_synonym_expansion_finds_paraphrased_queries",
    limitations: "A paraphrase with no shared vocabulary — and no curated synonym for it — can still miss. This is still lexical retrieval, not semantic search; the synonym list is hand-curated from observed gaps, not learned",
    future: "Local (offline) embeddings would generalize this recall gain to paraphrases nobody has hand-curated for, without breaking the no-network constraint",
  },
  {
    name: "Decision Brief & Advisor Summary — LLM readability layer",
    kind: "api-ai" as Kind,
    problem: "Restate an already-computed, rule-based recommendation in plain, farmer-friendly language, in the chosen language",
    input: "The structured output of the sell/wait signal, forecast, best-market, MSP and weather services",
    logic: "The LLM is given the numbers the rule-based engine already produced and instructed only to phrase them — it is never asked to decide anything itself",
    model: "OpenRouter chat completion (same optional key as OCR)",
    output: "2-3 sentence summary in English/Hindi/Marathi; a deterministic sentence template is used when no key is configured",
    accuracy: "Not applicable to \"accuracy\" — correctness is enforced structurally (the LLM only sees numbers already computed, so it cannot introduce a wrong number, only a phrasing choice)",
    limitations: "Phrasing quality depends on the configured model; cached 6 hours by prompt hash so identical requests don't re-call the API",
    future: "—",
  },
];

export function AiSystemsSection() {
  return (
    <JudgeSection
      id="ai-systems"
      eyebrow="Transparency"
      title="AI / intelligence systems — what's actually AI, and what isn't"
      quickAnswer="Two of AgriLink's five 'intelligent' features are genuine AI (a vision LLM for OCR, an optional LLM for phrasing) — the recommendation engine itself is deliberately rule-based and statistical so every number is explainable, not a model's guess."
    >
      <div className="al-card-plain mb-6 flex flex-wrap items-start gap-2.5 !bg-[var(--amber-50)] !border-[var(--amber-200)] p-4">
        <Icon name="alert" size={16} className="mt-0.5 shrink-0 text-[var(--amber-700)]" />
        <p className="text-sm leading-relaxed text-[var(--amber-700)]">
          <span className="font-bold">Why the signal and forecast aren&apos;t &quot;AI&quot;: </span>
          a farmer needs to trust the number enough to act on it. A rule-based formula can be
          fully explained — every weight is visible in <code className="rounded bg-white/60 px-1">reasons[]</code>.
          An ML model&apos;s confidence score can&apos;t be explained the same way, and training one
          well needs far more historical data than a hackathon timeline allows. So AgriLink
          only reaches for a real LLM where it&apos;s genuinely the right tool — reading an
          image, or phrasing an already-correct number — never to produce the number itself.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {SYSTEMS.map((s) => (
          <ExpandableCard key={s.name} title={s.name} subtitle={s.problem} headerRight={<KindBadge kind={s.kind} />}>
            <dl className="grid gap-x-6 gap-y-3 text-xs sm:grid-cols-2">
              <div><dt className="font-bold uppercase tracking-wide text-[var(--ink-mute)]">Input data</dt><dd className="mt-0.5 text-[var(--ink-soft)]">{s.input}</dd></div>
              <div><dt className="font-bold uppercase tracking-wide text-[var(--ink-mute)]">Model / algorithm</dt><dd className="mt-0.5 text-[var(--ink)]">{s.model}</dd></div>
              <div className="sm:col-span-2"><dt className="font-bold uppercase tracking-wide text-[var(--ink-mute)]">Processing logic</dt><dd className="mt-0.5 text-[var(--ink-soft)]">{s.logic}</dd></div>
              <div className="sm:col-span-2"><dt className="font-bold uppercase tracking-wide text-[var(--ink-mute)]">Output</dt><dd className="mt-0.5 text-[var(--ink-soft)]">{s.output}</dd></div>
              <div className="sm:col-span-2"><dt className="font-bold uppercase tracking-wide text-[var(--ink-mute)]">Accuracy / evaluation</dt><dd className="mt-0.5 text-[var(--ink-soft)]">{s.accuracy}</dd></div>
              <div><dt className="font-bold uppercase tracking-wide text-[var(--ink-mute)]">Limitations</dt><dd className="mt-0.5 text-[var(--ink-soft)]">{s.limitations}</dd></div>
              {s.future !== "—" && (
                <div><dt className="font-bold uppercase tracking-wide text-[var(--ink-mute)]">Future improvement</dt><dd className="mt-0.5 text-[var(--ink-soft)]">{s.future}</dd></div>
              )}
            </dl>
          </ExpandableCard>
        ))}
      </div>
    </JudgeSection>
  );
}
