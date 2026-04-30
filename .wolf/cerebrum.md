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
