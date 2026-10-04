# Security policy

AI FOMO Index is a static site built from a public dataset. It has no user
accounts or server, and it stores no personal data. Security issues are still
possible: in the crawler (`pipeline/`), the GitHub Actions workflows, the build
scripts, or content in the dataset that the site renders.

## Reporting a vulnerability

Please report it privately through GitHub's
[private vulnerability reporting](https://github.com/mertguvencli/aifomoindex/security/advisories/new)
rather than in a public issue. If you cannot use it, email
[aifomoindex@mert.im](mailto:aifomoindex@mert.im). Include the affected file or URL, steps to
reproduce, and the impact you expect.

You can expect an acknowledgement within a week. Fixes are released on `main`;
there are no maintained older versions.

## Out of scope

- Findings that only affect the `npm run dev` server on your own machine.
- Advisories in development-only dependencies (ESLint and its tooling) that
  never run in the published site or the scheduled workflows.
- Data quality problems such as wrong titles, duplicates or misclassified
  stories. Please open a regular issue for those.
