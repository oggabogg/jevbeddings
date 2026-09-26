# Publication record

This repository was prepared on 2026-09-26 from the complete, hash-verified
research archive published with the Norwegian study. It contains the original
public BANKING77 dataset, saved model answers, call metadata, source code and
per-query results as normal Git files. No Git LFS setup or API key is required.

The ZIP in `study/results/banking77-reproduction.zip` preserves the website's
published snapshot, including its original README and inventory. Repository
onboarding, ignore rules, this publication note and the CI workflow were added
for GitHub. The repository's `evidence-manifest.json` is a new post-study inventory;
it does not move the historical freeze dates or alter the frozen scientific code.

## Checks before upload

- Verified every file against the published archive's SHA-256 inventory.
- Compared all extracted bytes, including SQLite, against configured local secret
  values without printing them; found no matches.
- Searched for common credential formats (private keys, GitHub tokens, AWS keys,
  Slack tokens, OpenAI-style keys and JWTs); found no matches.
- Reviewed credential-related code locations: environment-variable reads and
  explicitly synthetic test values, not stored credentials.
- Reviewed SQLite table schemas: research data, typed answers and metadata;
  no credential or HTTP-header storage.
- Included only the named research material. Local `.env`, demo databases,
  website checkout, runtime packages, browser data, replay copies, temporary
  files and SQLite WAL/SHM sidecars were excluded.

These checks reduce accidental-disclosure risk; they are not a claim that an
arbitrary secret can always be detected. `.env.example` contains an empty key.
The provider-usage screenshot is the project-filtered image supplied for public
study documentation. It does not contain an API key.

## Reproduction

Run `node study/verify-evidence.js`, `node --test`, then `node study/reproduce.js`.
The GitHub Actions workflow repeats these checks with Node 24 and no model
credentials. Full replay compares all non-timing result fields and seven derived
files byte for byte, and separately audits the rankings. It does not rerun the
provider or independently authenticate the origin of historical API responses.

The BANKING77 license and attribution are preserved. No new license for the
project's own code has been selected by this publication.
