import { sourceLabel } from "@/components/feed/feed-utils";
import { getCoverage, getFeed, getFomoIndex, getUpdatedAt } from "@/lib/dataset";
import { getResearchSnapshot } from "@/lib/research";
import { BASE_PATH, REPO } from "@/lib/site";

const link = "underline decoration-gray-300 underline-offset-4 hover:text-foreground hover:decoration-foreground/50";
const heading = "text-xs font-medium uppercase tracking-[0.16em] text-gray-500";
const day = (at: number) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(at);

export async function ResearchNotes() {
  const items = await getFeed();
  const at = await getUpdatedAt(items);
  const [index, coverage] = await Promise.all([getFomoIndex(items, at), getCoverage()]);
  const research = await getResearchSnapshot(items, index, coverage);
  const sources = [...research.sources].sort((a, b) => b.total - a.total);
  const primary = sources[0];
  const dataHash = research.hashes.find((h) => h.file === "data/index.json")!;
  return (
    <div className="mx-auto max-w-6xl px-4 pb-4 sm:px-6">
      <details className="group rounded-3xl bg-gradient-to-r from-sky-100/50 via-violet-100/40 to-white px-5 py-4 sm:px-8">
        <summary className="cursor-pointer text-sm font-medium text-gray-700">Research notes <span className="ml-2 font-normal text-gray-500">Method, sensitivity & source coverage</span></summary>
        <div className="mt-6">
        <p className="mb-4 text-sm leading-relaxed text-gray-600">Can the changing volume and attention around AI be described with a transparent, reproducible index? This study compares a week of collected news with its recent baseline. It measures activity in selected sources, not intelligence, impact, or how far anyone is falling behind.</p>
        <dl className="mb-7 grid grid-cols-2 gap-y-5 border-y border-gray-200 py-5 sm:grid-cols-4">
          {[["Corpus records", items.length.toLocaleString("en-US")], ["Source streams", sources.length], ["Daily reconstructions", index.history.length.toLocaleString("en-US")], ["Data observed through", day(at)]].map(([label, value]) => <div key={label} className="pr-3"><dt className="text-[11px] text-gray-500">{label}</dt><dd className="mt-1 font-mono text-sm sm:text-base">{value}</dd></div>)}
        </dl>
        <section aria-labelledby="robustness-title" className="grid gap-8 border-b border-gray-200 py-10 lg:grid-cols-[1fr_1.15fr]">
          <div>
            <p className={heading}>02 / Sensitivity check</p>
            <h2 id="robustness-title" className="mt-3 text-2xl font-normal">How much does the method matter?</h2>
            <p className="mt-4 text-sm leading-relaxed text-gray-600">Recompute this observation with equal weights, omit each signal in turn, then omit each eligible source from both current and reference windows.</p>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">These specified alternatives produce scores from <strong className="font-medium text-gray-900">{research.sensitivityRange.min} to {research.sensitivityRange.max}</strong>. The range is a sensitivity diagnostic, <strong className="font-medium">not a confidence interval</strong>. It does not test every modeling choice.</p>
          </div>
          <div className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">
            <div className="mb-4 flex justify-between text-[11px] uppercase tracking-wider text-gray-500"><span>Specification</span><span>Score / 100</span></div>
            {research.scenarios.filter((s) => s.kind !== "source").map((s) => <div key={s.id} className="grid grid-cols-[minmax(0,1.5fr)_1fr_2ch] items-center gap-3 py-2 text-xs"><span className={s.kind === "baseline" ? "font-medium text-blue-700" : "text-gray-600"}>{s.label}</span><div className="h-1.5 rounded-full bg-gray-100"><div className={`h-full rounded-full ${s.kind === "baseline" ? "bg-blue-600" : "bg-gray-400"}`} style={{ width: `${s.score}%` }} /></div><span className="font-mono text-right">{s.score}</span></div>)}
            <details className="mt-3 border-t border-gray-100 pt-3 text-xs">
              <summary className="cursor-pointer py-1 text-blue-700">Inspect source exclusions</summary>
              <ul className="mt-3 space-y-2">{research.scenarios.filter((s) => s.kind === "source").map((s) => <li key={s.id} className="flex justify-between gap-4 text-gray-600"><span>Without {sourceLabel(s.label)}</span><span className="font-mono text-gray-900">{s.score}</span></li>)}</ul>
              <p className="mt-3 leading-relaxed text-gray-500">The remaining corpus is re-baselined for each exclusion. Removing a source changes the population being described.</p>
            </details>
          </div>
        </section>
        <section aria-labelledby="coverage-title" className="grid gap-8 border-b border-gray-200 py-10 lg:grid-cols-2">
          <div>
            <p className={heading}>03 / The observed corpus</p>
            <h2 id="coverage-title" className="mt-3 text-2xl font-normal">A lens with visible limits.</h2>
            <p className="mt-4 text-sm leading-relaxed text-gray-600">{primary && <>{sourceLabel(primary.id)} accounts for {Math.round(primary.total / items.length * 100)}% of stored records. </>}The corpus favors English-language, developer-facing coverage. Publisher posts, community attention and technical progress are different things.</p>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">{research.eligibleStories} of {research.currentStories} records in the current window belong to eligible sources. Eligibility uses declared coverage dates; it is not proof of complete collection. Historical points use retrospectively collected data.</p>
            <a href={`${BASE_PATH}/feed`} className={`mt-5 inline-block text-sm ${link}`}>Inspect the underlying headlines →</a>
          </div>
          <div className="overflow-x-auto rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">
            <table className="w-full text-left text-xs"><caption className="mb-4 text-left text-[11px] uppercase tracking-wider text-gray-500">Source composition · full corpus and current window</caption><thead><tr className="border-b border-gray-200 text-gray-500"><th className="pb-3 font-normal">Source</th><th className="pb-3 text-right font-normal">All records</th><th className="pb-3 text-right font-normal">7 days</th></tr></thead><tbody>{sources.map((s) => <tr key={s.id} className="border-b border-gray-100 last:border-0"><th className="py-2.5 font-normal">{sourceLabel(s.id)}{!s.eligible && <span className="block text-[10px] text-gray-500">Excluded: short coverage</span>}</th><td className="py-2.5 text-right font-mono text-gray-600">{s.total.toLocaleString("en-US")}</td><td className="py-2.5 text-right font-mono text-gray-600">{s.current}</td></tr>)}</tbody></table>
          </div>
        </section>
        <section aria-labelledby="semantic-title" className="my-10 rounded-4xl bg-gradient-to-b from-sky-200/30 to-white p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-3"><p className={heading}>04 / Semantic annotations</p><span className="rounded-full border border-blue-200 px-2.5 py-1 text-[10px] uppercase tracking-wide text-blue-700">Model annotations · Not human-validated</span></div>
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <h2 id="semantic-title" className="max-w-md text-2xl font-normal">Beyond counting.<br />Testing semantic judgments.</h2>
            <div className="space-y-3 text-sm leading-relaxed text-gray-600"><p>Jev / System One annotates whether a headline concerns AI and whether it reports a concrete change. Each decision retains its probability distribution, model version and input fingerprint.</p><p>{research.semanticLayer.annotated.toLocaleString("en-US")} current corpus records have model annotations in this snapshot. {research.semanticLayer.flagged} carry provider-consistency flags. These annotations have zero index weight.</p><p>Headline judgments cannot establish real-world impact. Human annotation, held-out evaluation and calibration checks come before any proposal to change the index.</p><a href={`${BASE_PATH}/methodology#semantic-experiment`} className={`inline-block font-medium ${link}`}>Read the experimental protocol →</a></div>
          </div>
        </section>
        <section aria-labelledby="reproduce-title" className="grid gap-8 border-t border-gray-200 py-10 lg:grid-cols-2">
          <div><p className={heading}>05 / Reproduce & contribute</p><h2 id="reproduce-title" className="mt-3 text-2xl font-normal">A study you can inspect.</h2><p className="mt-4 text-sm leading-relaxed text-gray-600">Method v{research.methodVersion} · exploratory, not independently validated. Contributions can challenge source selection, audit relevance, propose a rubric or compare alternative specifications.</p><a href={`${REPO}/blob/main/CONTRIBUTING.md`} className={`mt-4 inline-block text-sm ${link}`}>Contribute to the research →</a></div>
          <div className="space-y-4 text-sm"><div className="flex flex-wrap gap-x-5 gap-y-3"><a className={link} href={`${BASE_PATH}/methodology`}>Methodology</a><a className={link} href={`${BASE_PATH}/research.json`}>Research snapshot ↗</a><a className={link} href={`${BASE_PATH}/fomo.json`}>Index JSON ↗</a><a className={link} href={`${BASE_PATH}/report.pdf`}>Observation report (PDF) ↗</a></div><div className="rounded-lg border border-gray-200 bg-white p-4"><p className="text-xs text-gray-500">Dataset SHA-256 · data/index.json</p><code className="mt-2 block break-all text-[11px] leading-relaxed text-gray-600">{dataHash.sha256}</code></div><p className="text-xs leading-relaxed text-gray-500">For citation, record the method version, observation date and repository commit. The snapshot includes fingerprints of data and implementation files. No DOI or peer-review status is claimed.</p></div>
        </section>
        </div>
      </details>
    </div>
  );
}
