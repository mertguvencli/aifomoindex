import { BASE_PATH } from "@/lib/site";

/** Compact entry point retained for consumers of the previous FAQ component. */
export const ABOUT_ID = "about";
export function AboutFaq() {
  return <section id={ABOUT_ID} className="mx-auto max-w-3xl px-4 py-8 text-sm leading-relaxed text-stone-600">
    <h2 className="font-serif text-2xl text-stone-900">About the research</h2>
    <p className="mt-3">An exploratory study of activity in selected AI-news sources. It does not measure technological progress or human anxiety.</p>
    <a className="mt-3 inline-block underline underline-offset-4" href={`${BASE_PATH}/about`}>Research brief, limitations and contribution agenda →</a>
  </section>;
}
