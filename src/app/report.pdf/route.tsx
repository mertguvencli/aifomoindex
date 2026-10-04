import { join } from "node:path";
import { Document, Font, Line, Link, Page, Path, Rect, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { TOPIC_LABEL, sourceLabel } from "@/components/feed/feed-utils";
import { getCoverage, getFeed, getFomoIndex, getUpdatedAt, type FeedItem } from "@/lib/dataset";
import { BANDS, METHOD_VERSION, biggestWeeks, type Band, type FomoIndex, type Peak } from "@/lib/fomo-index";
import { REPO, SITE_URL } from "@/lib/site";
import { getResearchSnapshot, type ResearchSnapshot } from "@/lib/research";

// The printable weekly report, rendered once per build like og.png, so the
// static export ships a real /report.pdf that always matches the live score.
export const dynamic = "force-static";

const FONTS = join(process.cwd(), "node_modules", "geist", "dist", "fonts", "geist-sans");
Font.register({
  family: "Geist",
  fonts: [
    { src: join(FONTS, "Geist-Regular.ttf"), fontWeight: 400 },
    { src: join(FONTS, "Geist-Medium.ttf"), fontWeight: 500 },
    { src: join(FONTS, "Geist-Bold.ttf"), fontWeight: 700 },
  ],
});
// Long URLs and titles wrap at any character rather than hyphenating words.
Font.registerHyphenationCallback((word) => [word]);

const DAY = 86_400_000;

const TONE: Record<Band["id"], { bg: string; ink: string; line: string }> = {
  chill: { bg: "#e0f2fe", ink: "#075985", line: "#0ea5e9" },
  aware: { bg: "#d1fae5", ink: "#065f46", line: "#059669" },
  anxious: { bg: "#fef3c7", ink: "#92400e", line: "#d97706" },
  fomo: { bg: "#ffe4e6", ink: "#9f1239", line: "#e11d48" },
};

const fmtDay = (t: number) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(t);

const s = StyleSheet.create({
  page: { fontFamily: "Geist", fontSize: 10, color: "#111827", padding: 44, paddingBottom: 60 },
  eyebrow: { fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "#4b5563" },
  muted: { color: "#6b7280" },
  h2: { fontSize: 13, fontWeight: 700, marginTop: 22, marginBottom: 8 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb", paddingVertical: 5 },
  head: { fontSize: 8, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1 },
  footer: { position: "absolute", bottom: 28, left: 44, right: 44, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: "#9ca3af" },
  link: { color: "#111827", textDecoration: "none" },
});

/** The last 90 days with the band thresholds behind the line. */
function TrendChart({ history, tone }: { history: FomoIndex["history"]; tone: (typeof TONE)[Band["id"]] }) {
  const W = 507;
  const H = 120;
  const y = (v: number) => H - (v / 100) * H;
  const step = W / Math.max(1, history.length - 1);
  const pts = history.map((h, i) => `${(i * step).toFixed(1)},${y(h.score).toFixed(1)}`);
  return (
    <View>
      <Svg width={W} height={H}>
        <Rect x={0} y={0} width={W} height={H} fill="#f9fafb" />
        {BANDS.filter((b) => b.min > 0).map((b) => (
          <Line key={b.id} x1={0} x2={W} y1={y(b.min)} y2={y(b.min)} stroke="#e5e7eb" strokeWidth={0.75} />
        ))}
        <Line x1={0} x2={W} y1={y(50)} y2={y(50)} stroke="#9ca3af" strokeWidth={0.75} strokeDasharray="3 3" />
        <Path d={`M${pts.join("L")}L${W},${H}L0,${H}Z`} fill={tone.line} fillOpacity={0.12} />
        <Path d={`M${pts.join("L")}`} fill="none" stroke={tone.line} strokeWidth={1.75} strokeLinejoin="round" />
      </Svg>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4, fontSize: 8, color: "#6b7280" }}>
        <Text>{fmtDay(history[0]!.at)}</Text>
        <Text>Dashed line: 50, the reference level</Text>
        <Text>{fmtDay(history[history.length - 1]!.at)}</Text>
      </View>
    </View>
  );
}

function StoryList({ items }: { items: FeedItem[] }) {
  return (
    <View>
      {items.map((it, i) => (
        <View key={it.id} style={[s.row, { alignItems: "flex-start" }]} wrap={false}>
          <Text style={{ width: 18, color: "#9ca3af" }}>{i + 1}</Text>
          <View style={{ flex: 1 }}>
            <Link src={it.url} style={[s.link, { fontWeight: 500 }]}>
              {it.title}
            </Link>
            <Text style={[s.muted, { fontSize: 8, marginTop: 2 }]}>
              {[sourceLabel(it.publisher), fmtDay(it.ts), it.points !== undefined && `${it.points} points`, ...it.topics.map((t) => TOPIC_LABEL[t])]
                .filter(Boolean)
                .join("  ·  ")}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function Footer({ asOf }: { asOf: number }) {
  return (
    <View style={s.footer} fixed>
      <Text>AI FOMO Index · {fmtDay(asOf)} · {SITE_URL.replace(/^https?:\/\//, "")}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function Report({ fomo, stories, peaks, research }: { fomo: FomoIndex; stories: FeedItem[]; peaks: Peak[]; research: ResearchSnapshot }) {
  const { now, weekAgo } = fomo;
  const tone = TONE[now.band.id];
  const delta = weekAgo === undefined ? null : now.score - weekAgo;
  const cols = [1, 0.5, 0.7, 0.7, 0.5] as const;

  return (
    <Document title={`AI FOMO Index — ${fmtDay(now.at)}`} author="AI FOMO Index" subject="Observation report">
      <Page size="A4" style={s.page}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={s.eyebrow}>AI FOMO Index · Observation report</Text>
          <Text style={[s.muted, { fontSize: 9 }]}>
            {fmtDay(now.at - 7 * DAY)} – {fmtDay(now.at)}
          </Text>
        </View>

        <View style={{ marginTop: 18, padding: 20, borderRadius: 8, backgroundColor: tone.bg, flexDirection: "row", alignItems: "flex-end" }}>
          <Text style={{ fontSize: 72, fontWeight: 700, lineHeight: 1 }}>{now.score}</Text>
          <View style={{ marginLeft: 18, marginBottom: 6, flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: 700, color: tone.ink }}>{now.band.label}</Text>
            {delta !== null && (
              <Text style={{ fontSize: 10, marginTop: 2, color: delta > 0 ? "#be123c" : delta < 0 ? "#047857" : "#4b5563" }}>
                {delta === 0 ? "No change" : `${delta > 0 ? "+" : "-"}${Math.abs(delta)}`} vs last week ({weekAgo})
              </Text>
            )}
            <Text style={{ fontSize: 11, marginTop: 6 }}>{now.band.verdict}</Text>
          </View>
        </View>

        <Text style={s.h2}>Last 90 days</Text>
        <TrendChart history={fomo.history.slice(-90)} tone={tone} />

        <Text style={s.h2}>Signals</Text>
        <View style={[s.row, s.head]}>
          <Text style={{ flex: cols[0] }}>Signal</Text>
          <Text style={{ flex: cols[1], textAlign: "right" }}>Weight</Text>
          <Text style={{ flex: cols[2], textAlign: "right" }}>This week</Text>
          <Text style={{ flex: cols[3], textAlign: "right" }}>Typical week</Text>
          <Text style={{ flex: cols[4], textAlign: "right" }}>Score</Text>
        </View>
        {[...now.signals, now.jobs].map((sig) => (
          <View key={sig.id} style={s.row}>
            <View style={{ flex: cols[0] }}>
              <Text style={{ fontWeight: 500 }}>
                {sig.label}
                {sig.topic ? ` (${TOPIC_LABEL[sig.topic] ?? sig.topic})` : ""}
              </Text>
              <Text style={[s.muted, { fontSize: 8, marginTop: 1 }]}>{sig.describe}</Text>
            </View>
            <Text style={{ flex: cols[1], textAlign: "right" }}>{sig.weight ? sig.weight.toFixed(2) : "info"}</Text>
            <Text style={{ flex: cols[2], textAlign: "right" }}>{sig.current}</Text>
            <Text style={{ flex: cols[3], textAlign: "right" }}>{sig.baseline.toFixed(1)}</Text>
            <Text style={{ flex: cols[4], textAlign: "right", fontWeight: 700 }}>{sig.score}</Text>
          </View>
        ))}
        <Text style={[s.muted, { fontSize: 8, marginTop: 6 }]}>
          Method v{METHOD_VERSION}: an exploratory news-activity composite, not a measure of AI progress or human anxiety.
          Counting signals use a 7-day window and prior 28-day baseline; topic growth is self-normalized.
          Employment mentions has zero weight. Historical peaks and example headlines are not independent validation.
        </Text>
        <Text style={[s.muted, { fontSize: 8, marginTop: 8 }]}>
          Specified source/signal exclusions and equal weights produce {research.sensitivityRange.min}-{research.sensitivityRange.max}.
          This sensitivity range is not a confidence interval. See {SITE_URL}/research.json for the alternatives and input hashes.
          {"\n"}Observation timestamp: {research.asOf}
        </Text>

        <Footer asOf={now.at} />
      </Page>

      <Page size="A4" style={s.page}>
        <Text style={[s.h2, { marginTop: 0 }]}>Illustrative headlines from this window</Text>
        <StoryList items={fomo.drivers} />

        <Text style={s.h2}>Additional headlines from this window</Text>
        <StoryList items={stories} />

        <View wrap={false}>
          <Text style={s.h2}>Highest-scoring historical windows (retrospective)</Text>
          {peaks.map((p) => (
            <View key={p.reading.at} style={s.row}>
              <Text style={{ width: 80 }}>{fmtDay(p.reading.at)}</Text>
              <Text style={{ width: 28, fontWeight: 700, color: TONE[p.reading.band.id].ink }}>{p.reading.score}</Text>
              <Text style={{ flex: 1 }}>{p.drivers[0]?.title ?? ""}</Text>
            </View>
          ))}
        </View>

        <Text style={[s.muted, { fontSize: 8, marginTop: 18 }]}>
          Methodology: <Link style={s.muted} src={`${REPO}/blob/main/docs/fomo-index.md`}>{`${REPO}/blob/main/docs/fomo-index.md`}</Link>
          {"\n"}Live index and data: <Link style={s.muted} src={SITE_URL}>{SITE_URL}</Link>. Data is CC BY 4.0.
        </Text>

        <Footer asOf={now.at} />
      </Page>
    </Document>
  );
}

export async function GET() {
  const items = await getFeed();
  const updatedAt = await getUpdatedAt(items);
  const [fomo, coverage] = await Promise.all([getFomoIndex(items, updatedAt), getCoverage()]);
  const drivers = new Set(fomo.drivers.map((d) => d.id));
  const stories = items
    .filter((it) => it.ts > fomo.now.at - 7 * DAY && it.ts <= fomo.now.at && !drivers.has(it.id))
    .sort((a, b) => b.importance - a.importance || (b.points ?? 0) - (a.points ?? 0) || b.ts - a.ts)
    .slice(0, 8);
  const peaks = biggestWeeks(items, fomo.history, coverage, 5);

  const research = await getResearchSnapshot(items, fomo, coverage);
  const pdf = await renderToBuffer(<Report fomo={fomo} stories={stories} peaks={peaks} research={research} />);
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf" } });
}
