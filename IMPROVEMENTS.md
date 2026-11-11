# Improvements and Roadmap

This doc collects the review of the 4 branches. Each branch was reviewed on its own, and each review covered code, security, and tests from different points of view: hacker, engineer, support, manager, product, end user, and SRE. All of it is grouped here into fixes and a roadmap.

Branches reviewed:

| Branch | Based on | Verdict at review | Tests at review | After fixes |
|---|---|---|---|---|
| `fix/csv-import-country-code` | main | Ship with fixes | BE 27/27, FE 21/21 pass | No fixes yet (no must-fix items) |
| `feature/new-lead-fields` | main | Ship with fixes | BE 43/43, FE 66/66 pass, tsc clean | M7, M8 fixed. BE 62, FE 67 pass |
| `fix/email-verification-hang` | main | Ship with fixes | BE 47/47, FE 27/27 pass | M1–M3 and S11 fixed. BE 66, FE 31 pass |
| `feature/enrich-phone` | `feature/new-lead-fields` | Ship with fixes | BE 215/215, FE 94/94 pass, tsc clean | M4–M6 fixed, new-lead-fields merged in. BE 259, FE 110 pass |

No branch is blocked. All 4 fix their task, but each has a few gaps to close before production.

### Status update

All 8 "fix before merge" items (M1–M8) are fixed, plus S11. The commits are:

| Commit | Branch | Fixes |
|---|---|---|
| `628ddd2` | `fix/email-verification-hang` | M1 workflow execution timeout, M2 id cap and checks, M3 loading state, S11 one workflow id per lead |
| `7998067` | `feature/enrich-phone` | M4 phone cleaning, M5 run timeout and "Timed out" state, M6 cooldown and rate limit |
| `f596abb` | `feature/new-lead-fields` | M7 phone check on import, M8 import warnings |
| `093ed36` | `feature/enrich-phone` | Merge of `feature/new-lead-fields` |
| `5baf975` | `feature/enrich-phone` | Phones longer than 15 digits after adding the country code (found while checking the merge) |

Everything in sections 2 and 3 is still open, apart from S11. Section 4 lists what was learned while fixing.

---

## How to read this

- **Severity:** how bad it is if the problem happens. Critical > High > Medium > Low.
- **Confidence:** how sure we are the problem is real.
  - **High** = reproduced by running it (curl, a test, a script) or plain from reading the code.
  - **Medium** = strong reading of the code, not run.
  - **Low** = a suspicion only.
- **Decision rule:**
  - **Fix before merge** = High severity + High confidence.
  - **Fix soon** = Medium severity, or High severity with Medium confidence.
  - **Nice to have** = Low severity.

No finding was rated Critical. Nothing loses data at scale or exposes secrets today, mostly because this is a single-user local app with no auth at all (see the roadmap).

---

## 1. Fix before merge

All 8 are fixed. The Status column shows the commit and how it was done.

| # | Branch | Severity | Confidence | Problem | Fix | Status |
|---|---|---|---|---|---|---|
| M1 | email-verification-hang | High | High 95% (reproduced: hung 90s+ with no worker) | The workflow has no `workflowExecutionTimeout`. If the worker is down or polls the wrong queue, the request still hangs forever. It is the same bug in a different case. | Add `workflowExecutionTimeout` (about 2 min) in `temporalEmailVerifier.ts:17-21`. | Fixed in `628ddd2`: 45s execution timeout. A test proves a run with no worker fails instead of hanging. |
| M2 | email-verification-hang | High | High 90% | No cap on `leadIds`. One request can hold about 20k ids. There is no rate limit. | Cap at 100 (same as enrich-phone). Remove duplicates and reject ids that are not integers with a 400. | Fixed in `628ddd2`: max 100 unique positive ids, otherwise 400 with a clear message. |
| M3 | email-verification-hang | High | High 90% | The UI still shows nothing while verification runs, for up to 60s. The user clicks again and starts duplicate runs. This was the original complaint ("no feedback"). | Disable the action, show a spinner, and show a `toast.loading` that updates when the run finishes (`LeadsList.tsx:39-56`). | Fixed in `628ddd2`: "Verifying N emails…" toast, then the result in the same toast. The item is disabled with a spinner. |
| M4 | enrich-phone | High | High 95% (reproduced) | The phone number from a provider is stored as is: bare digits, `"ES 4088282927"`, even HTML from a bad provider response. It also goes into message templates. | Normalise to E.164 with `libphonenumber-js` (use the lead's country as fallback). Treat an invalid number as "no data". | Fixed in `7998067` and `5baf975`: junk is rejected and the next provider is asked. E.164 when the country fits, otherwise digits (product choice: best effort, not strict). |
| M5 | enrich-phone | High | High 85% | No `workflowExecutionTimeout`. With no worker, the lead stays PENDING forever, is skipped as `already_running` forever, and the UI polls every 2s forever. | Add the timeout in `temporalWorkflowStarter.ts`. Treat PENDING older than N minutes as stale. | Fixed in `7998067`: 5 min run timeout. The UI shows "Timed out" after 6 min and stops polling. The next click restarts it. |
| M6 | enrich-phone | High | High 90% | No cooldown or rate limit. A lead in NO_DATA or FAILED can be re-enriched in a loop: up to 9 paid provider calls per lead, 900 per request. This burns money. | Add a `phoneEnrichedAt` column and skip leads tried in the last 24h. Add a rate limit per IP or user. | Fixed in `7998067`: `phoneEnrichmentRequestedAt` column, cooldown 24h after NO_DATA and 5 min after FAILED, 10 requests per minute per IP. |
| M7 | new-lead-fields | High | High 90% (curl) | The phone field has no validation and no length limit. A 20,000-char value or a formula is stored. enrich-phone then writes a third phone format next to it. | Max length about 32 and an allowed-character check. Use the same E.164 helper as M4. | Fixed in `f596abb`: optional `+`, digits, `( ) - .`, optional `x` extension, 7–15 digits, max 32 chars. Same rule in the CSV parser and the API. Stored as typed. |
| M8 | new-lead-fields | High | High 95% (curl) | The API sets bad optional values to null without telling anyone (years `-3`, `javascript:` LinkedIn). It still answers `errors: []`. | Return per-lead `warnings` (field + reason). | Fixed in `f596abb`: `POST /leads/bulk` returns `warnings` (index, email, field, message). |

## 2. Fix soon

| # | Branch | Severity | Confidence | Problem | Fix |
|---|---|---|---|---|---|
| S1 | csv-country-code | Medium | High 95% | The `Intl.DisplayNames` check accepts codes that are not countries: `ZZ`, `EU`, `UN`, `XA`, `UK`, `SU`. | Use a fixed list of the 249 ISO alpha-2 codes in one shared module. Map `UK` to `GB`. |
| S2 | csv-country-code | Medium | High 90% | Invalid countries are dropped with no warning. The import preview has no country column. | Add a Country column and a "will be left empty" warning to the preview. |
| S3 | csv-country-code | Medium | High 95% | `Spain`, `ESP` and full-width `ＥＳ` are dropped instead of converted. | Map alpha-3 codes and English names to alpha-2. Apply NFKC normalisation before the check. |
| S4 | new-lead-fields | Medium | High 90% | The frontend rejects the whole row for a bad optional field (for example years `3.0` from Excel), while the backend only nulls the field. The two disagree. | Treat bad optional fields as warnings on both sides. Accept `3.0`. |
| S5 | new-lead-fields | Medium | High 95% | Validators (LinkedIn, years) and types are copied in frontend and backend and already differ. | Use a shared package (zod schemas, TS types from them). |
| S6 | new-lead-fields | Medium | High 95% (test) | The field picker hard-codes `GROUPS`, so a new backend group is silently hidden. | Send group labels from the API, or show unknown groups under "Other". |
| S7 | new-lead-fields | Medium | High 90% | The new fields can't be edited after import. PATCH only handles name and email. | Add a validated PATCH for all lead fields. |
| S8 | email-verification-hang | Medium | High 85% | Still one synchronous request. 500 leads with a few slow ones goes past the 60s client timeout. | Return 202 + a job id, and have the client poll for status (see roadmap R3). |
| S9 | email-verification-hang | Medium | High 85% | The DB write happens in the API process, not in the workflow. If the API crashes, the results are lost. | Move the save into an activity. |
| S10 | email-verification-hang | Medium | High 80% | A timed-out activity keeps running (no cancellation or heartbeat). A real provider would be probed 3 times in parallel. | Pass the cancellation signal to the call. Add `heartbeatTimeout` and `scheduleToCloseTimeout`. |
| S11 | email-verification-hang | Medium | Medium 70% | The workflow id uses `Date.now()`, so there is no deduplication. Two clicks run twice and race on the write. | Use the id `verify-email-${id}` with `USE_EXISTING` (enrich-phone already does this). **Fixed in `628ddd2`.** |
| S12 | enrich-phone | Medium | High 95% (exit=1) | A missing provider env var kills the **whole API**, not just enrichment. The README is not updated. | Disable only the feature and log a warning. Document the `.env`. |
| S13 | enrich-phone | Medium | Medium 70% | Races: `markPending` can overwrite FOUND or RUNNING. `saveResult` can overwrite a phone the user typed during the run. | Use conditional updates (`updateMany where status in …`). Only write the phone if it is null. |
| S14 | all (reproduced on enrich-phone and email-verification-hang) | Medium | High 95% (reproduced twice) | Bad JSON returns Express's HTML page with a stack trace and server paths. | Add a global JSON error handler. Set `NODE_ENV=production`. |
| S15 | new-lead-fields + enrich-phone | Medium | Medium 70% | `backend/prisma/dev.db` is committed and changed by several branches. This gives binary merge conflicts, and the file holds sample PII. | Untrack it, add it to `.gitignore`, and add a seed script. |

## 3. Nice to have

| # | Branch | Confidence | Item |
|---|---|---|---|
| N1 | csv | High | Store `UK` as `GB`. Clean up existing rows (`''` to null). |
| N2 | csv | High | Edge-case tests (`ZZ`, names, alpha-3, unicode) and one endpoint test. |
| N3 | new-lead-fields | High | Reject LinkedIn URLs with a username or password part (`https://evil.com@linkedin.com/...`). |
| N4 | new-lead-fields | High | The `yearsInRole` header is mapped to "years at company". Check this with product. Add more header aliases. |
| N5 | new-lead-fields | Medium | The table has 10 columns and scrolls sideways. Add a column chooser and a `tel:` link. |
| N6 | new-lead-fields | Medium | Warn "X of N leads are missing {field}" before generating messages. |
| N7 | email-verification | Medium | "Verified 5 emails" also counts invalid ones. Say "Checked 5: 3 valid, 2 invalid". Add a "Retry failed" action. |
| N8 | email-verification | High | Log the workflow id and return a reference id in errors so support can trace a failure. |
| N9 | email-verification | High | The real 20s sleep in a test makes the suite take 40s and can be flaky. Use a stub that never resolves. |
| N10 | email-verification | Medium | `mapWithConcurrency` leaves the other workers running when one throws. Document this or use `allSettled`. |
| N11 | enrich-phone | High | Provider error bodies (may contain emails) go into worker logs. Log the status code and a short or redacted body. |
| N12 | enrich-phone | High | The Nimbus key is in the URL query, which the provider requires. Never log URLs. Add a test for this. |
| N13 | enrich-phone | Medium | NO_DATA hides a provider outage. Store results per provider attempt and show an "incomplete" state. |
| N14 | enrich-phone | High | No `patched()` versioning. Changing the provider order breaks runs in flight. |
| N15 | enrich-phone | Medium | Polls the full lead list every 2s. Poll only busy ids and back off over time. |
| N16 | enrich-phone | Medium | Missing tests: the HTTP route, provider-timeout fallthrough, races, stuck PENDING. |
| N17 | enrich-phone | – | The ports/adapters design is heavy (about 60 files) but readable and well tested. Keep it, and make it the pattern for new features (see R6). |

---

## 4. Found while fixing

These came up while making the M1–M8 fixes. Most of them add detail to existing roadmap items.

| # | Confidence | Finding | Where it goes |
|---|---|---|---|
| F1 | High (seen in data) | Phone formats are mixed: imported phones are stored as typed (`(760)551-9973x6454`), while enriched phones are E.164 or bare digits. The column has no single format. | R14 |
| F2 | High (seen in data) | Providers return bare 10-digit numbers with no country, and leads are spread over 24 countries. Strict E.164 would turn most results into NO_DATA, so we chose best effort. Asking providers for a country, or an "unverified" flag, would allow strict mode later. | R14, product decision |
| F3 | High | After a timeout the DB still says PENDING or RUNNING. Only the UI treats it as "Timed out". Support tools and reports will still see "running". | R9 sweeper |
| F4 | High | The new rate limit is in memory and keyed by IP. It resets on restart and does not work across several API processes. | R11 |
| F5 | High | The cooldown times (24h after NO_DATA, 5 min after FAILED) are guesses. They need a product decision and should be configurable. | R11 |
| F6 | High | More rules copied between frontend and backend: the phone rule, the 100-id cap for verify and for enrich, status and skip-reason types. | R2 |
| F7 | High | `parseVerifyEmailsRequest` and `parseEnrichPhoneRequest` are almost the same code. | R1, one shared id-list parser |
| F8 | High | Temporal's time-skipping test server does not skip time when no worker is running, so "no worker" tests wait in real time. Make timeouts injectable, as the fixes do. | R7 testing practice |
| F9 | High | Switching branches needs `pnpm install` and `prisma generate`, or the type check fails on a stale Prisma client. pnpm also warns about build scripts it ignored (`pnpm approve-builds`). | R4 |
| F10 | High | `dev.db` changed on almost every branch and had to be reset by hand before commits. This confirms S15. | S15 |

---

## 5. Merging the branches

`feature/new-lead-fields` is already merged into `feature/enrich-phone` (`093ed36`). Merging that conflict was checked: no hidden logic conflicts, and every phone enrichment stores passes the import phone rule.

Recommended order into `main`:

1. `feature/enrich-phone`, which now includes new-lead-fields.
2. `fix/csv-import-country-code`.
3. `fix/email-verification-hang`.

Conflicts still to resolve (checked with `git merge-tree` on the current branch heads):

- **`fix/csv-import-country-code` vs `feature/enrich-phone`:**
  - `backend/src/index.ts`: both change `POST /leads/bulk`. Keep `parseImportedLead` and the warnings, and add the country-code check to it.
  - `frontend/src/utils/csvParser.ts`: both change the row parsing. Keep both checks.
- **`fix/email-verification-hang` vs `feature/enrich-phone`:**
  - `backend/package.json` and `pnpm-lock.yaml`: different test scripts and dependencies. Regenerate the lock file.
  - `backend/src/index.ts`: two different shared Temporal clients. Keep enrich-phone's `getTemporalClient()`, which resets on failure, and use the `TASK_QUEUE` constant instead of the `'myQueue'` string.
  - `frontend/src/api/modules/leads.ts`: both add endpoints next to each other. Easy.
  - `frontend/src/components/LeadsList.tsx`: enrich-phone rewrote this file. Reapply the verify loading state (M3) by hand.

Duplicates that won't show up as conflicts:

- Two `installTemporalTestRuntime` helpers. Keep enrich-phone's version.
- Two ports/adapters folder styles (`services/leadVerification` and `enrichment/phone`). Pick one.
- Two id-list parsers with the same 100 cap (F7).

---

## 6. Roadmap: codebase and architecture

The same issues came up in all 4 reviews. Ordered by value and risk.

### Phase 1: Foundations (next 1-2 sprints)

**R1. Request validation everywhere.** All 4 reviews raised this (High confidence).
There is no schema layer today. `POST /leads` reads `name` instead of `firstName`. `PATCH` writes `"undefined"` and does not check emails. `Number("abc")` turns into a 500. `jobTitle: 123` crashes and returns the error text.
Use zod schemas for every route, return 400 with field errors, and use one error-response shape.

**R2. Shared contract between frontend and backend.** All 4 reviews.
Country codes, LinkedIn and years validators, the 100-id limit, status enums and API types are all copied by hand and already differ.
Use a `shared/` workspace package with zod schemas, and get TS types from them (or generate them from OpenAPI).

**R3. Error handling and logging.**
- Add a global JSON error handler. No HTML stack traces.
- Use structured logs that carry a request id and the workflow id.
- Show a reference id in UI errors so support can trace a problem.

**R4. Repo hygiene.**
- Untrack `dev.db` and add a seed script.
- Add `tsc` and the tests to CI. A frontend type error already on main (`useApiMutation.ts:64`) went unnoticed.
- Raise the 100 KB body limit or upload imports in chunks. About 1000 or more CSV rows currently fail with 413.

**R5. Split `index.ts`.**
Everything is in one file today. Split it into routers, services and validation, and add route tests with supertest and a temp SQLite DB. Today only the utils are tested.

### Phase 2: Temporal and background jobs (1-2 sprints)

**R6. One pattern for bulk async jobs.** This is the biggest architecture change. Verify-email and enrich-phone each solve the same problem in a different way.
- The API starts a workflow and returns `202 { jobId }` right away.
- The DB write happens inside activities, not in the API process.
- Each lead has a status column (PENDING / RUNNING / DONE / FAILED) with a timestamp.
- The client polls a small status endpoint for only the busy ids, or uses SSE. No more full-list polling.
- The UI gets one shared component for bulk actions: pending state, progress, "retry failed".

**R7. Temporal defaults, written down once.**
- Always set `workflowExecutionTimeout` and `scheduleToCloseTimeout`.
- Use heartbeats and cancellation for long activities.
- Use a fixed workflow id per entity with `USE_EXISTING`.
- Use one `TASK_QUEUE` constant.
- Read the Temporal address and queue from env (both are hardcoded today).
- Use `patched()` for workflow changes, and run replay tests in CI.

**R8. Run the worker as its own process.**
Today a worker crash, or a missing provider key, calls `process.exit(1)` on the whole API. Split the worker into its own process. Add health and readiness endpoints for the DB and Temporal, and return a fast 503 "service unavailable" instead of hanging.

**R9. A stuck-job sweeper.**
Add a scheduled check of DB status against Temporal. It marks old PENDING/RUNNING rows as FAILED, which gives support a way to fix them.

### Phase 3: Security and multi-user (before any real users)

**R10. Auth and access.**
There is no auth, CORS is `*`, and phone and email PII are open to anyone who can reach the API.
- Add login and per-user or per-team data scoping.
- Restrict CORS.
- Add an audit log for PII changes.
- Write a retention policy.

**R11. Rate limits and cost control.**
- Add a rate limit per user on all bulk endpoints (verify, enrich, delete, generate-messages, import).
- Cap the number of ids on all of them.
- Add a cooldown per lead for paid enrichment.
- Add a provider-cost dashboard and a budget alert.

**R12. Export safety.**
Formula strings (`=HYPERLINK(...)`) are stored as is. Before any CSV export ships, escape values that start with `= + - @`.

### Phase 4: Data model and product (ongoing)

**R13. One lead-field registry.**
CSV header aliases, table columns, validation and template fields are 4 separate lists today. Turn the template-field registry into the single source for all 4.

**R14. Phone and enrichment data model.**
- Store the phone as E.164 plus a raw value, with source, a `verified` flag and `enrichedAt`.
- Keep an audit table of each provider attempt (provider, result, latency, cost).
- Use the same model for any field that gets enriched later.

**R15. Data quality.**
- Use real enums instead of SQLite strings.
- Dedupe import by email, not first and last name.
- Import with `createMany` in a transaction, not N single inserts.
- Clean up existing data (`''` to null, `UK` to `GB`).

**R16. Leads table UX.**
- Pagination and sorting.
- Inline edit of fields.
- A column chooser.
- A full-column import preview with per-field warnings and a downloadable error report.
- Support encodings other than UTF-8.

---

## 7. Short version for decisions

- **Must do now:** M1–M8 are fixed. Next is merging the branches (section 5), because each remaining merge has conflicts to resolve by hand.
- **Next:** S1–S15, except S11, which is fixed. Silent data loss in imports, copied validators, races, and the error handler. S14 (HTML stack traces) and S12 (missing provider key stops the API) are the quickest wins.
- **Biggest structural win:** R6 + R7 + R8, one async-job pattern for Temporal features with the worker in its own process. This removes a whole class of "hangs forever" bugs.
- **Required before real users:** R10 + R11, auth and rate limits.
