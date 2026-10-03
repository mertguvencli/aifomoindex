"use client";

import { memo, startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Flame, Search, SlidersHorizontal, X } from "lucide-react";
import { FomoHero } from "./fomo-hero";
import type { FomoIndex } from "@/lib/fomo-index";
import type { ReactNode } from "react";
import type { FeedItem } from "@/lib/dataset";
import { feedJsonUrl } from "@/lib/site";
import { TOPICS } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";
import {
  DEFAULT_FILTERS,
  MUST_READ,
  RANGES,
  TOPIC_LABEL,
  type Filters,
  ago,
  check,
  clock,
  dayKey,
  dayLabel,
  filtersFromSearch,
  filtersToSearch,
  fmt,
  haystack,
  rangeMs,
  searchTerms,
  monthLabel,
  shortDate,
  sourceLabel,
  DAY,
} from "./feed-utils";
import { SourceLogo } from "./source-logo";
import { EntitiesCard, GrowingCard, MustReadsCard, OpenDataCard, PulseCard } from "./feed-sidebar";

const PAGE = 40;
/** Breathing room between the toolbar and a day heading scrolled into place. */
const DAY_GAP = 8;
const AGGREGATORS = new Set(["hackernews", "seed"]);

export function FeedView({
  initial,
  total,
  fomo,
  researchNotes,
  builtAt,
  updatedAt,
}: {
  /** The newest stories, inlined into the page. */
  initial: FeedItem[];
  /** Size of the whole feed; `initial` may be a prefix of it. */
  total: number;
  fomo?: FomoIndex;
  researchNotes?: ReactNode;
  builtAt: number;
  updatedAt: number;
}) {
  // The rest of the archive arrives from feed.json (preloaded by the page) after hydration.
  const [full, setFull] = useState<FeedItem[] | null>(initial.length >= total ? initial : null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (full) return;
    let live = true;
    fetch(feedJsonUrl(updatedAt))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`feed.json: ${r.status}`))))
      .then((data: FeedItem[]) => live && startTransition(() => setFull(data)))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updatedAt]);
  const items = full ?? initial;
  const complete = full !== null;

  // Until mount, render against build time in UTC so the static HTML hydrates cleanly.
  const [now, setNow] = useState(builtAt);
  const [timeZone, setTimeZone] = useState<string | undefined>("UTC");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [limit, setLimit] = useState(PAGE);
  const [facetsOpen, setFacetsOpen] = useState(false);
  const [stuck, setStuck] = useState(false);
  const stuckRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const listTopRef = useRef<HTMLDivElement>(null);
  const stickyBarRef = useRef<HTMLDivElement>(null);
  const daysRef = useRef<HTMLDivElement>(null);
  const [barH, setBarH] = useState(61);
  const [activeDay, setActiveDay] = useState(0);

  useEffect(() => {
    setNow(Date.now());
    setTimeZone(undefined);
    setFilters(filtersFromSearch(window.location.search));
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const next = filtersToSearch(filters);
    if (next !== window.location.search) {
      window.history.replaceState(null, "", window.location.pathname + next + window.location.hash);
    }
    setLimit(PAGE);
  }, [filters]);

  // "/" focuses search, Esc clears it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, [contenteditable]");
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "Escape" && document.activeElement === searchRef.current) {
        setFilters((f) => ({ ...f, q: "" }));
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The toolbar gets its frosted backdrop only once it pins to the top.
  useEffect(() => {
    const el = stuckRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Jumps to a day land just under the toolbar, whose height changes across breakpoints.
  useEffect(() => {
    const el = stickyBarRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBarH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The filters popover closes on outside click or Esc.
  useEffect(() => {
    if (!facetsOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!toolbarRef.current?.contains(e.target as Node)) setFacetsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFacetsOpen(false);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [facetsOpen]);

  const update = useCallback((patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch })), []);
  const toggle = useCallback(
    (key: "sources" | "topics", id: string) =>
      setFilters((f) => ({
        ...f,
        [key]: f[key].includes(id) ? f[key].filter((x) => x !== id) : [...f[key], id],
      })),
    [],
  );

  const hays = useMemo(() => new Map(items.map((it) => [it.id, haystack(it)])), [items]);
  const deferredQ = useDeferredValue(filters.q);
  const f = useMemo(() => ({ ...filters, q: deferredQ }), [filters, deferredQ]);
  const terms = useMemo(() => searchTerms(deferredQ), [deferredQ]);

  const { results, sourceCounts, topicCounts, sources, withoutRange } = useMemo(() => {
    const sourceCounts: Record<string, number> = {};
    const topicCounts: Record<string, number> = {};
    const results: FeedItem[] = [];
    const withoutRange: FeedItem[] = [];
    const all: Record<string, number> = {};
    for (const it of items) {
      all[it.publisher] = (all[it.publisher] ?? 0) + 1;
      const ok = check(it, hays.get(it.id)!, f, terms, now);
      if (!ok.rest) continue;
      if (ok.source && ok.topic) {
        withoutRange.push(it);
        if (ok.range) results.push(it);
      }
      if (ok.range && ok.topic) sourceCounts[it.publisher] = (sourceCounts[it.publisher] ?? 0) + 1;
      if (ok.range && ok.source) for (const t of it.topics) topicCounts[t] = (topicCounts[t] ?? 0) + 1;
    }
    if (f.sort === "top") results.sort((a, b) => b.importance - a.importance || b.ts - a.ts);
    const sources = Object.keys(all).sort((a, b) => all[b] - all[a]);
    return { results, sourceCounts, topicCounts, sources, withoutRange };
  }, [items, hays, f, terms, now]);

  const visible = results.slice(0, limit);
  const hasMore = results.length > limit;

  // Every day in the results, loaded or not; `end` is the index just past its last story.
  const allDays = useMemo(() => {
    if (filters.sort !== "latest") return [];
    const out: { key: string; ts: number; count: number; end: number }[] = [];
    results.forEach((it, idx) => {
      const k = dayKey(it.ts, timeZone);
      const last = out.at(-1);
      if (last?.key === k) {
        last.count++;
        last.end = idx + 1;
      } else out.push({ key: k, ts: it.ts, count: 1, end: idx + 1 });
    });
    return out;
  }, [results, filters.sort, timeZone]);

  const timelineDays = useMemo(
    () =>
      allDays.map((d) => ({
        label: dayLabel(d.ts, now, timeZone),
        month: monthLabel(d.ts, timeZone),
        count: d.count,
      })),
    [allDays, now, timeZone],
  );

  const days = useMemo(() => {
    if (filters.sort !== "latest") return [];
    const out: { key: string; ts: number; items: FeedItem[] }[] = [];
    for (const it of visible) {
      const k = dayKey(it.ts, timeZone);
      if (out.at(-1)?.key === k) out.at(-1)!.items.push(it);
      else out.push({ key: k, ts: it.ts, items: [it] });
    }
    return out;
  }, [visible, filters.sort, timeZone]);

  // The day being read: the last one whose heading has scrolled up to the toolbar.
  useEffect(() => {
    const root = daysRef.current;
    if (!root) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const sections = root.querySelectorAll<HTMLElement>("[data-day]");
      let next = -1;
      sections.forEach((el, i) => {
        if (el.getBoundingClientRect().top <= barH + DAY_GAP + 1) next = i;
      });
      setActiveDay(next);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [days.length, barH]);

  const scrollToDay = useCallback(
    (i: number) => {
      const el = daysRef.current?.querySelectorAll<HTMLElement>("[data-day]")[i];
      if (!el) return;
      const y = el.getBoundingClientRect().top + window.scrollY - barH - DAY_GAP;
      window.scrollTo({ top: y, behavior: "smooth" });
    },
    [barH],
  );

  // Days not rendered yet get loaded first, then scrolled to once they mount.
  const pendingJump = useRef<number | null>(null);
  const jumpToDay = (i: number) => {
    if (i < days.length) return scrollToDay(i);
    pendingJump.current = i;
    setLimit((l) => Math.max(l, allDays[i].end));
  };
  useEffect(() => {
    const i = pendingJump.current;
    if (i === null || i >= days.length) return;
    pendingJump.current = null;
    scrollToDay(i);
  }, [days.length, scrollToDay]);

  const storyWhen = (it: FeedItem) =>
    filters.sort === "top" ? shortDate(it.ts, timeZone) : now - it.ts < DAY ? ago(it.ts, now) : clock(it.ts, timeZone);

  // Infinite scroll.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setLimit((l) => l + PAGE), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, visible.length]);

  const active =
    filters.q !== "" ||
    filters.range !== DEFAULT_FILTERS.range ||
    filters.sources.length > 0 ||
    filters.topics.length > 0 ||
    filters.mustRead ||
    filters.sort !== DEFAULT_FILTERS.sort;

  const reset = () => setFilters(DEFAULT_FILTERS);
  // Stable, so the memoized sidebar cards skip re-rendering on scroll and keystrokes.
  const pickEntity = useCallback((label: string) => {
    setFilters((f) => ({ ...f, q: f.q.trim().toLowerCase() === label.toLowerCase() ? "" : label }));
    listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  const toggleTopicAndScroll = useCallback(
    (id: string) => {
      toggle("topics", id);
      listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [toggle],
  );

  const facetCount = filters.sources.length + filters.topics.length;

  return (
    <main className="relative overflow-x-clip">
      <div className="relative z-10">
        {fomo ? <FomoHero index={fomo} timeZone="UTC" /> : (
        <header className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <p className="text-xs uppercase tracking-[0.18em] text-teal-700">Research dataset</p>
          <h1 className="mt-2 font-serif text-4xl text-gray-900">Explore the corpus</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-600">Source headlines collected for the index. Topic labels and importance filters are heuristic; inclusion is not an endorsement or a verified relevance judgment.</p>
        </header>
        )}
        {researchNotes}

        {/* Toolbar: flat until it sticks, then a frosted strip. */}
        <div ref={stuckRef} aria-hidden className="h-px" />
        <div
          ref={stickyBarRef}
          className={cn(
            "animate-fade-in-up sticky top-0 z-30 border-b opacity-0 transition-[background-color,border-color,box-shadow] duration-200",
            stuck
              ? "border-gray-200/70 bg-white/80 shadow-[0_4px_24px_rgba(0,0,0,0.04)] backdrop-blur-xl"
              : "border-transparent",
          )}
        >
          <div ref={toolbarRef} className="relative mx-auto max-w-6xl px-4 py-2.5 sm:px-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <label className="flex h-10 flex-1 items-center gap-2.5 rounded-full bg-white px-4 ring-1 ring-gray-200 transition focus-within:ring-2 focus-within:ring-violet-300 hover:ring-gray-300">
                <Search className="size-4 shrink-0 text-gray-400" />
                <input
                  ref={searchRef}
                  type="search"
                  value={filters.q}
                  onChange={(e) => update({ q: e.target.value })}
                  placeholder="Search stories, companies, topics…"
                  aria-label="Search stories"
                  className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 [&::-webkit-search-cancel-button]:hidden"
                />
                {filters.q ? (
                  <button onClick={() => update({ q: "" })} aria-label="Clear search" className="text-gray-400 hover:text-gray-700">
                    <X className="size-4" />
                  </button>
                ) : (
                  <kbd className="hidden rounded-md border border-gray-200 bg-gray-50 px-1.5 font-mono text-[11px] leading-5 text-gray-500 sm:inline">
                    /
                  </kbd>
                )}
              </label>

              <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
                <Segmented
                  label="Time range"
                  value={filters.range}
                  onChange={(range) => update({ range })}
                  options={RANGES.map((r) => ({ value: r.id, label: r.label }))}
                />
                <Segmented
                  label="Sort"
                  value={filters.sort}
                  onChange={(sort) => update({ sort })}
                  options={[
                    { value: "latest", label: "Latest" },
                    { value: "top", label: "Top" },
                  ]}
                />
                <ToolbarButton
                  onClick={() => update({ mustRead: !filters.mustRead })}
                  aria-pressed={filters.mustRead}
                  on={filters.mustRead}
                  className={filters.mustRead ? "bg-amber-50 text-amber-900 ring-amber-300 hover:ring-amber-400" : undefined}
                >
                  <Flame className={cn("size-4", filters.mustRead ? "fill-amber-400 text-amber-600" : "text-gray-400")} />
                  Must reads
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => setFacetsOpen((o) => !o)}
                  aria-expanded={facetsOpen}
                  aria-controls="feed-filters"
                  on={facetsOpen || facetCount > 0}
                >
                  <SlidersHorizontal className="size-4 text-gray-400" />
                  Filters
                  {facetCount > 0 && (
                    <span className="min-w-[18px] rounded-full bg-gray-900 px-1.5 text-center text-[11px] leading-[18px] text-white tabular-nums">
                      {facetCount}
                    </span>
                  )}
                </ToolbarButton>
                {active && (
                  <button
                    onClick={reset}
                    className="flex h-10 shrink-0 items-center gap-1 rounded-full px-3 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                  >
                    <X className="size-4" />
                    Clear
                  </button>
                )}
              </div>
            </div>

            {facetsOpen && (
              <div
                id="feed-filters"
                className="animate-pop-in absolute inset-x-4 top-full z-40 -mt-1 max-h-[70vh] space-y-5 overflow-y-auto rounded-[28px] border border-gray-200/70 bg-white p-5 shadow-[0_16px_48px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.04)] sm:inset-x-auto sm:right-6 sm:w-[560px]"
              >
                <FacetGroup
                  label="Sources"
                  selected={filters.sources.length}
                  onClear={() => update({ sources: [] })}
                >
                  {sources.map((s) => (
                    <Chip
                      key={s}
                      on={filters.sources.includes(s)}
                      count={sourceCounts[s] ?? 0}
                      onClick={() => toggle("sources", s)}
                    >
                      <SourceLogo source={s} />
                      {sourceLabel(s)}
                    </Chip>
                  ))}
                </FacetGroup>
                <FacetGroup label="Topics" selected={filters.topics.length} onClear={() => update({ topics: [] })}>
                  {TOPICS.map((t) => (
                    <Chip
                      key={t.id}
                      on={filters.topics.includes(t.id)}
                      count={topicCounts[t.id] ?? 0}
                      onClick={() => toggle("topics", t.id)}
                    >
                      {t.label}
                    </Chip>
                  ))}
                </FacetGroup>
              </div>
            )}
          </div>
        </div>

        {/* Selected facets, removable in place */}
        <div className="mx-auto flex max-w-6xl flex-wrap gap-1.5 px-4 pb-4 sm:px-6">
          {filters.sources.map((s) => (
            <SelectedPill key={s} onRemove={() => toggle("sources", s)} label={sourceLabel(s)}>
              <SourceLogo source={s} className="size-3.5 rounded-[3px]" />
              {sourceLabel(s)}
            </SelectedPill>
          ))}
          {filters.topics.map((t) => (
            <SelectedPill key={t} onRemove={() => toggle("topics", t)} label={TOPIC_LABEL[t]}>
              {TOPIC_LABEL[t]}
            </SelectedPill>
          ))}
        </div>

        {/* Content */}
        <div
          ref={listTopRef}
          className="mx-auto grid max-w-6xl scroll-mt-20 grid-cols-1 gap-4 px-4 pb-24 sm:px-6 lg:grid-cols-[2fr_1fr]"
        >
          <section className="min-w-0 rounded-4xl bg-gradient-to-b from-violet-300/20 to-white p-3 sm:p-6">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 px-3 pt-3 sm:pt-0">
              <h2 className="text-2xl font-normal text-gray-900">
                {filters.sort === "top" ? "Top Stories" : "Latest"}
                <span className="ml-2 align-middle text-sm text-gray-500 tabular-nums">{fmt(complete || active ? results.length : total)}</span>
              </h2>
            </div>

            {results.length === 0 && !complete && !failed ? (
              <LoadingMore />
            ) : results.length === 0 ? (
              <EmptyState hasData={items.length > 0} onReset={reset} />
            ) : (
              <div>
                {days.length > 0 ? (
                  <div ref={daysRef} className="relative">
                    {allDays.length > 1 && (
                      <Timeline
                        top={barH + 16}
                        days={timelineDays}
                        active={Math.max(0, activeDay)}
                        onPick={jumpToDay}
                      />
                    )}
                    {days.map((d, i) => (
                      <DayGroup key={d.key} label={dayLabel(d.ts, now, timeZone)} first={i === 0}>
                        {d.items.map((it) => (
                          <StoryRow
                            key={it.id}
                            item={it}
                            terms={terms}
                            when={storyWhen(it)}
                            activeTopics={filters.topics}
                            onToggle={toggle}
                          />
                        ))}
                      </DayGroup>
                    ))}
                  </div>
                ) : (
                  visible.map((it) => (
                    <StoryRow
                      key={it.id}
                      item={it}
                      terms={terms}
                      when={storyWhen(it)}
                      activeTopics={filters.topics}
                      onToggle={toggle}
                    />
                  ))
                )}
                {hasMore && (
                  <div ref={sentinelRef} className="flex justify-center pt-4">
                    <button
                      onClick={() => setLimit((l) => l + PAGE)}
                      className="rounded-full bg-white px-5 py-2 text-sm text-gray-700 shadow-sm ring-1 ring-gray-200 transition hover:text-gray-900 hover:ring-gray-300"
                    >
                      Show more · {fmt(results.length - limit)} left
                    </button>
                  </div>
                )}
                {!hasMore && !complete && !failed && <LoadingMore />}
                {!hasMore && complete && results.length > PAGE && (
                  <p className="pt-6 text-center text-xs text-gray-400">You&apos;re all caught up.</p>
                )}
              </div>
            )}
          </section>

          <aside className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:flex lg:flex-col lg:items-stretch lg:sticky lg:top-[76px] lg:max-h-[calc(100vh-92px)] lg:self-start lg:overflow-y-auto lg:overscroll-contain lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden">
            <PulseCard items={withoutRange} now={now} rangeMs={rangeMs(filters.range)} timeZone={timeZone} />
            <GrowingCard items={items} now={now} active={filters.topics} onToggle={toggleTopicAndScroll} />
            <EntitiesCard items={items} now={now} query={filters.q} onPick={pickEntity} />
            <MustReadsCard items={items} now={now} />
            <OpenDataCard />
          </aside>
        </div>
      </div>
    </main>
  );
}

// ---- pieces ----

/** One day of stories under its date heading. */
function DayGroup({ label, first, children }: { label: string; first: boolean; children: React.ReactNode }) {
  return (
    <section data-day>
      <h3 className={cn("px-3 pb-2 text-base font-semibold text-gray-900", first ? "mt-2" : "mt-8")}>{label}</h3>
      {children}
    </section>
  );
}

/**
 * A scrubber in the left margin: one tick per day, its length the day's story
 * count, filled up to the day being read. Hover names a day, click jumps to it.
 */
function Timeline({
  top,
  days,
  active,
  onPick,
}: {
  top: number;
  days: { label: string; month: string; count: number }[];
  active: number;
  onPick: (i: number) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...days.map((d) => d.count));
  const at = (i: number) => `${(i / (days.length - 1)) * 100}%`;

  const nearest = (e: React.PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    return Math.round(ratio * (days.length - 1));
  };

  return (
    <div className="sticky z-40 hidden h-0 xl:block" style={{ top }}>
      <nav
        aria-label="Timeline"
        onPointerMove={(e) => setHover(nearest(e))}
        onPointerLeave={() => setHover(null)}
        onClick={() => hover !== null && onPick(hover)}
        className="absolute w-10 cursor-pointer"
        style={{ right: "calc(100% + 36px)", height: `calc(100vh - ${top + 32}px)`, maxHeight: days.length * 28 }}
      >
        {/* Rail, filled up to the current day. */}
        <div className="absolute inset-y-0 right-2 w-px bg-gray-200" />
        <div className="absolute right-2 top-0 w-px bg-violet-400 transition-[height] duration-300" style={{ height: at(active) }} />

        {days.map((d, i) => (
          <button
            key={i}
            aria-label={`${d.label}, ${d.count} stories`}
            aria-current={i === active ? "true" : undefined}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            className={cn(
              "absolute right-2 h-0.5 -translate-y-1/2 rounded-full outline-none transition-colors",
              i === hover ? "bg-gray-900" : i <= active ? "bg-violet-400" : "bg-gray-300",
            )}
            style={{ top: at(i), width: 4 + (d.count / max) * 16 }}
          />
        ))}

        {/* Month names where the month turns, out in the margin past the longest tick. */}
        {days.map(
          (d, i) =>
            (i === 0 || d.month !== days[i - 1].month) && (
              <span
                key={`m${i}`}
                aria-hidden
                className="pointer-events-none absolute right-8 -translate-y-1/2 text-[10px] font-medium uppercase tracking-wider text-gray-400"
                style={{ top: at(i) }}
              >
                {d.month}
              </span>
            ),
        )}

        <span
          aria-hidden
          className="absolute right-2 size-2.5 -translate-y-1/2 translate-x-1/2 rounded-full bg-violet-600 ring-4 ring-violet-100 transition-[top] duration-300"
          style={{ top: at(active) }}
        />

        {hover !== null && (
          <span
            className="pointer-events-none absolute left-full ml-1 -translate-y-1/2 whitespace-nowrap rounded-full bg-gray-900 px-2.5 py-1 text-xs text-white shadow-lg"
            style={{ top: at(hover) }}
          >
            {days[hover].label}
            <span className="ml-1.5 text-gray-400 tabular-nums">{fmt(days[hover].count)}</span>
          </span>
        )}
      </nav>
    </div>
  );
}

/** Memoized: the list re-renders on scroll (active day) and each minute, but rows rarely change. */
const StoryRow = memo(function StoryRow({
  item,
  terms,
  when,
  activeTopics,
  onToggle,
}: {
  item: FeedItem;
  terms: string[];
  when: string;
  activeTopics: string[];
  onToggle: (key: "sources" | "topics", id: string) => void;
}) {
  const mustRead = item.importance >= MUST_READ;
  // Aggregators link out to many sites, so the domain tells you where you're going.
  const showDomain = item.domain && AGGREGATORS.has(item.publisher);
  return (
    <article className="group relative flex gap-3 rounded-2xl px-3 py-3.5 transition-colors hover:bg-white/90 hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.04)]">
      <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-foreground" />
      <div className="min-w-0 flex-grow">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[15px] font-medium leading-snug text-foreground transition-colors after:absolute after:inset-0 after:rounded-2xl group-hover:text-foreground/70"
        >
          <Highlight text={item.title} terms={terms} />
        </a>
        {item.summary && (
          <p className="mt-1 line-clamp-2 text-sm text-gray-600">
            <Highlight text={item.summary} terms={terms} />
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-gray-600">
          <button
            onClick={() => onToggle("sources", item.publisher)}
            className="relative z-10 flex items-center gap-1.5 hover:text-gray-900"
            title={`Filter by ${sourceLabel(item.publisher)}`}
          >
            <SourceLogo source={item.publisher} className="size-3.5 rounded-[3px]" />
            {sourceLabel(item.publisher)}
          </button>
          {showDomain && <span className="max-w-[16ch] truncate text-gray-500">{item.domain}</span>}
          <time dateTime={new Date(item.ts).toISOString()} className="tabular-nums text-gray-500">
            {when}
          </time>
          {mustRead && (
            <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900">
              <Flame className="size-3 text-amber-600" />
              Must read
            </span>
          )}
          {item.topics.slice(0, 3).map((t) => (
            <button
              key={t}
              onClick={() => onToggle("topics", t)}
              className={cn(
                "relative z-10 rounded-full px-2 py-0.5 transition-colors",
                activeTopics.includes(t)
                  ? "bg-blue-100 text-blue-800"
                  : "bg-white/80 text-gray-600 ring-1 ring-gray-200/70 hover:text-gray-900 hover:ring-gray-300",
              )}
            >
              {TOPIC_LABEL[t]}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
});

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>;
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return (
    <>
      {text.split(re).map((part, i) =>
        i % 2 ? (
          <mark key={i} className="rounded-sm bg-amber-200/70 px-0.5 text-inherit">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex h-10 shrink-0 items-center rounded-full bg-gray-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-full whitespace-nowrap rounded-full px-3 text-sm transition-all",
            value === o.value
              ? "bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.04)]"
              : "text-gray-500 hover:text-gray-900",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ToolbarButton({
  on,
  className,
  children,
  ...props
}: { on: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-3.5 text-sm ring-1 transition-colors",
        on ? "text-gray-900 ring-gray-300" : "text-gray-600 ring-gray-200 hover:text-gray-900 hover:ring-gray-300",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** One titled block of wrapping chips inside the filters popover. */
function FacetGroup({
  label,
  selected,
  onClear,
  children,
}: {
  label: string;
  selected: number;
  onClear: () => void;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</h3>
        {selected > 0 && (
          <button onClick={onClear} className="text-xs text-gray-500 hover:text-gray-900">
            Clear
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </section>
  );
}

function SelectedPill({ label, onRemove, children }: { label: string; onRemove: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onRemove}
      aria-label={`Remove ${label} filter`}
      className="group flex items-center gap-1.5 rounded-full bg-gray-900 py-1 pl-2.5 pr-2 text-xs text-white shadow-sm transition-colors hover:bg-gray-700"
    >
      {children}
      <X className="size-3 text-gray-400 group-hover:text-white" />
    </button>
  );
}

function Chip({
  on,
  count,
  onClick,
  children,
}: {
  on: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-all",
        on
          ? "bg-gray-900 text-white shadow-sm"
          : "bg-white/70 text-gray-700 ring-1 ring-gray-200/80 backdrop-blur hover:bg-white hover:ring-gray-300",
        !on && count === 0 && "opacity-45",
      )}
    >
      {children}
      <span className={cn("text-xs tabular-nums", on ? "text-gray-300" : "text-gray-400")}>{fmt(count)}</span>
    </button>
  );
}

function LoadingMore() {
  return <p className="animate-pulse pt-6 text-center text-xs text-gray-400">Loading older stories…</p>;
}

function EmptyState({ hasData, onReset }: { hasData: boolean; onReset: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-20 text-center">
      <SlidersHorizontal className="size-6 text-gray-300" />
      {hasData ? (
        <>
          <p className="mt-4 font-serif text-2xl text-gray-900">Nothing matches — yet.</p>
          <p className="mt-1 text-sm text-gray-600">Try a wider time range or fewer filters.</p>
          <button
            onClick={onReset}
            className="mt-5 rounded-full bg-gray-900 px-4 py-2 text-sm text-white transition-colors hover:bg-gray-700"
          >
            Clear all filters
          </button>
        </>
      ) : (
        <>
          <p className="mt-4 font-serif text-2xl text-gray-900">No stories yet.</p>
          <p className="mt-1 text-sm text-gray-600">
            The pipeline hasn&apos;t run. Trigger the <code>pipeline</code> workflow to populate the dataset.
          </p>
        </>
      )}
    </div>
  );
}
