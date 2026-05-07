# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Do not edit manually unless correcting an error.
> Last updated: 2026-04-18

## User Preferences

- **Interaction style:** Ruthless mentor - challenge assumptions, stress test ideas, ask for clarification on vague requirements
- **Code quality:** No half-baked solutions - every recommendation should be thorough and ready to act on

## Key Learnings

- **Project:** hopeemr
- **Description:** HopeEMR - Electronic Medical Records for Low-Resource Healthcare Settings

### FHIR Code Systems
| Use Case | System | URL |
|----------|--------|-----|
| Labs/Vitals | LOINC | `http://loinc.org` |
| Clinical concepts | SNOMED CT | `http://snomed.info/sct` |
| Medications | RxNorm | `http://www.nlm.nih.gov/research/umls/rxnorm` |
| Diagnoses | ICD-10 | `http://hl7.org/fhir/sid/icd-10` |
| Units | UCUM | `http://unitsofmeasure.org` |

### Common LOINC Codes
- Heart rate: `8867-4`
- Blood pressure panel: `85354-9` (systolic: `8480-6`, diastolic: `8462-4`)
- Temperature: `8310-5`
- Respiratory rate: `9279-1`
- Oxygen saturation: `59408-5`
- Glucose: `2345-7`
- Hemoglobin: `718-7`

### Medplum Patterns
- Use `createReference()` from `@medplum/core` for typed references
- Use `MockClient` from `@medplum/mock` for testing
- GraphQL via `medplum.graphql(query, variables)` for complex queries
- Batch operations via `medplum.executeBatch(bundle)` for transactions
- Subscriptions via `medplum.subscribeToCriteria()` for real-time updates

### Translation Files
- English: `src/i18n/en.json`
- Spanish: `src/i18n/es.json`
- Always use `t('key', 'Fallback')` pattern with fallback values

### Reference EMRs for Feature Research
- **OpenMRS** - Forms, terminology, multi-site (github.com/openmrs)
- **Bahmni** - Clinical workflows, queue management, lab integration (github.com/Bahmni)
- **HospitalRun** - Offline-first, modern React UI (github.com/HospitalRun)
- **GNU Health** - Bed management, pharmacy, surgery (github.com/gnuhealth)
- **OpenEMR** - Billing, e-prescribing, patient portal (github.com/openemr)

### Custom Skills (Auto-Triggered)
Skills in `.claude/skills/` are invoked automatically:
- `fhir-architect` - When planning new features
- `healthcare-validator` - Before completing FHIR features
- `i18n-validator` - Before completing UI features
- `security-validator` - Before completing features with PHI
- `ux-design` - Before completing UI features
- `testing-validator` - Before completing any feature

### Docker/Production Deployment
- **Never run Vite dev server in production** - use `Dockerfile.production` which builds static assets and serves via nginx
- **Memory limits required** - `docker-compose-emr-https.yml` has limits tuned for 2GB instance
- **Node.js heap limit** - Medplum server uses `--max-old-space-size=512` to cap memory
- **Log rotation** - All containers have `logging.options.max-size` set; also configure Docker daemon via `scripts/setup-server.sh`
- **Swap required** - 2GB swap via `scripts/setup-server.sh` prevents OOM hangs on low-memory instances

## Do-Not-Repeat

<!-- Mistakes made and corrected. Each entry prevents the same mistake recurring. -->
<!-- Format: [YYYY-MM-DD] Description of what went wrong and what to do instead. -->

[2026-04-30] **Running Vite dev server in production** - Caused VM hangs after a few days due to memory leaks and unbounded resource usage. Always use `Dockerfile.production` which serves pre-built static files via nginx.

[2026-05-06] **`handleError` actual signature is `(error, context?: string)`** — not `(error, { category, showNotification })` as some prior docs claimed. `ErrorCategory` does not exist; only `ErrorType` (used internally). Don't import `ErrorCategory`.

[2026-05-06] **FHIR v2-0116 `OperationalStatus` codes** (used by FHIR R4 `Location.operationalStatus`): C=Closed, H=Housekeeping, I=Isolated, K=Contaminated, O=Occupied, U=Unoccupied. HopeEMR previously mapped K for housekeeping and I for contaminated (wrong). RESOLVED 2026-05-06: mappings corrected; HopeEMR-only `'reserved'` status preserved via `BED_STATUS_EXTENSION_URL` extension (`http://example.org/fhir/StructureDefinition/bed-status`, valueCode = BedStatus literal); new reads use `getBedStatusFromLocation(location)` which prefers the extension and falls back to the legacy code mapping for unmigrated beds; `scripts/migrate-bed-operational-status.mjs` performs the data migration (idempotent, --dry-run supported, run via `npm run migrate:beds[:dry]`).

[2026-05-06] **AI-slop detection signals**: docs/ files matching `*_COMPLETE.md`, `*_FINAL_*.md`, `*_STATUS.md`, `*_EXECUTIVE_SUMMARY.md`, `SESSION_SUMMARY.md`, `FINAL_COMPLETION_REPORT.md` are nearly always celebration/status reports from prior agent sessions. Don't generate new ones — the codebase is the source of truth. Reference docs (architecture, deployment, setup, feature specs) are valuable; status snapshots rot the moment they're written.

[2026-05-06] **IndexedDB `keyPath` does NOT support array bracket notation** like `'foo.bar[0].baz'`. Per the IDB spec, `keyPath` is a property name, a dotted property path of plain identifiers, or an array of those — nothing else. `createIndex(name, 'resource.context.encounter[0].reference')` throws `SyntaxError: Failed to execute 'createIndex' on 'IDBObjectStore': The keyPath argument contains an invalid key path` and aborts the entire `versionchange` transaction, leaving the DB un-upgraded. To index a value buried inside an array, store a denormalized scalar alongside the resource (e.g. `_encounterRef = resource.context?.encounter?.[0]?.reference` set at write time in `cacheDocumentReference`) and index that field. The `documentReferences.by-encounter` index was deleted on 2026-05-06 because nothing actually queried it; if it's ever needed, denormalize, don't reach into the array.

[2026-05-06] **IndexedDB schema upgrades use a migration ladder, not "create-if-not-exists" guards.** `src/offline/db/schema.ts` `upgrade(db, oldVersion)` uses `if (oldVersion < N)` blocks. Each schema change bumps `DB_VERSION` and **appends a new `if (oldVersion < N)` block** — never mutate an earlier block, because existing users have already run it. The browser only calls `upgrade` when `DB_VERSION` is greater than the user's current version, so each block runs at most once per user.

[2026-05-06] **ErrorBoundary and ConfigError use a `safeT()` helper, not `useTranslation()`.** Both can render when i18n itself failed to initialize (ErrorBoundary catches errors from anywhere in the tree; ConfigError shows when env config is broken at boot). `useTranslation()` is a hook and can only be used in functional components, and `t()` may throw if i18next is uninitialized. The pattern: import the i18next default export, then `function safeT(key, fallback)` that checks `i18n.isInitialized && typeof i18n.t === 'function'` inside a try/catch and returns the English fallback on any failure. Do NOT add `useTranslation()` to ErrorBoundary — it's a class component AND it must work when react-i18next is broken.

[2026-05-06] **CSP is set as an HTTP header in nginx, NOT via `<meta http-equiv>`.** Two reasons: (1) `frame-ancestors`, `report-uri`, `sandbox`, and `frame-options` are silently ignored when delivered via `<meta>` (per CSP spec) — they only work as headers. (2) A meta-tag CSP is the same in dev and production, but Vite's dev server injects an inline HMR runtime that requires `'unsafe-inline'` for scripts. Production CSP lives in `nginx/conf.d/emr-app.conf` and `nginx-secure.conf`. Dev mode has no CSP and that is intentional. If a future direct-access build needs CSP without nginx, add it via `vite.config.ts` `server.headers` / `preview.headers` rather than a meta tag.

## Decision Log

### [2025-12] Security Implementations
- HTTPS enforcement in production (`src/main.tsx`)
- Session timeout: 30min idle, 8hr absolute (`src/EMRApp.tsx`)
- CSP implemented in `index.html`
- Error boundary wraps entire app
- No `dangerouslySetInnerHTML` - use `ConfigError.tsx` component instead

### [2025-12] Components Needing Refactoring (>300 lines)
| Component | Lines | Priority |
|-----------|-------|----------|
| ProviderCalendarPage.tsx | 519 | High |
| MedicationCatalogPage.tsx | 492 | High |
| BookAppointmentPage.tsx | 442 | High |
| RecordVitalsModal.tsx | 441 | Medium |
| BedsPage.tsx | 423 | Medium |
| Header.tsx | 391 | Low |

### [2026-04] Skills Migration
- Migrated `.claude/agents/` (manual workflow docs) to `.claude/skills/` (auto-triggered superpowers skills)
- Old agents were documentation only, not actual Claude Code agents
- New skills integrate with superpowers workflow and auto-trigger via CLAUDE.md instructions
