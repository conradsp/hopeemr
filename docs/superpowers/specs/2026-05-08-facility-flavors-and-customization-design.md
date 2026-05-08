# HopeEMR Facility Flavors & Customization — Design Spec

**Date:** 2026-05-08
**Status:** Approved (pending written-spec review)
**Scope:** Architectural foundation only. Universal core feature work (facesheet, visit dashboard, prescription dichotomy, lab capture, pharmacy lot/cost tracking, regulatory form content, reporting) is out of scope for this spec and lives in separate specs that progress concurrently.

---

## 1. Context

HopeEMR will go live in Honduras across multiple facilities. Site research identified five concrete deployments:

- **Outpatient clinics** (4): Tamanu, Sal y Luz, Clinica Bautista, Luz y Vida.
- **Hospital** (1): Hospital Yojoa — much larger, includes inpatient services.

All facilities operate at free or reasonable rates. Network connectivity at the smaller clinics is variable; some facilities raised concern about depending on hosted services. Some facilities operate full free-care days; others mark individual visits as no-charge.

The product question this spec answers: how does HopeEMR support meaningfully different facility shapes (small clinic vs. hospital) and meaningful per-facility customization while remaining a single codebase shipped from a single deployment.

**The originating ask conflated four customization axes** that must be designed separately:

1. Operator-controlled tier/packaging ("flavor").
2. Facility admin-controlled per-facility configuration.
3. End-user personalization.
4. Branding (logo, name) — already exists.

This spec treats them separately and assigns each its own governance, storage, and override semantics.

## 2. Strategic shape

Two strategic decisions frame the rest of the design.

**2.1 Tenancy: centrally-hosted, one Medplum Project per facility.**

Rejected alternatives:
- *Per-facility deployments* — multiplies operational burden (upgrades, backups, monitoring, patches), causes version drift, eliminates economies of scale.
- *Schema-per-tenant in shared Postgres* — reaches past Medplum's tenant abstraction (Project), gives up framework guarantees, doesn't actually buy isolation, makes migrations and backups worse.
- *Self-hosting at small clinics* — the network-connectivity concern is solved by HopeEMR's existing offline-first layer, not by self-hosting. Self-hosting at small clinics introduces patching/backup/recovery problems that are worse than the connectivity concern it would solve.

Reserved alternatives:
- *On-prem edge proxy/cache* — for facilities with chronic uplink issues, deploy a small box running nginx + a Medplum read cache + sync daemon. Simpler to operate than a full self-host. Not in this spec; available as an escape hatch later.
- *Self-host* — reserved for a hypothetical future hospital with full IT staff and a regulatory mandate. Treat as a contracted exception, not a default.

**2.2 Sequencing: Option B — thin foundation + concurrent universal-core feature work.**

The foundation alone delivers no clinician-visible value. Most site-visit feedback (facesheet, visit dashboard, prescription dichotomy, lab capture, pharmacy lot/cost) is universal need, not flavoring need. The foundation must be designed thinly, so it serves the actual variation we know about (Clinic vs. eventually-Hospital, Honduras profile, free-clinic operations) without becoming an end in itself.

**Yojoa is phase 2.** The Hospital flavor and inpatient modules are not built in phase 1. Hospital flavor will extend (not replace) the Clinic flavor — hospitals run outpatient encounters too, and the foundation must preserve this composition.

## 3. Module taxonomy (Clinic flavor, phase 1)

### 3.1 Universal Core — always on

Cannot be toggled at the facility level. Ships to every Clinic-flavor facility.

- Patient registration & demographics
- Encounters & charting
- Vitals (ad-hoc recording)
- Clinical notes
- Diagnoses (ICD-10 baseline, with facility-curated catalog and free-text fallback)
- Pharmacy: catalog, internal/external Rx, inventory drawdown, lot/cost tracking
- Lab orders & results capture
- Scheduling
- Queue / Triage / Check-in
- Facesheet & Visit Dashboard
- Branding (logo, name)
- Catalogs: note templates, lab tests, medications, diagnoses, appointment types, diagnostic providers
- Billing infrastructure (every facility has it; usage is governed by per-encounter charge status and Free Clinic Mode — see §6)

### 3.2 Facility-Toggle modules — on by default, facility admin can disable

- **Imaging** (`module.imaging`) — imaging admin pages, order-imaging button on encounters, imaging tab/section on patient view.
- **Departments / Beds** (`module.departments`) — department and bed admin pages and any related selection UI.

Two toggles. No more in phase 1.

### 3.3 Phase-2 modules (not in Clinic flavor at all)

Not exposed by the Clinic flavor's availability ceiling. Built when the Hospital flavor is built for Yojoa:

- Inpatient encounter type, admission ordersets (ABCVANDISMAL pattern)
- MAR (Medication Administration Record) with scheduled / prn / discreet sigs
- Nursing tasks and charting (nurse-targeted orders)
- Bed census, ward transfers, discharge planning
- Vitals frequency orders (q-shift, q4h, notify-physician parameters)
- Activity / diet / IV-fluid / precaution / consult orders

### 3.4 Diagnoses customization

Diagnoses stays in Universal Core but the catalog is explicitly customizable:

- Country profile (Honduras) seeds an ICD-10 baseline at provisioning.
- Facility admin can curate, augment, hide, or relabel via the existing `DiagnosisConfigPage`.
- **Free-text "uncoded" diagnosis is always allowed** at the encounter level, captured as a `Condition` with `code.text` set and no `coding` array.
- Optional future: facility-specific local code systems modeled as `CodeSystem` resources, with mapping to ICD-10 only when needed for regulatory roll-up. Not in phase 1.

## 4. Four-layer configuration model

```
Country Profile     (data, in master Project, synced into facility Projects)
        ↓
Flavor              (code: src/config/flavors/*.ts)
        ↓
Facility Config     (data, on per-Project emr-settings Organization)
        ↓
User Preferences    (deferred — not in phase 1)
```

Each layer can override the layer above it, but only within what the layer above allows. Override resolution runs once per session at app boot, cached in React context, re-runs on `emr-config-changed` event.

### 4.1 Country profile (Layer 1) — data, not code

Stored as FHIR resources in each facility's Project, sourced from a canonical master Project. See §5 for the master + sync model.

Artifact set:

| Artifact | FHIR resource |
|---|---|
| Profile metadata (country code, locale, currency, identifier rules) | `Basic` resource with `meta.profile = http://hopeemr.org/fhir/StructureDefinition/country-profile` |
| Profile manifest | `Library` resource with `url = http://hopeemr.org/fhir/profiles/country/HN`, version-stamped, referencing all artifacts in the country profile |
| Required forms (e.g., Honduran pregnancy form) | `Questionnaire` resources |
| Required reports (e.g., monthly diagnosis report) | `Measure` resources (with `MeasureReport` instances generated at run time) |
| Code systems (ICD-10 baseline, country-specific code systems) | `CodeSystem` and `ValueSet` resources |

The actual content of these artifacts (the pregnancy form fields, the monthly diagnosis report definition) is **out of scope for this spec** — that's regulatory authoring work that produces content for the foundation to load. The foundation must load and apply whatever the master Project contains.

### 4.2 Flavor (Layer 2) — code

Lives in `src/config/flavors/`. TypeScript objects, version-controlled.

```typescript
// src/config/flavors/types.ts
export type FlavorId = 'clinic' | 'hospital';
export type ModuleId =
  | 'imaging'
  | 'departments'
  // Phase-2 (not in Clinic ceiling):
  | 'inpatient'
  | 'mar'
  | 'admission-ordersets'
  | 'nursing-tasks'
  | 'bed-census'
  | 'vitals-frequency-orders';

export interface ModuleSettings {
  // Per-module setting bags, typed per module
  // Empty in phase 1; populated when modules grow feature-level depth
}

export interface CatalogSeeds {
  noteTemplates?: string[];        // identifiers of seed templates to apply
  labTestPanels?: string[];
  medicationFormulary?: string[];
  diagnosisCatalog?: string[];
  // Applied once at provisioning, not enforced at runtime
}

export interface Flavor {
  id: FlavorId;
  name: string;
  /** Module availability ceiling — what modules CAN be enabled at the facility */
  availableModules: ModuleId[];
  /** Which available modules ship enabled by default at provisioning */
  defaultEnabledModules: ModuleId[];
  /** Per-module feature defaults */
  defaultModuleSettings: Partial<Record<ModuleId, ModuleSettings>>;
  /** Catalog seeds applied at provisioning */
  catalogSeeds: CatalogSeeds;
}
```

```typescript
// src/config/flavors/clinic.ts
export const clinicFlavor: Flavor = {
  id: 'clinic',
  name: 'Outpatient Clinic',
  availableModules: ['imaging', 'departments'],
  defaultEnabledModules: ['imaging', 'departments'],
  defaultModuleSettings: {},
  catalogSeeds: { /* Clinic-appropriate seeds */ },
};
```

A facility's flavor assignment is data — `valueCode: 'clinic'` on their `emr-settings` `Organization`. The flavor object itself is code.

### 4.3 Facility Config (Layer 3) — data on `emr-settings` Organization

Extends the existing per-Project singleton `Organization` (identifier `emr-settings`) that already carries workflow configuration. New extensions:

```
http://hopeemr.org/fhir/country
  valueCode: 'HN'

http://hopeemr.org/fhir/flavor
  valueCode: 'clinic' | 'hospital'

http://hopeemr.org/fhir/module-enabled
  valueCode: ModuleId
  (repeated; absence of the extension means the module is disabled)

http://hopeemr.org/fhir/module-setting
  Complex extension:
    - extension[0]: { url: 'moduleId', valueCode: ModuleId }
    - extension[1]: { url: 'key',      valueString: string }
    - extension[2]: { url: 'value',    valueString | valueBoolean | valueInteger | valueCode }

http://hopeemr.org/fhir/free-clinic-mode
  valueBoolean
```

The facility admin can write `module-enabled`, `module-setting`, `free-clinic-mode`, and existing workflow extensions. They **cannot write** `country` or `flavor` — those are operator-only (enforced by AccessPolicy, see §5.3).

### 4.4 User Preferences (Layer 4) — deferred

Not built in phase 1. When added, will live on `Practitioner.extension` or a `UserConfiguration` resource scoped to the same Project. Layer accommodates it; nothing implements it yet.

### 4.5 Resolver

```typescript
// src/config/resolveConfig.ts
export interface ResolvedConfig {
  country: CountryCode;
  flavor: FlavorId;
  modules: Record<ModuleId, { enabled: boolean; settings: ModuleSettings }>;
  freeClinicMode: boolean;
  workflowConfig: WorkflowConfiguration;  // existing
  countryProfile: ResolvedCountryProfile; // resolved from Library + referenced artifacts
}

export function resolveConfig(
  countryProfile: CountryProfile,        // Layer 1 (loaded from facility Project's Library)
  flavor: Flavor,                        // Layer 2 (looked up by id from code)
  facilitySettings: FacilityConfigData | null,  // Layer 3 (null if emr-settings Organization is missing)
): ResolvedConfig {
  // 1. Start with country profile baseline (locale, required artifacts).
  // 2. Determine the enabled-modules set with three-state semantics:
  //    a. If facilitySettings is null OR contains zero `module-enabled` extensions,
  //       use flavor.defaultEnabledModules verbatim. Treated as "facility config absent —
  //       fall back to flavor defaults."
  //    b. If facilitySettings contains one or more `module-enabled` extensions, those are
  //       authoritative. The set of enabled modules equals the set of module-enabled
  //       extensions, intersected with flavor.availableModules. A module-enabled extension
  //       referencing a module outside availableModules is ignored (and logged) — it is
  //       not honored. A module not present in any module-enabled extension is disabled.
  // 3. Apply per-module settings from facilitySettings.module-setting extensions:
  //    only applied if the module is in flavor.availableModules.
  // 4. Validate: country profile required artifacts are present; if not, log error but
  //    do not block (resolver returns a usable config and lets calling code decide).
  // 5. Return ResolvedConfig.
}
```

**Three-state semantics for module enablement, made explicit:**

| State | Resolved enabled set |
|---|---|
| `emr-settings` Organization missing entirely | `flavor.defaultEnabledModules` |
| `emr-settings` Organization exists but has no `module-enabled` extensions | `flavor.defaultEnabledModules` |
| `emr-settings` Organization has at least one `module-enabled` extension | the set of `module-enabled` extensions ∩ `flavor.availableModules` |

The third state means a facility admin who explicitly disables every module results in zero enabled modules — that is the admin's choice, not a fallback.

The provisioning script (`scripts/provision-facility.ts`) **always seeds the `module-enabled` extensions with `flavor.defaultEnabledModules`** when creating the `emr-settings` Organization, so a freshly-provisioned facility starts in the third state with the expected modules. The "no extensions" fallback exists for dev/test scenarios where the Organization gets created without going through the provisioning script.

**Default-safe semantics:** every layer can be missing without crashing. A facility with no `emr-settings` Organization and no country profile artifacts still produces a `ResolvedConfig` with `country: 'HN'` (default), `flavor: 'clinic'` (default), and `modules: clinicFlavor.defaultEnabledModules`.

Resolution runs once at app boot via `useConfig()`, cached in context, re-runs on `emr-config-changed` event.

## 5. Master Project + sync model for country profiles

### 5.1 Why a master + sync model

Country profile is editable data, but only by the operator. Two viable models were considered:

- **Cross-Project read** — facility Projects read the country profile from a single shared system Project. Rejected: breaks Project isolation, complicates offline caching, conflicts with Medplum's tenant model.
- **Per-Project copy with operator-driven sync** — each facility Project holds its own copy; a sync script propagates updates from the master. **Selected.** Preserves isolation, works with offline cache unchanged, allows per-facility overrides if ever needed.

### 5.2 Master Project

A Medplum Project named `hopeemr-system`, with operators as the only members. Holds the canonical country profile artifacts. Facility admins never see it.

Country profile authoring happens in the master Project:
- `Basic` country-profile metadata
- `Library` manifest (versioned via `Library.version`)
- Referenced `Questionnaire`, `Measure`, `CodeSystem`, `ValueSet` resources

When ready to publish, bump `Library.version` (e.g., `'2026.05'`) and run the sync script.

### 5.3 Sync script

`scripts/sync-country-profile.ts <country-code> [--dry-run]`

Behavior:
1. Read the master Project's `Library` for the given country code.
2. Identify all referenced artifacts (`Library.relatedArtifact`).
3. Walk every facility Project assigned to this country.
4. For each facility Project, replace older versioned artifacts via FHIR `update` keyed by `url + version`.
5. Log a per-facility summary (artifacts updated, artifacts unchanged, errors).
6. If `--dry-run`, print the plan without making changes.

**Dry-run is a hard requirement, not optional.** Operationally, every sync is dry-runned first. Build the script with this in mind from day one.

Idempotent: running sync twice produces no changes the second time.

Rollback: re-publish a prior `Library.version` to the master Project and re-sync. Per-facility rollback by manually applying a specific version is an escape hatch.

### 5.4 Provisioning script

`scripts/provision-facility.ts`

Args (interactive prompts ≤5):
- Facility name
- Country code (defaults to `HN`)
- Flavor (defaults to `clinic`)
- Admin user email
- (optional) initial timezone

Behavior:
1. Create new Medplum Project for the facility.
2. Apply Medplum `AccessPolicy` resources that:
   - Allow facility admin to read all of own Project.
   - Allow facility admin to write `Organization` (specifically the `emr-settings` resource), `Patient`, `Encounter`, etc., as their role permits.
   - **Deny** facility admin write access to `Library`, `Questionnaire`, `Measure`, `CodeSystem`, `ValueSet`, and the country-profile `Basic` resource.
3. Create `emr-settings` `Organization` with extensions: `country`, `flavor`, default `module-enabled` for each `flavor.defaultEnabledModules`.
4. Run country profile sync into the new Project.
5. Apply catalog seeds from `flavor.catalogSeeds` (note templates, etc.).
6. Create the admin user, assign to the Project with admin role.
7. Print the facility Project ID and admin login URL.

Idempotent on re-run: if the Project already exists, refuse with a clear error rather than overwriting.

### 5.5 Governance / access matrix

| Layer | Who can read | Who can write |
|---|---|---|
| Country profile (master Project) | Operator | Operator |
| Country profile (per-facility copy) | Everyone in facility Project | Operator (via sync). Facility admin: read-only, enforced by AccessPolicy. |
| Flavor (code) | Everyone | Operator (code change + release) |
| Facility Config (`Organization` extensions) | Everyone in facility Project | Facility admin (within flavor ceiling) + Operator |
| Per-encounter charge status | Provider, front desk, billing role | Provider, front desk; role-gated. Operator override after `ChargeItem` exists. |
| Free Clinic Mode toggle | Everyone in facility Project | Admin role; toggle lives on admin settings page |

Forbidden writes (facility admin attempting to write country profile artifacts) must fail at the Medplum AccessPolicy level. Integration tests must assert these failures.

## 6. Free Clinic Mode and per-encounter charge status

### 6.1 Free Clinic Mode (facility-level)

- Storage: extension `http://hopeemr.org/fhir/free-clinic-mode` on `emr-settings` `Organization`, `valueBoolean`.
- UI: toggle on the admin settings page (`SettingsPage.tsx`). No header banner.
- Effect: when `true`, any new `Encounter` created defaults `chargeStatus` to `no-charge`. Already-created encounters are unaffected.
- The encounter creation flow displays the resulting default to the creator at the moment of creation:

  > "This encounter will default to: No Charge — Free Clinic Mode is active"

### 6.2 Per-encounter charge status

- Storage: extension `http://hopeemr.org/fhir/charge-status` on `Encounter`:
  - `valueCode: 'standard' | 'no-charge' | 'scholarship'`
- Reason extension: `http://hopeemr.org/fhir/charge-status-reason` on `Encounter`, `valueString`. Required when `chargeStatus !== 'standard'`.
- UI: chip on `EncounterHeader.tsx`, clickable to change.
- Authorization:
  - Provider, front desk, billing role can change `chargeStatus` while no `ChargeItem` exists for the encounter.
  - Once at least one `ChargeItem` exists for the encounter, only operator role can change it; UI shows the option as disabled with a tooltip explaining why.
- Audit: every change creates a `Provenance` resource with `recorded`, `agent.who`, and the prior/new value.

### 6.3 Billing impact

- Charge posting respects `Encounter.chargeStatus`. `ChargeItem` resources are not created for `no-charge` or `scholarship` encounters by default; a billing role can post specific charges manually if needed.
- Billing reports group totals by `chargeStatus` so the facility can quantify free care delivered (useful for grant reporting).

### 6.4 Timing edge case (explicit)

Toggling Free Clinic Mode at 9:00 AM affects only encounters created **at or after** 9:00 AM. Encounters in flight at 8:55 AM retain their original default. This is the documented behavior; tests must cover it.

## 7. Runtime gating pattern

### 7.1 Hooks

```typescript
useConfig(): ResolvedConfig
  // The merged, four-layer-resolved facility config. Cached in context, re-resolves
  // on the `emr-config-changed` event.

useModule(id: ModuleId): { enabled: boolean; settings: ModuleSettings }
  // Convenience for one module. enabled = false if the module is outside the flavor's
  // availableModules OR if facility config has it disabled.

useFeatureFlags(): FeatureFlags  // existing — UNCHANGED
  // Permission-derived. Different concern from useConfig (user-vs-facility).
```

UI gates that depend on both should check both: `config.modules.imaging.enabled && featureFlags.canOrderImaging`.

### 7.2 Components

```typescript
<Module id="imaging">
  ...content...
</Module>
// Renders children only if the module is enabled. Renders nothing otherwise (clean
// absence — no "feature disabled" message).

<RequireModule id="imaging" fallback="/">
  ...route element...
</RequireModule>
// Mirrors RequireAdmin. Redirects to fallback if module is disabled.
```

### 7.3 Where these are applied (phase 1)

| Surface | Pattern |
|---|---|
| Header navigation items for Imaging admin, Departments admin | `useConfig()` inline check |
| Routes `/admin/imaging-tests`, `/admin/departments`, `/admin/beds` | `<RequireModule id="imaging" \| "departments">` wrapping the existing `<RequireAdmin>` |
| "Order Imaging" button inside encounter | `<Module id="imaging">` |
| Imaging tab/section on patient view | `<Module id="imaging">` |
| Department / bed selection UI in encounter creation | `<Module id="departments">` |

### 7.4 Why a component boundary instead of inline conditionals

- Single place to evolve the policy (loading state, fallbacks, telemetry).
- Searchable: `git grep '<Module id='` and `git grep 'RequireModule'` enumerate every gated surface.
- Tree-shaking aware: when phase 2 adds inpatient modules, those components import under `<Module id="inpatient">` and bundle splitting can lazy-load them.

## 8. Admin UI changes

### 8.1 `SettingsPage.tsx` — Modules section

New section listing modules grouped into:

- **Available modules** (those in the facility's flavor `availableModules`) — toggleable on/off.
- **Hospital-only modules** (those outside the ceiling) — visible but disabled, with text:

  > "Available in Hospital flavor only. Contact HopeEMR support to upgrade your facility."

Visibility-of-unavailable rather than full hide is intentional: discoverability matters, and the message is the right answer to "can we get this?"

### 8.2 `SettingsPage.tsx` — Free Clinic Mode toggle

A switch in admin settings. When enabled, encounter creation flow surfaces the default explicitly so non-admin users (front desk, providers) don't have to know the global state.

### 8.3 `EncounterHeader.tsx` — charge status chip

Small chip showing current `chargeStatus`. Clickable for authorized roles. Selecting non-`standard` opens a reason prompt (free text, required). Once `ChargeItem` exists for the encounter, chip is disabled for non-operator roles with explanatory tooltip.

### 8.4 Catalogs — no admin UI changes needed

Existing catalog admin pages (note templates, lab tests, imaging tests, medications, diagnoses, departments, beds, appointment types, diagnostic providers) already work per-facility once the underlying multi-tenant scoping is correct. No UI work in phase 1; the catalogs become per-Project automatically.

## 9. Migration sequence

You are not yet live. Migration is essentially "build the layers in the right order with sensible defaults so the existing app keeps working at every step."

### Step 1 — Scaffolding (no user-visible change)

- Add types: `CountryCode`, `FlavorId`, `ModuleId`, `ModuleSettings`, `CatalogSeeds`, `Flavor`, `CountryProfile`, `FacilityConfigData`, `ResolvedConfig`.
- Add `resolveConfig()` with default-safe semantics.
- Add `useConfig()`, `useModule()` hooks.
- Add `<Module>`, `<RequireModule>` components.
- Add `clinicFlavor` to `src/config/flavors/clinic.ts`.
- Tests for the resolver covering: country only / country+flavor / country+flavor+facility / facility setting outside ceiling / facility setting inside ceiling / all layers missing.

### Step 2 — Per-Project plumbing

- Create the `hopeemr-system` master Project (operator-only access).
- Author initial Honduras `CountryProfile` artifacts in the master Project: `Basic` profile metadata, `Library` manifest, stub `Questionnaire` for the pregnancy form, stub `Measure` for monthly diagnosis report, ICD-10 baseline `CodeSystem`/`ValueSet`. Stubs are acceptable; content is filled in by regulatory authoring work tracked in a separate spec.
- Build `scripts/provision-facility.ts` — including `AccessPolicy` setup that denies facility admin writes to country profile artifacts.
- Build `scripts/sync-country-profile.ts` — with `--dry-run` as a first-class feature.

### Step 3 — Wire existing UI to config

- Wrap `EMRApp.tsx` routes for `/admin/imaging-tests`, `/admin/departments`, `/admin/beds` in `<RequireModule>`.
- Update `Header.tsx` navigation items to use `useConfig()`.
- Add Modules section to `SettingsPage.tsx`.
- Add Free Clinic Mode toggle to `SettingsPage.tsx`.
- Existing `useFeatureFlags()` calls remain unchanged — orthogonal concern.

### Step 4 — Per-encounter charge status

- Schema: `Encounter` extensions for `chargeStatus` and `chargeStatusReason`.
- `Provenance` writes on every change.
- UI on `EncounterHeader.tsx`.
- Encounter creation flow respects Free Clinic Mode default and surfaces it to the creator.
- Billing logic: `ChargeItem` posting checks `chargeStatus`; reports group by status.
- Authorization: operator role can override post-`ChargeItem`.

### Step 5 — Verification & documentation

- Provision a test facility in dev via the script.
- Walk every module toggle on/off; confirm UI behaves correctly.
- Toggle Free Clinic Mode; confirm new encounter defaults; confirm in-flight encounters unaffected.
- Run integration tests asserting `AccessPolicy` denies forbidden writes.
- Update `CLAUDE.md` and `.wolf/cerebrum.md` with the new patterns.

## 10. Scope

### 10.1 In phase 1

- One Medplum deployment, one Project per facility.
- `hopeemr-system` master Project for canonical country profile.
- Honduras country profile resources (foundation only — content authored separately).
- Clinic flavor (only flavor in phase 1).
- Facility config via `emr-settings` Organization extensions: `country`, `flavor`, `module-enabled`, `module-setting`, `free-clinic-mode`.
- `resolveConfig()` + `useConfig()` + `useModule()` + `<Module>` + `<RequireModule>`.
- Two module toggles: Imaging, Departments/Beds.
- Free Clinic Mode (admin toggle) + per-encounter charge status (extension on `Encounter`) + Provenance audit.
- Operator override for charge status post-`ChargeItem`.
- `scripts/provision-facility.ts`.
- `scripts/sync-country-profile.ts` with `--dry-run`.
- `AccessPolicy` denying facility admin writes to country profile artifacts.
- Offline cache: resolved config persisted in IndexedDB; `emr-settings` Organization in priority sync set.
- Tests: resolver coverage for every override scenario; integration tests for AccessPolicy enforcement.
- Documentation updates in `CLAUDE.md` and `.wolf/cerebrum.md`.

### 10.2 Not in phase 1 (deferred to later phases or never)

- Hospital flavor and inpatient modules (deferred to phase 2 with Yojoa).
- User-level personalization.
- Module dependency graph and cross-module validation.
- Versioned/scheduled config changes.
- Self-serve facility-creation UI.
- Self-serve module-upgrade requests.
- Multi-country support beyond data model accommodating it.
- Runtime hot-reload of country profile.
- Facility-level overrides of country profile artifacts.
- A/B testing or rollout flag infrastructure.
- Facility-flavor authoring or visualization UI.

### 10.3 Not in this spec (concurrent, separate specs)

These live in the universal core feature work that ships in parallel:

- Facesheet & Visit Dashboard.
- External vs. internal Rx model with inventory drawdown.
- Miscellaneous outside-drug free-text Rx with print.
- Lab results capture, trending, PDF export.
- Pharmacy lot/cost tracking and accurate inventory valuation.
- Letter and referral templates.
- Specific Honduran regulatory form content (Questionnaire JSON, Measure definitions).
- Reporting subsystem.

## 11. Risks

1. **Country profile content authoring is regulatory work, not engineering work.** The infrastructure to load and apply a `Questionnaire` is engineering. Authoring the actual Honduran pregnancy form, mapping fields to the Ministry of Health submission format, defining the monthly diagnosis report, etc. requires regulatory expertise. This person/team must be identified before phase 1 ships, or the country profile remains a hollow shell.

2. **The foundation alone delivers no clinician-visible value.** Accepted trade-off of Option B. Stated here so it does not surprise stakeholders. The first universal-core deliverable (likely Facesheet) must ship in the same release window or the foundation release will look like nothing changed.

3. **Master + sync discipline must be operational before scale.** With 5 facilities, "edit the master and run sync" is a manual habit. With 50, it is a release process. Build sync-script safety features (dry-run, per-facility logs, version-stamped rollback) from day one.

4. **Medplum AccessPolicies are subtle.** A misconfigured policy that lets a facility admin write a `Library` resource on their Project would silently let them break their own country profile. Test the access matrix explicitly — write integration tests that attempt forbidden writes and assert failure.

5. **Per-encounter charge status has direct financial consequences.** A bug that lets a `ChargeItem` post to a `no-charge` encounter is a billing error against an indigent patient. Test posting paths against every charge-status combination.

6. **Free Clinic Mode timing edge cases.** Mode toggles affect only encounters created after the toggle. Test this. State it in the spec (done in §6.4).

7. **Offline + config drift.** A facility offline for several days could be running stale resolved config when the admin from the central UI toggles a module. Acceptable trade-off for now; named here so it is not a surprise.

## 12. Success criteria

The foundation is done when all of the following hold:

1. A new facility can be provisioned end-to-end (Project + admin user + country profile + flavor + initial settings) by running one script and answering ≤5 prompts.
2. A provisioned facility's app loads with the correct country profile, flavor, and default modules, with no manual configuration steps.
3. Toggling the Imaging module off cleanly removes the imaging admin pages, the order-imaging button on encounters, the imaging tab/section on the patient view, and the imaging entries in the order menu. Toggling it back on restores all of them. Same behavior for Departments/Beds.
4. Free Clinic Mode toggle defaults all newly-created encounters to `no-charge`. In-flight encounters are unaffected. The encounter creation flow explicitly tells the creator the default that was applied.
5. A provider can mark a single visit `no-charge` regardless of facility mode, with a reason captured and a `Provenance` resource created.
6. Once `ChargeItem` resources exist for an encounter, only an operator role can change its charge status; non-operator UI shows the option as disabled with explanation.
7. The country profile sync script can update all assigned facilities without facility-side intervention. `--dry-run` mode previews changes per facility.
8. Facility admin attempts to write a country profile artifact (e.g., `Library`, `Questionnaire`) are denied by Medplum `AccessPolicy`. Integration tests assert the denial.
9. Offline: a facility that loses connectivity for the rest of a session continues operating with the last-resolved config; reconnect re-resolves correctly.
10. Resolver test coverage hits every override scenario (country only / country+flavor / country+flavor+facility / facility setting outside ceiling / facility setting inside ceiling / all layers missing).
11. Documentation in `CLAUDE.md` and `.wolf/cerebrum.md` covers the new patterns so future agent sessions do not re-invent the gating system.

## 13. Cross-cutting principles

- **One source of truth per layer.** Country profile in the master Project. Flavor in code. Facility config in the Project's `emr-settings` Organization. No settings sprinkled across multiple resources.
- **Default-safe.** Every layer can be missing; resolver still produces a working config.
- **Additive only.** No layer ever silently subtracts capability without an explicit toggle. Adding a country profile artifact never breaks a facility; toggling a module hides it without deleting data.
- **Auditable.** Every facility-config change produces a `Provenance` (or equivalent versioned change). Important for the support conversation a year from now.
- **Isolation preserved.** Project-per-facility is the security boundary. The foundation must never introduce cross-Project reads outside the explicit master-sync flow.

## 14. Open content questions (not architectural)

To be answered by the regulatory/clinical authoring track, not by foundation engineering:

- Beyond the Honduran pregnancy form and the monthly diagnosis report, what other Ministry of Health regulatory artifacts must the Honduras profile carry? Candidates: vaccination card schedules, child growth standards, notifiable disease reporting, maternal/infant mortality registries.
- What identifier rules does the Honduras profile carry (national ID format, patient identifier patterns)?
- For the catalog seeds applied at Clinic-flavor provisioning: which note templates, lab panels, and formulary entries are the "default Clinic" set?

These do not change the foundation design. They are content that the foundation loads.
