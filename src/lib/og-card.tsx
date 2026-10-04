import { ImageResponse } from "next/og";
import { bandFor, type Band, type FomoIndex } from "@/lib/fomo-index";
import { SITE_URL } from "@/lib/site";

// The share preview card, shared by the current reading (/og.png) and each
// week's page (/week/<week>/og.png).

const size = { width: 1200, height: 630 };

const TONE: Record<Band["id"], { bg: string; ink: string; line: string }> = {
  chill: { bg: "#e0f2fe", ink: "#075985", line: "#0ea5e9" },
  aware: { bg: "#d1fae5", ink: "#065f46", line: "#059669" },
  anxious: { bg: "#fef3c7", ink: "#92400e", line: "#d97706" },
  fomo: { bg: "#ffe4e6", ink: "#9f1239", line: "#e11d48" },
};

export interface OgCardProps {
  score: number;
  weekAgo?: number;
  /** Time of the reading, printed as its date. */
  at: number;
  history: FomoIndex["history"];
  /** Replaces the site name on the right of the header, e.g. a week label. */
  kicker?: string;
}

export function ogCard({ score, weekAgo, at, history: all, kicker }: OgCardProps) {
  const band = bandFor(score);
  // The card shows the recent trend; years of daily points would be a blur.
  const history = all.slice(-90);
  const tone = TONE[band.id];
  const delta = weekAgo === undefined ? null : score - weekAgo;

  const W = 1040;
  const H = 150;
  const step = W / Math.max(1, history.length - 1);
  const pts = history.map((h, i) => `${(i * step).toFixed(1)},${(H - (h.score / 100) * H).toFixed(1)}`);
  const line = `M${pts.join("L")}`;
  const normal = H - 0.5 * H;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "56px 80px",
          background: `linear-gradient(180deg, ${tone.bg} 0%, #ffffff 85%)`,
          color: "#111827",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 28 }}>
          <span style={{ letterSpacing: 6, textTransform: "uppercase", color: "#4b5563" }}>AI FOMO Index</span>
          <span style={{ color: "#6b7280" }}>{kicker ?? SITE_URL.replace(/^https?:\/\//, "")}</span>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", marginTop: 24 }}>
          <span style={{ fontSize: 200, lineHeight: 1, fontWeight: 700, letterSpacing: -8 }}>{score}</span>
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 40, marginBottom: 28 }}>
            <span style={{ fontSize: 48, color: tone.ink, fontWeight: 600 }}>{band.label}</span>
            {delta !== null && (
              <span style={{ fontSize: 30, color: delta >= 0 ? "#be123c" : "#047857", marginTop: 4 }}>
                {delta === 0 ? "No change" : `${delta > 0 ? "+" : "−"}${Math.abs(delta)}`} vs last week
              </span>
            )}
          </div>
        </div>

        <span style={{ fontSize: 28, marginTop: 12, color: "#1f2937" }}>{band.verdict}</span>
        <span style={{ fontSize: 20, marginTop: 12, color: "#6b7280" }}>Exploratory news-activity index · {new Date(at).toISOString().slice(0, 10)} · Not a measure of AI progress</span>

        {history.length > 1 && (
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ marginTop: "auto" }}>
            <line x1={0} x2={W} y1={normal} y2={normal} stroke="#d1d5db" strokeWidth={2} strokeDasharray="6 6" />
            <path d={`${line}L${W},${H}L0,${H}Z`} fill={tone.line} fillOpacity={0.15} />
            <path d={line} fill="none" stroke={tone.line} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        )}
      </div>
    ),
    size,
  );
}
