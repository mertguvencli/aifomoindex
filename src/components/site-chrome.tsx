import { BASE_PATH, REPO } from "@/lib/site";

const navLink = "text-gray-600 transition-colors hover:text-gray-900";

/** The top bar shared by every page. */
export function SiteNav() {
  return (
    <nav className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 pb-2 pt-5 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <a href={`${BASE_PATH}/`} className="flex items-center gap-2 whitespace-nowrap font-serif text-xl leading-none text-gray-900 sm:text-2xl">
          AI FOMO Index
        </a>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-sm sm:gap-4">
        <a href={`${BASE_PATH}/about`} className={navLink}>
          About
        </a>
        <a href={`${BASE_PATH}/methodology`} className={navLink}>
          Methodology
        </a>
        <a href={`${REPO}/tree/main/data`} target="_blank" rel="noopener noreferrer" className={`hidden sm:inline ${navLink}`}>
          Dataset
        </a>
        <a
          href={REPO}
          aria-label="Research repository"
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center ${navLink}`}
        >
          <GitHubMark className="size-5" />
        </a>
      </div>
    </nav>
  );
}

/** The bottom line shared by every page. */
export function SiteFooter() {
  return (
    <footer className="border-t border-gray-100 py-8 text-center text-xs text-gray-500">
      <span className="font-serif text-base text-gray-900">AI FOMO Index</span> · code MIT · data CC BY 4.0 ·{" "}
      <a href={REPO} className="underline-offset-2 hover:underline" target="_blank" rel="noopener noreferrer">
        GitHub
      </a>
    </footer>
  );
}

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" aria-hidden className={className}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
    </svg>
  );
}
