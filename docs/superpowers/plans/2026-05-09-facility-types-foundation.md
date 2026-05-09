# Facility Types & Customization Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the architectural foundation that makes HopeEMR multi-tenant and per-facility configurable: a four-layer config model (country profile / facility type / facility config / user prefs), runtime gating primitives, master Project + sync model for country profiles, per-facility provisioning, Free Clinic Mode, and per-encounter charge status with audit.

**Architecture:** Single Medplum deployment with one Project per facility. Country profile is data (FHIR `Library` + referenced `Questionnaire` / `Measure` / `CodeSystem` / `ValueSet` resources) authored in a dedicated `hopeemr-system` master Project and synced into each facility Project by an operator-run script. FacilityType is code (TypeScript objects) defining module-availability ceilings and defaults. Facility configuration lives as extensions on the per-Project `emr-settings` `Organization` resource. A pure resolver function merges all four layers into a `ResolvedConfig` exposed via React context (`useConfig`) and consumed through `<Module>` / `<RequireModule>` gating components.

**Tech Stack:** TypeScript 5.8, React 19, Mantine 7, Medplum SDK (`@medplum/core`, `@medplum/react`, `@medplum/mock`), Vitest, FHIR R4.

**Spec:** `docs/superpowers/specs/2026-05-08-facility-types-and-customization-design.md`

---

## File Structure

### New files
- `src/config/types.ts` — All config-related TypeScript types
- `src/config/extensionUrls.ts` — FHIR extension URL constants (single source of truth)
- `src/config/facility-types/clinic.ts` — Clinic facility type definition
- `src/config/facility-types/index.ts` — Lookup function `getFacilityType(id)`
- `src/config/resolveConfig.ts` — Pure resolver function
- `src/config/resolveConfig.test.ts` — Resolver unit tests
- `src/config/loadFacilityConfig.ts` — Reads `emr-settings` Organization → `FacilityConfigData`
- `src/config/loadCountryProfile.ts` — Reads `Library` + referenced artifacts → `CountryProfile`
- `src/config/ConfigContext.tsx` — React `ConfigProvider` + `useConfig` / `useModule` hooks
- `src/components/shared/Module.tsx` — `<Module>` and `<RequireModule>` components
- `src/components/shared/Module.test.tsx` — Component tests
- `src/utils/chargeStatus.ts` — Charge-status helpers (read, write, Provenance)
- `src/utils/chargeStatus.test.ts`
- `scripts/lib/medplumClient.ts` — Shared helper to construct an authed `MedplumClient` for scripts
- `scripts/provision-facility.ts` — New-facility provisioning
- `scripts/sync-country-profile.ts` — Country-profile sync with `--dry-run`
- `data/country-profiles/honduras/` — Honduras profile artifacts as JSON files
  - `basic-country-profile.json`
  - `library-manifest.json`
  - `questionnaire-pregnancy-form.json`
  - `measure-monthly-diagnosis-report.json`
  - `codesystem-icd10-baseline.json`
  - `valueset-icd10-baseline.json`

### Modified files
- `src/utils/settings.ts` — Add reads/writes for `country`, `facility-type`, `free-clinic-mode`, `module-enabled`, `module-setting` extensions
- `src/utils/permissions.ts` — Add `OVERRIDE_CHARGE_STATUS_POST_CHARGE` permission, grant to `ADMIN` role
- `src/EMRApp.tsx` — Wrap Imaging and Departments/Beds admin routes with `<RequireModule>`
- `src/main.tsx` — Wrap app in `<ConfigProvider>`
- `src/components/shared/Header.tsx` — Use `useConfig()` to gate nav items for toggleable modules
- `src/pages/admin/SettingsPage.tsx` — Add Modules section + Free Clinic Mode toggle
- `src/components/encounter/EncounterHeader.tsx` — Add charge-status chip with read+write+reason+Provenance flow
- `src/components/encounter/NewEncounterModal.tsx` — Surface the charge-status default at creation time
- `src/utils/billing.ts` — Skip `ChargeItem` creation for `no-charge`/`scholarship` encounters; group reports by status
- `src/i18n/en.json`, `src/i18n/es.json` — New translation strings
- `CLAUDE.md` — Document `useConfig` / `<Module>` patterns
- `.wolf/cerebrum.md` — Add foundation-related learnings

---

## Phase 1 — Core types and resolver

### Task 1: Add core type definitions

**Files:**
- Create: `src/config/types.ts`

- [ ] **Step 1: Create `src/config/types.ts`**

```typescript
import type { Library, Questionnaire, Measure, CodeSystem, ValueSet, Basic } from '@medplum/fhirtypes';

export type CountryCode = 'HN'; // Add more countries here as profiles ship.

export type FacilityTypeId = 'clinic' | 'hospital';

/**
 * Module identifiers. Phase-1 toggleable modules are 'imaging' and 'departments'.
 * Phase-2 modules (inpatient, mar, etc.) are listed so the Hospital facility type
 * can declare them in its availableModules without introducing new IDs later.
 */
export type ModuleId =
  | 'imaging'
  | 'departments'
  // Phase-2 (not in Clinic facility type ceiling):
  | 'inpatient'
  | 'mar'
  | 'admission-ordersets'
  | 'nursing-tasks'
  | 'bed-census'
  | 'vitals-frequency-orders';

/**
 * Per-module settings bag. Empty in phase 1 — populated as modules grow feature-level depth.
 * Each module that gets settings should add its keyed sub-type here.
 */
export type ModuleSettings = Record<string, never>;

export interface CatalogSeeds {
  noteTemplates?: string[];
  labTestPanels?: string[];
  medicationFormulary?: string[];
  diagnosisCatalog?: string[];
}

export interface FacilityType {
  id: FacilityTypeId;
  name: string;
  /** Module availability ceiling — what modules CAN be enabled at facility level. */
  availableModules: ModuleId[];
  /** Which available modules ship enabled by default at provisioning. */
  defaultEnabledModules: ModuleId[];
  /** Per-module feature defaults. */
  defaultModuleSettings: Partial<Record<ModuleId, ModuleSettings>>;
  /** Catalog seeds applied at provisioning (one-time, not enforced at runtime). */
  catalogSeeds: CatalogSeeds;
}

export interface CountryProfile {
  country: CountryCode;
  metadata: Basic;            // The 'http://hopeemr.org/fhir/StructureDefinition/country-profile' resource
  library: Library;           // Manifest pointing to all artifacts in this profile
  questionnaires: Questionnaire[];
  measures: Measure[];
  codeSystems: CodeSystem[];
  valueSets: ValueSet[];
}

export interface FacilityConfigData {
  country: CountryCode;
  facilityType: FacilityTypeId;
  /** Modules with an explicit module-enabled extension. Empty array = "no extensions" state. */
  enabledModules: ModuleId[];
  /** Per-module setting overrides (sparse). */
  moduleSettings: Partial<Record<ModuleId, ModuleSettings>>;
  freeClinicMode: boolean;
}

export interface ResolvedModule {
  enabled: boolean;
  settings: ModuleSettings;
}

export interface ResolvedConfig {
  country: CountryCode;
  facilityType: FacilityTypeId;
  /** Every ModuleId mapped to its resolved enabled+settings state. */
  modules: Record<ModuleId, ResolvedModule>;
  freeClinicMode: boolean;
  countryProfile: CountryProfile | null; // null only if profile artifacts could not be loaded
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run build`
Expected: clean compile (no errors related to the new file).

- [ ] **Step 3: Commit**

```bash
git add src/config/types.ts
git commit -m "feat(config): add core types for facility-type config model"
```

---

### Task 2: Add extension URL constants

**Files:**
- Create: `src/config/extensionUrls.ts`

- [ ] **Step 1: Create `src/config/extensionUrls.ts`**

```typescript
/**
 * Single source of truth for all HopeEMR-defined FHIR extension URLs.
 * Existing extensions in src/utils/settings.ts use 'http://medplum.com/emr/...';
 * new extensions for the facility-type foundation use 'http://hopeemr.org/fhir/...'.
 * Migration of legacy URLs to the unified namespace is out of scope for this plan.
 */
export const HOPEEMR_FHIR_BASE = 'http://hopeemr.org/fhir';

export const EXT_COUNTRY = `${HOPEEMR_FHIR_BASE}/country`;
export const EXT_FACILITY_TYPE = `${HOPEEMR_FHIR_BASE}/facility-type`;
export const EXT_MODULE_ENABLED = `${HOPEEMR_FHIR_BASE}/module-enabled`;
export const EXT_MODULE_SETTING = `${HOPEEMR_FHIR_BASE}/module-setting`;
export const EXT_FREE_CLINIC_MODE = `${HOPEEMR_FHIR_BASE}/free-clinic-mode`;

// Per-encounter charge status
export const EXT_CHARGE_STATUS = `${HOPEEMR_FHIR_BASE}/charge-status`;
export const EXT_CHARGE_STATUS_REASON = `${HOPEEMR_FHIR_BASE}/charge-status-reason`;

// Country profile
export const COUNTRY_PROFILE_STRUCTURE_DEF =
  `${HOPEEMR_FHIR_BASE}/StructureDefinition/country-profile`;
export const COUNTRY_PROFILE_LIBRARY_URL = (country: string): string =>
  `${HOPEEMR_FHIR_BASE}/profiles/country/${country}`;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run build`
Expected: clean compile.

- [ ] **Step 3: Commit**

```bash
git add src/config/extensionUrls.ts
git commit -m "feat(config): add FHIR extension URL constants"
```

---

### Task 3: Define Clinic facility type and lookup

**Files:**
- Create: `src/config/facility-types/clinic.ts`
- Create: `src/config/facility-types/index.ts`
- Create: `src/config/facility-types/index.test.ts`

- [ ] **Step 1: Write the failing test**

`src/config/facility-types/index.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getFacilityType } from './index';
import { clinicFacilityType } from './clinic';

describe('getFacilityType', () => {
  it('returns the Clinic facility type for id "clinic"', () => {
    expect(getFacilityType('clinic')).toBe(clinicFacilityType);
  });

  it('throws a clear error for an unknown id', () => {
    // @ts-expect-error: testing runtime behavior with invalid input
    expect(() => getFacilityType('unknown')).toThrow(/Unknown facility type/);
  });
});

describe('clinicFacilityType', () => {
  it('has imaging and departments in availableModules', () => {
    expect(clinicFacilityType.availableModules).toContain('imaging');
    expect(clinicFacilityType.availableModules).toContain('departments');
  });

  it('does not have inpatient modules in availableModules', () => {
    expect(clinicFacilityType.availableModules).not.toContain('inpatient');
    expect(clinicFacilityType.availableModules).not.toContain('mar');
  });

  it('enables imaging and departments by default', () => {
    expect(clinicFacilityType.defaultEnabledModules).toEqual(
      expect.arrayContaining(['imaging', 'departments'])
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/config/facility-types/index.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/config/facility-types/clinic.ts`**

```typescript
import type { FacilityType } from '../types';

export const clinicFacilityType: FacilityType = {
  id: 'clinic',
  name: 'Outpatient Clinic',
  availableModules: ['imaging', 'departments'],
  defaultEnabledModules: ['imaging', 'departments'],
  defaultModuleSettings: {},
  catalogSeeds: {
    // Identifiers of seed catalogs applied at provisioning. Names are placeholders that
    // the provisioning script resolves to actual seed JSON. Phase 1 starts empty;
    // the universal-core feature work will populate these in subsequent specs.
    noteTemplates: [],
    labTestPanels: [],
    medicationFormulary: [],
    diagnosisCatalog: [],
  },
};
```

- [ ] **Step 4: Create `src/config/facility-types/index.ts`**

```typescript
import type { FacilityType, FacilityTypeId } from '../types';
import { clinicFacilityType } from './clinic';

const facilityTypes: Record<FacilityTypeId, FacilityType> = {
  clinic: clinicFacilityType,
  // Hospital facility type is phase 2 (Yojoa). When implemented, register it here.
  hospital: clinicFacilityType, // Placeholder — replaced when Hospital facility type ships
};

export function getFacilityType(id: FacilityTypeId): FacilityType {
  const facilityType = facilityTypes[id];
  if (!facilityType) {
    throw new Error(`Unknown facility type: ${String(id)}`);
  }
  // Defensive: explicitly reject the placeholder hospital entry until phase 2.
  if (id === 'hospital') {
    throw new Error('Hospital facility type is not yet implemented (phase 2)');
  }
  return facilityType;
}

export { clinicFacilityType };
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/config/facility-types/index.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/config/facility-types/
git commit -m "feat(config): define Clinic facility type and lookup"
```

---

### Task 4: Implement resolver — country and facility-type defaults

**Files:**
- Create: `src/config/resolveConfig.ts`
- Create: `src/config/resolveConfig.test.ts`

- [ ] **Step 1: Write the failing test**

`src/config/resolveConfig.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { resolveConfig } from './resolveConfig';
import { clinicFacilityType } from './facility-types/clinic';
import type { CountryProfile } from './types';

const mockCountryProfileHN: CountryProfile = {
  country: 'HN',
  metadata: { resourceType: 'Basic', id: 'cp-hn' },
  library: { resourceType: 'Library', status: 'active' },
  questionnaires: [],
  measures: [],
  codeSystems: [],
  valueSets: [],
};

describe('resolveConfig — defaults', () => {
  it('returns flavor defaults when facilitySettings is null', () => {
    const config = resolveConfig(mockCountryProfileHN, clinicFacilityType, null);
    expect(config.country).toBe('HN');
    expect(config.facilityType).toBe('clinic');
    expect(config.modules.imaging.enabled).toBe(true);
    expect(config.modules.departments.enabled).toBe(true);
    expect(config.modules.inpatient.enabled).toBe(false); // not in clinic ceiling
    expect(config.freeClinicMode).toBe(false);
  });

  it('uses flavor defaults when facilitySettings has empty enabledModules', () => {
    const config = resolveConfig(mockCountryProfileHN, clinicFacilityType, {
      country: 'HN',
      facilityType: 'clinic',
      enabledModules: [],
      moduleSettings: {},
      freeClinicMode: false,
    });
    expect(config.modules.imaging.enabled).toBe(true);
    expect(config.modules.departments.enabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/config/resolveConfig.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/config/resolveConfig.ts`**

```typescript
import type {
  CountryProfile,
  FacilityType,
  FacilityConfigData,
  ResolvedConfig,
  ModuleId,
  ModuleSettings,
} from './types';
import { logger } from '../utils/logger';

/**
 * The complete set of ModuleId values. Used to ensure ResolvedConfig.modules has every key.
 * Update this when adding new ModuleId values to keep coverage exhaustive.
 */
const ALL_MODULE_IDS: ModuleId[] = [
  'imaging',
  'departments',
  'inpatient',
  'mar',
  'admission-ordersets',
  'nursing-tasks',
  'bed-census',
  'vitals-frequency-orders',
];

/**
 * Pure resolver: merges country profile + facility type + facility config into a flat
 * ResolvedConfig. Default-safe — every layer can be missing without crashing.
 *
 * Three-state semantics for module enablement (per spec §4.5):
 *   1. facilitySettings null → use facilityType.defaultEnabledModules
 *   2. facilitySettings.enabledModules empty → use facilityType.defaultEnabledModules
 *   3. facilitySettings.enabledModules non-empty → those are authoritative,
 *      intersected with facilityType.availableModules
 */
export function resolveConfig(
  countryProfile: CountryProfile | null,
  facilityType: FacilityType,
  facilitySettings: FacilityConfigData | null,
): ResolvedConfig {
  const country = facilitySettings?.country ?? countryProfile?.country ?? 'HN';

  // Determine enabled-modules set with three-state semantics
  const useFlavorDefaults =
    !facilitySettings || facilitySettings.enabledModules.length === 0;

  const ceiling = new Set(facilityType.availableModules);

  let enabledSet: Set<ModuleId>;
  if (useFlavorDefaults) {
    enabledSet = new Set(facilityType.defaultEnabledModules);
  } else {
    enabledSet = new Set();
    for (const moduleId of facilitySettings!.enabledModules) {
      if (ceiling.has(moduleId)) {
        enabledSet.add(moduleId);
      } else {
        logger.warn(
          `Ignoring module-enabled extension for module "${moduleId}" — outside facility-type ceiling`,
        );
      }
    }
  }

  // Build the per-module ResolvedConfig.modules map (every ModuleId present)
  const modules: Record<ModuleId, { enabled: boolean; settings: ModuleSettings }> =
    {} as Record<ModuleId, { enabled: boolean; settings: ModuleSettings }>;

  for (const moduleId of ALL_MODULE_IDS) {
    const baseSettings: ModuleSettings =
      facilityType.defaultModuleSettings[moduleId] ?? ({} as ModuleSettings);
    const overrideSettings: ModuleSettings | undefined = ceiling.has(moduleId)
      ? facilitySettings?.moduleSettings[moduleId]
      : undefined;
    modules[moduleId] = {
      enabled: enabledSet.has(moduleId),
      settings: { ...baseSettings, ...overrideSettings } as ModuleSettings,
    };
  }

  return {
    country,
    facilityType: facilityType.id,
    modules,
    freeClinicMode: facilitySettings?.freeClinicMode ?? false,
    countryProfile,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/config/resolveConfig.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/config/resolveConfig.ts src/config/resolveConfig.test.ts
git commit -m "feat(config): add resolver with default and empty-settings cases"
```

---

### Task 5: Resolver — facility overrides and ceiling enforcement

**Files:**
- Modify: `src/config/resolveConfig.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `src/config/resolveConfig.test.ts`:

```typescript
describe('resolveConfig — facility overrides', () => {
  it('honors facility-explicit module-enabled when within ceiling', () => {
    const config = resolveConfig(mockCountryProfileHN, clinicFacilityType, {
      country: 'HN',
      facilityType: 'clinic',
      enabledModules: ['imaging'], // departments NOT enabled
      moduleSettings: {},
      freeClinicMode: false,
    });
    expect(config.modules.imaging.enabled).toBe(true);
    expect(config.modules.departments.enabled).toBe(false);
  });

  it('disables all modules when facility explicitly enables none (and at least one extension exists in non-empty form)', () => {
    // Note: empty enabledModules means "fall back to defaults" per §4.5.
    // To test "explicitly disable all," we use a single placeholder enabled module
    // outside the ceiling — which is rejected — leaving zero enabled.
    const config = resolveConfig(mockCountryProfileHN, clinicFacilityType, {
      country: 'HN',
      facilityType: 'clinic',
      enabledModules: ['inpatient'], // outside ceiling
      moduleSettings: {},
      freeClinicMode: false,
    });
    expect(config.modules.imaging.enabled).toBe(false);
    expect(config.modules.departments.enabled).toBe(false);
    expect(config.modules.inpatient.enabled).toBe(false); // ignored, outside ceiling
  });

  it('ignores module-enabled extensions outside the facility-type ceiling', () => {
    const config = resolveConfig(mockCountryProfileHN, clinicFacilityType, {
      country: 'HN',
      facilityType: 'clinic',
      enabledModules: ['imaging', 'inpatient', 'mar'], // imaging in ceiling; others outside
      moduleSettings: {},
      freeClinicMode: false,
    });
    expect(config.modules.imaging.enabled).toBe(true);
    expect(config.modules.inpatient.enabled).toBe(false);
    expect(config.modules.mar.enabled).toBe(false);
  });

  it('reflects freeClinicMode from facility settings', () => {
    const config = resolveConfig(mockCountryProfileHN, clinicFacilityType, {
      country: 'HN',
      facilityType: 'clinic',
      enabledModules: ['imaging'],
      moduleSettings: {},
      freeClinicMode: true,
    });
    expect(config.freeClinicMode).toBe(true);
  });
});

describe('resolveConfig — missing layers', () => {
  it('produces a usable config with null country profile', () => {
    const config = resolveConfig(null, clinicFacilityType, null);
    expect(config.country).toBe('HN'); // default
    expect(config.facilityType).toBe('clinic');
    expect(config.countryProfile).toBe(null);
    expect(config.modules.imaging.enabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify all pass**

Run: `npx vitest run src/config/resolveConfig.test.ts`
Expected: PASS (6 tests total). Implementation from Task 4 already handles these cases.

- [ ] **Step 3: Commit**

```bash
git add src/config/resolveConfig.test.ts
git commit -m "test(config): cover facility overrides and missing layers"
```

---

### Task 6: Implement loadFacilityConfig

**Files:**
- Create: `src/config/loadFacilityConfig.ts`
- Create: `src/config/loadFacilityConfig.test.ts`
- Modify: `src/utils/settings.ts` — extract or expose the `emr-settings` Organization fetch

- [ ] **Step 1: Write the failing test**

`src/config/loadFacilityConfig.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { MockClient } from '@medplum/mock';
import { loadFacilityConfig } from './loadFacilityConfig';
import {
  EXT_COUNTRY,
  EXT_FACILITY_TYPE,
  EXT_MODULE_ENABLED,
  EXT_FREE_CLINIC_MODE,
} from './extensionUrls';

describe('loadFacilityConfig', () => {
  it('returns null when no emr-settings Organization exists', async () => {
    const medplum = new MockClient();
    const config = await loadFacilityConfig(medplum);
    expect(config).toBe(null);
  });

  it('reads country, facility-type, free-clinic-mode, and enabledModules from extensions', async () => {
    const medplum = new MockClient();
    await medplum.createResource({
      resourceType: 'Organization',
      identifier: [{ system: 'http://medplum.com/emr', value: 'emr-settings' }],
      name: 'Test Clinic',
      active: true,
      extension: [
        { url: EXT_COUNTRY, valueCode: 'HN' },
        { url: EXT_FACILITY_TYPE, valueCode: 'clinic' },
        { url: EXT_FREE_CLINIC_MODE, valueBoolean: true },
        { url: EXT_MODULE_ENABLED, valueCode: 'imaging' },
        { url: EXT_MODULE_ENABLED, valueCode: 'departments' },
      ],
    });
    const config = await loadFacilityConfig(medplum);
    expect(config).not.toBe(null);
    expect(config!.country).toBe('HN');
    expect(config!.facilityType).toBe('clinic');
    expect(config!.freeClinicMode).toBe(true);
    expect(config!.enabledModules).toEqual(
      expect.arrayContaining(['imaging', 'departments']),
    );
  });

  it('defaults country and facilityType when extensions missing', async () => {
    const medplum = new MockClient();
    await medplum.createResource({
      resourceType: 'Organization',
      identifier: [{ system: 'http://medplum.com/emr', value: 'emr-settings' }],
      name: 'Test',
      active: true,
      extension: [],
    });
    const config = await loadFacilityConfig(medplum);
    expect(config!.country).toBe('HN');
    expect(config!.facilityType).toBe('clinic');
    expect(config!.enabledModules).toEqual([]);
    expect(config!.freeClinicMode).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/config/loadFacilityConfig.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/config/loadFacilityConfig.ts`**

```typescript
import type { MedplumClient } from '@medplum/core';
import type { Organization } from '@medplum/fhirtypes';
import {
  EXT_COUNTRY,
  EXT_FACILITY_TYPE,
  EXT_MODULE_ENABLED,
  EXT_MODULE_SETTING,
  EXT_FREE_CLINIC_MODE,
} from './extensionUrls';
import type {
  CountryCode,
  FacilityConfigData,
  FacilityTypeId,
  ModuleId,
  ModuleSettings,
} from './types';
import { logger } from '../utils/logger';

const SETTINGS_ORG_IDENTIFIER = 'emr-settings';

export async function loadFacilityConfig(
  medplum: MedplumClient,
): Promise<FacilityConfigData | null> {
  try {
    const result = await medplum.search('Organization', {
      identifier: SETTINGS_ORG_IDENTIFIER,
      _count: '1',
    });
    const org = result.entry?.[0]?.resource as Organization | undefined;
    if (!org) return null;

    const extensions = org.extension ?? [];

    const country =
      (extensions.find((e) => e.url === EXT_COUNTRY)?.valueCode as CountryCode) ?? 'HN';
    const facilityType =
      (extensions.find((e) => e.url === EXT_FACILITY_TYPE)?.valueCode as FacilityTypeId) ??
      'clinic';
    const freeClinicMode =
      extensions.find((e) => e.url === EXT_FREE_CLINIC_MODE)?.valueBoolean ?? false;

    const enabledModules: ModuleId[] = extensions
      .filter((e) => e.url === EXT_MODULE_ENABLED)
      .map((e) => e.valueCode as ModuleId)
      .filter((id): id is ModuleId => Boolean(id));

    const moduleSettings: Partial<Record<ModuleId, ModuleSettings>> = {};
    for (const ext of extensions.filter((e) => e.url === EXT_MODULE_SETTING)) {
      const sub = ext.extension ?? [];
      const moduleId = sub.find((e) => e.url === 'moduleId')?.valueCode as ModuleId | undefined;
      const key = sub.find((e) => e.url === 'key')?.valueString;
      const value =
        sub.find((e) => e.url === 'value')?.valueString ??
        sub.find((e) => e.url === 'value')?.valueBoolean ??
        sub.find((e) => e.url === 'value')?.valueInteger ??
        sub.find((e) => e.url === 'value')?.valueCode;
      if (moduleId && key !== undefined && value !== undefined) {
        const existing = moduleSettings[moduleId] ?? ({} as ModuleSettings);
        moduleSettings[moduleId] = { ...existing, [key]: value } as ModuleSettings;
      }
    }

    return { country, facilityType, enabledModules, moduleSettings, freeClinicMode };
  } catch (error) {
    logger.error('Failed to load facility config', error);
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/config/loadFacilityConfig.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/config/loadFacilityConfig.ts src/config/loadFacilityConfig.test.ts
git commit -m "feat(config): add loadFacilityConfig reading emr-settings extensions"
```

---

### Task 7: Implement loadCountryProfile

**Files:**
- Create: `src/config/loadCountryProfile.ts`
- Create: `src/config/loadCountryProfile.test.ts`

- [ ] **Step 1: Write the failing test**

`src/config/loadCountryProfile.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { MockClient } from '@medplum/mock';
import { loadCountryProfile } from './loadCountryProfile';
import { COUNTRY_PROFILE_LIBRARY_URL } from './extensionUrls';

describe('loadCountryProfile', () => {
  it('returns null when no Library matches the country', async () => {
    const medplum = new MockClient();
    const profile = await loadCountryProfile(medplum, 'HN');
    expect(profile).toBe(null);
  });

  it('loads Library plus referenced Questionnaire and Measure', async () => {
    const medplum = new MockClient();

    const questionnaire = await medplum.createResource({
      resourceType: 'Questionnaire',
      url: 'http://hopeemr.org/fhir/q/honduras-pregnancy',
      status: 'active',
    });
    const measure = await medplum.createResource({
      resourceType: 'Measure',
      url: 'http://hopeemr.org/fhir/m/honduras-monthly-diagnosis',
      status: 'active',
    });
    await medplum.createResource({
      resourceType: 'Library',
      url: COUNTRY_PROFILE_LIBRARY_URL('HN'),
      status: 'active',
      version: '2026.05',
      relatedArtifact: [
        { type: 'depends-on', resource: questionnaire.url },
        { type: 'depends-on', resource: measure.url },
      ],
    });

    const profile = await loadCountryProfile(medplum, 'HN');
    expect(profile).not.toBe(null);
    expect(profile!.country).toBe('HN');
    expect(profile!.questionnaires).toHaveLength(1);
    expect(profile!.measures).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/config/loadCountryProfile.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/config/loadCountryProfile.ts`**

```typescript
import type { MedplumClient } from '@medplum/core';
import type {
  Library,
  Questionnaire,
  Measure,
  CodeSystem,
  ValueSet,
  Basic,
  RelatedArtifact,
} from '@medplum/fhirtypes';
import { COUNTRY_PROFILE_LIBRARY_URL, COUNTRY_PROFILE_STRUCTURE_DEF } from './extensionUrls';
import type { CountryCode, CountryProfile } from './types';
import { logger } from '../utils/logger';

export async function loadCountryProfile(
  medplum: MedplumClient,
  country: CountryCode,
): Promise<CountryProfile | null> {
  try {
    const libUrl = COUNTRY_PROFILE_LIBRARY_URL(country);
    const libRes = await medplum.search('Library', { url: libUrl, _count: '1' });
    const library = libRes.entry?.[0]?.resource as Library | undefined;
    if (!library) return null;

    const metadataRes = await medplum.search('Basic', {
      _profile: COUNTRY_PROFILE_STRUCTURE_DEF,
      _count: '1',
    });
    const metadata =
      (metadataRes.entry?.[0]?.resource as Basic | undefined) ??
      ({ resourceType: 'Basic', code: { text: 'country-profile' } } as Basic);

    const refs = (library.relatedArtifact ?? []).filter(
      (r) => r.type === 'depends-on' && r.resource,
    ) as RelatedArtifact[];

    const questionnaires: Questionnaire[] = [];
    const measures: Measure[] = [];
    const codeSystems: CodeSystem[] = [];
    const valueSets: ValueSet[] = [];

    for (const ref of refs) {
      const url = ref.resource as string;
      const [q, m, cs, vs] = await Promise.all([
        medplum.search('Questionnaire', { url, _count: '1' }),
        medplum.search('Measure', { url, _count: '1' }),
        medplum.search('CodeSystem', { url, _count: '1' }),
        medplum.search('ValueSet', { url, _count: '1' }),
      ]);
      const qRes = q.entry?.[0]?.resource as Questionnaire | undefined;
      const mRes = m.entry?.[0]?.resource as Measure | undefined;
      const csRes = cs.entry?.[0]?.resource as CodeSystem | undefined;
      const vsRes = vs.entry?.[0]?.resource as ValueSet | undefined;
      if (qRes) questionnaires.push(qRes);
      if (mRes) measures.push(mRes);
      if (csRes) codeSystems.push(csRes);
      if (vsRes) valueSets.push(vsRes);
    }

    return { country, metadata, library, questionnaires, measures, codeSystems, valueSets };
  } catch (error) {
    logger.error(`Failed to load country profile for ${country}`, error);
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/config/loadCountryProfile.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/config/loadCountryProfile.ts src/config/loadCountryProfile.test.ts
git commit -m "feat(config): add loadCountryProfile reading Library and artifacts"
```

---

## Phase 2 — React integration layer

### Task 8: ConfigProvider, useConfig, useModule

**Files:**
- Create: `src/config/ConfigContext.tsx`
- Create: `src/config/ConfigContext.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/config/ConfigContext.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MockClient } from '@medplum/mock';
import { MedplumProvider } from '@medplum/react';
import { ConfigProvider, useConfig, useModule } from './ConfigContext';
import { EXT_COUNTRY, EXT_FACILITY_TYPE, EXT_MODULE_ENABLED } from './extensionUrls';

function ConfigInspector(): JSX.Element {
  const config = useConfig();
  const imaging = useModule('imaging');
  return (
    <div>
      <div data-testid="country">{config.country}</div>
      <div data-testid="facility-type">{config.facilityType}</div>
      <div data-testid="imaging-enabled">{String(imaging.enabled)}</div>
    </div>
  );
}

describe('ConfigProvider', () => {
  it('provides default-safe config when no settings exist', async () => {
    const medplum = new MockClient();
    render(
      <MedplumProvider medplum={medplum}>
        <ConfigProvider>
          <ConfigInspector />
        </ConfigProvider>
      </MedplumProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('country').textContent).toBe('HN');
      expect(screen.getByTestId('facility-type').textContent).toBe('clinic');
      expect(screen.getByTestId('imaging-enabled').textContent).toBe('true');
    });
  });

  it('reflects facility-disabled imaging from emr-settings extensions', async () => {
    const medplum = new MockClient();
    await medplum.createResource({
      resourceType: 'Organization',
      identifier: [{ system: 'http://medplum.com/emr', value: 'emr-settings' }],
      name: 'Clinic',
      active: true,
      extension: [
        { url: EXT_COUNTRY, valueCode: 'HN' },
        { url: EXT_FACILITY_TYPE, valueCode: 'clinic' },
        { url: EXT_MODULE_ENABLED, valueCode: 'departments' }, // imaging not enabled
      ],
    });
    render(
      <MedplumProvider medplum={medplum}>
        <ConfigProvider>
          <ConfigInspector />
        </ConfigProvider>
      </MedplumProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('imaging-enabled').textContent).toBe('false');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/config/ConfigContext.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/config/ConfigContext.tsx`**

```tsx
import { createContext, useContext, useEffect, useState, useCallback, ReactNode, JSX } from 'react';
import { useMedplum } from '@medplum/react';
import { resolveConfig } from './resolveConfig';
import { loadFacilityConfig } from './loadFacilityConfig';
import { loadCountryProfile } from './loadCountryProfile';
import { getFacilityType } from './facility-types';
import type { ResolvedConfig, ModuleId, ResolvedModule } from './types';
import { clinicFacilityType } from './facility-types/clinic';
import { logger } from '../utils/logger';

const CONFIG_CHANGED_EVENT = 'emr-config-changed';

const ConfigContext = createContext<ResolvedConfig | null>(null);

export function ConfigProvider({ children }: { children: ReactNode }): JSX.Element {
  const medplum = useMedplum();
  const [config, setConfig] = useState<ResolvedConfig>(() =>
    // Synchronous default-safe config so first render is never undefined
    resolveConfig(null, clinicFacilityType, null),
  );

  const reload = useCallback(async () => {
    try {
      const facilityData = await loadFacilityConfig(medplum);
      const country = facilityData?.country ?? 'HN';
      const facilityTypeId = facilityData?.facilityType ?? 'clinic';
      let facilityType;
      try {
        facilityType = getFacilityType(facilityTypeId);
      } catch (err) {
        logger.error('Unknown facility type, falling back to clinic', err);
        facilityType = clinicFacilityType;
      }
      const countryProfile = await loadCountryProfile(medplum, country);
      const resolved = resolveConfig(countryProfile, facilityType, facilityData);
      setConfig(resolved);
    } catch (error) {
      logger.error('Failed to resolve facility config', error);
      // Leave previous config in place
    }
  }, [medplum]);

  useEffect(() => {
    void reload();
    const handler = (): void => {
      void reload();
    };
    window.addEventListener(CONFIG_CHANGED_EVENT, handler);
    return () => window.removeEventListener(CONFIG_CHANGED_EVENT, handler);
  }, [reload]);

  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
}

export function useConfig(): ResolvedConfig {
  const config = useContext(ConfigContext);
  if (!config) {
    // Should never happen if ConfigProvider wraps the tree, but be defensive
    return resolveConfig(null, clinicFacilityType, null);
  }
  return config;
}

export function useModule(id: ModuleId): ResolvedModule {
  const config = useConfig();
  return config.modules[id];
}

/**
 * Helper for non-component code (e.g., after saving facility settings) to trigger a
 * config re-resolution.
 */
export function notifyConfigChanged(): void {
  window.dispatchEvent(new Event(CONFIG_CHANGED_EVENT));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/config/ConfigContext.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/config/ConfigContext.tsx src/config/ConfigContext.test.tsx
git commit -m "feat(config): add ConfigProvider, useConfig, and useModule"
```

---

### Task 9: `<Module>` and `<RequireModule>` components

**Files:**
- Create: `src/components/shared/Module.tsx`
- Create: `src/components/shared/Module.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/shared/Module.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { MockClient } from '@medplum/mock';
import { MedplumProvider } from '@medplum/react';
import { ConfigProvider } from '../../config/ConfigContext';
import { Module, RequireModule } from './Module';
import {
  EXT_COUNTRY,
  EXT_FACILITY_TYPE,
  EXT_MODULE_ENABLED,
} from '../../config/extensionUrls';

async function renderWith(extensionsValueCodes: string[]) {
  const medplum = new MockClient();
  await medplum.createResource({
    resourceType: 'Organization',
    identifier: [{ system: 'http://medplum.com/emr', value: 'emr-settings' }],
    name: 'Test',
    active: true,
    extension: [
      { url: EXT_COUNTRY, valueCode: 'HN' },
      { url: EXT_FACILITY_TYPE, valueCode: 'clinic' },
      ...extensionsValueCodes.map((c) => ({ url: EXT_MODULE_ENABLED, valueCode: c })),
    ],
  });
  return medplum;
}

describe('<Module>', () => {
  it('renders children when module is enabled', async () => {
    const medplum = await renderWith(['imaging']);
    render(
      <MedplumProvider medplum={medplum}>
        <ConfigProvider>
          <Module id="imaging">
            <span data-testid="content">imaging UI</span>
          </Module>
        </ConfigProvider>
      </MedplumProvider>,
    );
    await screen.findByTestId('content');
  });

  it('renders nothing when module is disabled', async () => {
    const medplum = await renderWith(['departments']); // imaging NOT enabled
    render(
      <MedplumProvider medplum={medplum}>
        <ConfigProvider>
          <Module id="imaging">
            <span data-testid="content">imaging UI</span>
          </Module>
        </ConfigProvider>
      </MedplumProvider>,
    );
    // Wait long enough for the async config load to complete and the "default-safe"
    // initial render (where imaging WOULD be enabled) to be replaced.
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('content')).toBeNull();
  });
});

describe('<RequireModule>', () => {
  it('redirects to fallback when module is disabled', async () => {
    const medplum = await renderWith(['departments']);
    render(
      <MedplumProvider medplum={medplum}>
        <ConfigProvider>
          <MemoryRouter initialEntries={['/imaging']}>
            <Routes>
              <Route
                path="/imaging"
                element={
                  <RequireModule id="imaging" fallback="/">
                    <span data-testid="page">imaging admin</span>
                  </RequireModule>
                }
              />
              <Route path="/" element={<span data-testid="home">home</span>} />
            </Routes>
          </MemoryRouter>
        </ConfigProvider>
      </MedplumProvider>,
    );
    await screen.findByTestId('home');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/shared/Module.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/components/shared/Module.tsx`**

```tsx
import { Navigate } from 'react-router';
import { ReactNode, JSX } from 'react';
import { useModule } from '../../config/ConfigContext';
import type { ModuleId } from '../../config/types';

interface ModuleProps {
  id: ModuleId;
  children: ReactNode;
}

/**
 * Renders children only if the named module is enabled at the facility.
 * Renders nothing (clean absence) when disabled — no "feature disabled" message.
 */
export function Module({ id, children }: ModuleProps): JSX.Element | null {
  const module = useModule(id);
  if (!module.enabled) return null;
  return <>{children}</>;
}

interface RequireModuleProps {
  id: ModuleId;
  fallback: string;
  children: ReactNode;
}

/**
 * Route guard that redirects to `fallback` if the named module is disabled.
 * Mirrors the existing RequireAdmin pattern.
 */
export function RequireModule({
  id,
  fallback,
  children,
}: RequireModuleProps): JSX.Element {
  const module = useModule(id);
  if (!module.enabled) return <Navigate to={fallback} replace />;
  return <>{children}</>;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/shared/Module.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/Module.tsx src/components/shared/Module.test.tsx
git commit -m "feat(config): add <Module> and <RequireModule> components"
```

---

### Task 10: Wrap app in ConfigProvider

**Files:**
- Modify: `src/main.tsx`

- [ ] **Step 1: Read current `src/main.tsx`**

Run: `cat src/main.tsx`

Expected: providers wrapping `<EMRApp />`.

- [ ] **Step 2: Modify `src/main.tsx` to add `<ConfigProvider>` inside `<MedplumProvider>` and around `<EMRApp />`**

Add import:

```typescript
import { ConfigProvider } from './config/ConfigContext';
```

Wrap the existing `<EMRApp />` (or its current wrapper) in `<ConfigProvider>`. Do NOT wrap above `<MedplumProvider>` — `ConfigProvider` calls `useMedplum()`.

- [ ] **Step 3: Verify dev server boots**

Run: `npm run dev`
Open http://localhost:3000 in a browser.
Expected: app renders without errors. Check the browser console for any "Failed to resolve facility config" errors — those indicate Medplum search problems, not provider problems.

- [ ] **Step 4: Verify type check**

Run: `npm run build`
Expected: clean compile.

- [ ] **Step 5: Commit**

```bash
git add src/main.tsx
git commit -m "feat(config): wrap app in ConfigProvider"
```

---

## Phase 3 — Master Project setup runbook

### Task 11: Document master Project setup procedure

**Files:**
- Create: `docs/MASTER_PROJECT_SETUP.md`

- [ ] **Step 1: Create `docs/MASTER_PROJECT_SETUP.md`**

```markdown
# Master Project Setup — Operator Runbook

The `hopeemr-system` master Project holds the canonical country profile artifacts.
Operators edit profiles here and run `scripts/sync-country-profile.ts` to push the
versioned profile into every facility Project.

## One-time setup

1. Sign in to the Medplum admin console as a super-admin.
2. Create a new Project named `hopeemr-system`.
3. Add only operator users as members. Facility admins MUST NOT be members.
4. Note the Project ID — `scripts/sync-country-profile.ts` reads it from
   the `HOPEEMR_MASTER_PROJECT_ID` environment variable.

## Authoring a country profile

1. Open the master Project in the admin console.
2. Create the profile artifacts as FHIR resources, using the JSON files in
   `data/country-profiles/<country>/` as starting templates:
   - `Basic` country profile metadata (`meta.profile = http://hopeemr.org/fhir/StructureDefinition/country-profile`)
   - `Library` manifest (`url = http://hopeemr.org/fhir/profiles/country/<code>`,
     `version = YYYY.MM`)
   - Referenced `Questionnaire`, `Measure`, `CodeSystem`, `ValueSet` resources
3. Update `Library.relatedArtifact` to list every artifact's canonical `url`.
4. Bump `Library.version` (e.g., `2026.05` → `2026.06`).
5. Run `npm run sync:country -- HN --dry-run` to preview the sync plan.
6. When satisfied, run `npm run sync:country -- HN`.

## Rollback

To roll back a sync, re-publish a prior `Library.version` to the master Project
and run `npm run sync:country -- HN` again. Per-facility manual rollback is an
escape hatch; do not use it as the standard procedure.

## Auditing

Every sync emits a per-facility log to stdout. Pipe to a log file when running in
production:

    npm run sync:country -- HN 2>&1 | tee sync-$(date +%Y%m%d-%H%M%S).log
```

- [ ] **Step 2: Commit**

```bash
git add docs/MASTER_PROJECT_SETUP.md
git commit -m "docs: master Project setup runbook for operators"
```

---

## Phase 4 — Honduras country profile content

### Task 12: Author Honduras country profile artifacts as JSON

**Files:**
- Create: `data/country-profiles/honduras/basic-country-profile.json`
- Create: `data/country-profiles/honduras/library-manifest.json`
- Create: `data/country-profiles/honduras/questionnaire-pregnancy-form.json`
- Create: `data/country-profiles/honduras/measure-monthly-diagnosis-report.json`
- Create: `data/country-profiles/honduras/codesystem-icd10-baseline.json`
- Create: `data/country-profiles/honduras/valueset-icd10-baseline.json`

These are STUB resources — content authoring is a regulatory task tracked in a separate spec. The stubs validate that the loading and sync pipelines work end-to-end.

- [ ] **Step 1: Create `basic-country-profile.json`**

```json
{
  "resourceType": "Basic",
  "id": "country-profile-hn",
  "meta": {
    "profile": ["http://hopeemr.org/fhir/StructureDefinition/country-profile"]
  },
  "code": {
    "coding": [
      { "system": "http://hopeemr.org/fhir/CodeSystem/country-profile-type", "code": "country-profile" }
    ],
    "text": "Honduras Country Profile"
  },
  "extension": [
    { "url": "http://hopeemr.org/fhir/country-code", "valueCode": "HN" },
    { "url": "http://hopeemr.org/fhir/locale", "valueCode": "es-HN" },
    { "url": "http://hopeemr.org/fhir/currency", "valueCode": "HNL" }
  ]
}
```

- [ ] **Step 2: Create `library-manifest.json`**

```json
{
  "resourceType": "Library",
  "url": "http://hopeemr.org/fhir/profiles/country/HN",
  "version": "2026.05",
  "name": "HondurasCountryProfile",
  "title": "Honduras Country Profile",
  "status": "active",
  "type": {
    "coding": [
      { "system": "http://terminology.hl7.org/CodeSystem/library-type", "code": "asset-collection" }
    ]
  },
  "relatedArtifact": [
    { "type": "depends-on", "resource": "http://hopeemr.org/fhir/q/honduras-pregnancy-form" },
    { "type": "depends-on", "resource": "http://hopeemr.org/fhir/m/honduras-monthly-diagnosis-report" },
    { "type": "depends-on", "resource": "http://hopeemr.org/fhir/CodeSystem/icd10-honduras-baseline" },
    { "type": "depends-on", "resource": "http://hopeemr.org/fhir/ValueSet/icd10-honduras-baseline" }
  ]
}
```

- [ ] **Step 3: Create `questionnaire-pregnancy-form.json`**

```json
{
  "resourceType": "Questionnaire",
  "url": "http://hopeemr.org/fhir/q/honduras-pregnancy-form",
  "version": "2026.05",
  "name": "HondurasPregnancyForm",
  "title": "Honduras Pregnancy Form (stub)",
  "status": "active",
  "subjectType": ["Patient"],
  "item": [
    {
      "linkId": "stub-marker",
      "text": "STUB — content to be authored by regulatory authoring track",
      "type": "display"
    }
  ]
}
```

- [ ] **Step 4: Create `measure-monthly-diagnosis-report.json`**

```json
{
  "resourceType": "Measure",
  "url": "http://hopeemr.org/fhir/m/honduras-monthly-diagnosis-report",
  "version": "2026.05",
  "name": "HondurasMonthlyDiagnosisReport",
  "title": "Honduras Monthly Diagnosis Report (stub)",
  "status": "active",
  "scoring": {
    "coding": [
      { "system": "http://terminology.hl7.org/CodeSystem/measure-scoring", "code": "cohort" }
    ]
  },
  "description": "STUB — measure definition to be authored by regulatory authoring track."
}
```

- [ ] **Step 5: Create `codesystem-icd10-baseline.json`**

```json
{
  "resourceType": "CodeSystem",
  "url": "http://hopeemr.org/fhir/CodeSystem/icd10-honduras-baseline",
  "version": "2026.05",
  "name": "ICD10HondurasBaseline",
  "title": "ICD-10 Honduras Baseline (stub)",
  "status": "active",
  "content": "fragment",
  "concept": [
    { "code": "STUB.1", "display": "Stub diagnosis 1" }
  ]
}
```

- [ ] **Step 6: Create `valueset-icd10-baseline.json`**

```json
{
  "resourceType": "ValueSet",
  "url": "http://hopeemr.org/fhir/ValueSet/icd10-honduras-baseline",
  "version": "2026.05",
  "name": "ICD10HondurasBaselineValueSet",
  "title": "ICD-10 Honduras Baseline Value Set (stub)",
  "status": "active",
  "compose": {
    "include": [
      { "system": "http://hopeemr.org/fhir/CodeSystem/icd10-honduras-baseline" }
    ]
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add data/country-profiles/honduras/
git commit -m "feat(content): add stub Honduras country profile artifacts"
```

---

## Phase 5 — Provisioning and sync scripts

### Task 13: Shared MedplumClient helper for scripts

**Files:**
- Create: `scripts/lib/medplumClient.ts`

- [ ] **Step 1: Create `scripts/lib/medplumClient.ts`**

```typescript
import { MedplumClient } from '@medplum/core';

/**
 * Construct an authenticated MedplumClient for scripts. Reads credentials from env:
 *   MEDPLUM_BASE_URL          (defaults to https://api.medplum.com/)
 *   MEDPLUM_CLIENT_ID
 *   MEDPLUM_CLIENT_SECRET
 *   HOPEEMR_MASTER_PROJECT_ID (used by sync-country-profile.ts)
 */
export async function createScriptMedplumClient(): Promise<MedplumClient> {
  const baseUrl = process.env.MEDPLUM_BASE_URL ?? 'https://api.medplum.com/';
  const clientId = process.env.MEDPLUM_CLIENT_ID;
  const clientSecret = process.env.MEDPLUM_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      'MEDPLUM_CLIENT_ID and MEDPLUM_CLIENT_SECRET must be set in the environment',
    );
  }
  const medplum = new MedplumClient({ baseUrl });
  await medplum.startClientLogin(clientId, clientSecret);
  return medplum;
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/lib/medplumClient.ts
git commit -m "feat(scripts): shared authenticated MedplumClient helper"
```

---

### Task 14: Provisioning script — Project + AccessPolicy + emr-settings

**Files:**
- Create: `scripts/provision-facility.ts`
- Create: `scripts/provision-facility.test.ts`
- Modify: `package.json` — add npm script `provision:facility`

- [ ] **Step 1: Write a failing test that exercises provisioning logic against MockClient**

`scripts/provision-facility.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { MockClient } from '@medplum/mock';
import { provisionFacility } from './provision-facility';
import {
  EXT_COUNTRY,
  EXT_FACILITY_TYPE,
  EXT_MODULE_ENABLED,
} from '../src/config/extensionUrls';
import type { Organization } from '@medplum/fhirtypes';

describe('provisionFacility', () => {
  it('creates emr-settings Organization with country, facility-type, and default modules', async () => {
    const medplum = new MockClient();
    await provisionFacility(medplum, {
      facilityName: 'Test Clinic',
      country: 'HN',
      facilityType: 'clinic',
      adminEmail: 'admin@test.example',
      seedCountryProfile: false, // tested separately to keep this test focused
    });

    const result = await medplum.search('Organization', { identifier: 'emr-settings' });
    const org = result.entry?.[0]?.resource as Organization | undefined;
    expect(org).toBeDefined();
    expect(org!.name).toBe('Test Clinic');
    const exts = org!.extension ?? [];
    expect(exts.find((e) => e.url === EXT_COUNTRY)?.valueCode).toBe('HN');
    expect(exts.find((e) => e.url === EXT_FACILITY_TYPE)?.valueCode).toBe('clinic');
    const enabledCodes = exts
      .filter((e) => e.url === EXT_MODULE_ENABLED)
      .map((e) => e.valueCode);
    expect(enabledCodes).toEqual(expect.arrayContaining(['imaging', 'departments']));
  });

  it('refuses to overwrite an existing emr-settings Organization', async () => {
    const medplum = new MockClient();
    await medplum.createResource({
      resourceType: 'Organization',
      identifier: [{ system: 'http://medplum.com/emr', value: 'emr-settings' }],
      name: 'Existing',
      active: true,
    });
    await expect(
      provisionFacility(medplum, {
        facilityName: 'Should Fail',
        country: 'HN',
        facilityType: 'clinic',
        adminEmail: 'admin@test.example',
        seedCountryProfile: false,
      }),
    ).rejects.toThrow(/already exists/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/provision-facility.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `scripts/provision-facility.ts`**

```typescript
import type { MedplumClient } from '@medplum/core';
import {
  EXT_COUNTRY,
  EXT_FACILITY_TYPE,
  EXT_MODULE_ENABLED,
} from '../src/config/extensionUrls';
import { getFacilityType } from '../src/config/facility-types';
import type { CountryCode, FacilityTypeId } from '../src/config/types';
import { createScriptMedplumClient } from './lib/medplumClient';

export interface ProvisionInput {
  facilityName: string;
  country: CountryCode;
  facilityType: FacilityTypeId;
  adminEmail: string;
  /** When true, run the country-profile sync into this facility after creating it. */
  seedCountryProfile: boolean;
}

export async function provisionFacility(
  medplum: MedplumClient,
  input: ProvisionInput,
): Promise<void> {
  // 1. Refuse if emr-settings Organization already exists
  const existing = await medplum.search('Organization', { identifier: 'emr-settings' });
  if (existing.entry && existing.entry.length > 0) {
    throw new Error(
      `Facility already exists: emr-settings Organization is present in this Project`,
    );
  }

  // 2. Create the emr-settings Organization with country, facility-type, and default modules
  const facilityType = getFacilityType(input.facilityType);
  const moduleExtensions = facilityType.defaultEnabledModules.map((moduleId) => ({
    url: EXT_MODULE_ENABLED,
    valueCode: moduleId,
  }));

  await medplum.createResource({
    resourceType: 'Organization',
    identifier: [{ system: 'http://medplum.com/emr', value: 'emr-settings' }],
    name: input.facilityName,
    active: true,
    extension: [
      { url: EXT_COUNTRY, valueCode: input.country },
      { url: EXT_FACILITY_TYPE, valueCode: input.facilityType },
      ...moduleExtensions,
    ],
  });

  // 3. AccessPolicy creation, admin user creation, and country-profile seeding are
  //    delegated to subsequent functions composed by the CLI entrypoint. They are
  //    side-effecting against a real Medplum server and tested via separate tasks.
}

// CLI entrypoint
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const facilityName = get('--name');
  const country = (get('--country') ?? 'HN') as CountryCode;
  const facilityType = (get('--type') ?? 'clinic') as FacilityTypeId;
  const adminEmail = get('--admin-email');
  if (!facilityName || !adminEmail) {
    console.error(
      'Usage: provision-facility --name <name> --admin-email <email> [--country HN] [--type clinic]',
    );
    process.exit(1);
  }
  const medplum = await createScriptMedplumClient();
  await provisionFacility(medplum, {
    facilityName,
    country,
    facilityType,
    adminEmail,
    seedCountryProfile: true,
  });
  console.log(`Provisioned facility "${facilityName}"`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Add npm script in `package.json`**

Add under `"scripts"`:

```json
"provision:facility": "tsx scripts/provision-facility.ts"
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run scripts/provision-facility.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add scripts/provision-facility.ts scripts/provision-facility.test.ts package.json
git commit -m "feat(scripts): provision-facility creates emr-settings with defaults"
```

---

### Task 15: Sync script — country profile fan-out with --dry-run

**Files:**
- Create: `scripts/sync-country-profile.ts`
- Create: `scripts/sync-country-profile.test.ts`
- Modify: `package.json` — add `sync:country` npm script

- [ ] **Step 1: Write the failing test**

`scripts/sync-country-profile.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { MockClient } from '@medplum/mock';
import { syncCountryProfile, SyncTarget } from './sync-country-profile';
import { COUNTRY_PROFILE_LIBRARY_URL } from '../src/config/extensionUrls';

function createMasterWithLibrary(): MockClient {
  const master = new MockClient();
  void master.createResource({
    resourceType: 'Library',
    url: COUNTRY_PROFILE_LIBRARY_URL('HN'),
    status: 'active',
    version: '2026.05',
    relatedArtifact: [],
  });
  return master;
}

describe('syncCountryProfile', () => {
  it('previews changes in --dry-run without writing to facilities', async () => {
    const master = createMasterWithLibrary();
    const facility = new MockClient();
    const targets: SyncTarget[] = [{ name: 'Test Facility', client: facility }];
    const log = vi.fn();
    await syncCountryProfile(master, 'HN', targets, { dryRun: true, log });
    const facilityLibs = await facility.search('Library', { _count: '10' });
    expect(facilityLibs.entry?.length ?? 0).toBe(0);
    expect(log).toHaveBeenCalled();
  });

  it('writes the master Library to each facility on actual sync', async () => {
    const master = createMasterWithLibrary();
    const facility = new MockClient();
    const targets: SyncTarget[] = [{ name: 'Test Facility', client: facility }];
    await syncCountryProfile(master, 'HN', targets, { dryRun: false, log: () => {} });
    const facilityLibs = await facility.search('Library', {
      url: COUNTRY_PROFILE_LIBRARY_URL('HN'),
    });
    expect(facilityLibs.entry?.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/sync-country-profile.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `scripts/sync-country-profile.ts`**

```typescript
import type { MedplumClient } from '@medplum/core';
import type {
  Library,
  Questionnaire,
  Measure,
  CodeSystem,
  ValueSet,
  Resource,
} from '@medplum/fhirtypes';
import { COUNTRY_PROFILE_LIBRARY_URL } from '../src/config/extensionUrls';
import type { CountryCode } from '../src/config/types';

export interface SyncTarget {
  name: string;
  client: MedplumClient;
}

export interface SyncOptions {
  dryRun: boolean;
  log: (msg: string) => void;
}

/**
 * Pushes the canonical country-profile resources (Library + referenced Questionnaire,
 * Measure, CodeSystem, ValueSet) from the master client into every target facility client.
 * Idempotent — running twice with no master changes produces no facility changes.
 */
export async function syncCountryProfile(
  master: MedplumClient,
  country: CountryCode,
  targets: SyncTarget[],
  options: SyncOptions,
): Promise<void> {
  const libUrl = COUNTRY_PROFILE_LIBRARY_URL(country);
  const masterLibRes = await master.search('Library', { url: libUrl, _count: '1' });
  const library = masterLibRes.entry?.[0]?.resource as Library | undefined;
  if (!library) {
    throw new Error(`No Library found for country ${country} in master Project`);
  }
  options.log(`Master Library version: ${library.version ?? '(none)'}`);

  const refs = (library.relatedArtifact ?? [])
    .filter((r) => r.type === 'depends-on' && r.resource)
    .map((r) => r.resource as string);

  // Resolve referenced artifacts in the master Project
  const artifacts: Resource[] = [];
  for (const url of refs) {
    const found = await findFirstByUrl(master, url);
    if (found) artifacts.push(found);
    else options.log(`  WARN: reference ${url} not resolved in master`);
  }

  for (const target of targets) {
    options.log(`\nFacility: ${target.name}`);
    if (options.dryRun) {
      options.log(`  [dry-run] would write Library ${libUrl} version ${library.version}`);
      for (const a of artifacts) {
        options.log(`  [dry-run] would write ${a.resourceType} ${(a as Library).url}`);
      }
      continue;
    }
    await upsertByUrl(target.client, library);
    for (const a of artifacts) {
      await upsertByUrl(target.client, a);
    }
    options.log(`  synced Library + ${artifacts.length} artifact(s)`);
  }
}

async function findFirstByUrl(
  client: MedplumClient,
  url: string,
): Promise<Resource | undefined> {
  for (const type of ['Library', 'Questionnaire', 'Measure', 'CodeSystem', 'ValueSet']) {
    const res = await client.search(type, { url, _count: '1' });
    const r = res.entry?.[0]?.resource;
    if (r) return r as Resource;
  }
  return undefined;
}

async function upsertByUrl(client: MedplumClient, resource: Resource): Promise<void> {
  const url = (resource as Library | Questionnaire | Measure | CodeSystem | ValueSet).url;
  if (!url) {
    throw new Error(`Resource ${resource.resourceType} has no url; cannot upsert`);
  }
  const existing = await client.search(resource.resourceType, { url, _count: '1' });
  const found = existing.entry?.[0]?.resource;
  if (found) {
    await client.updateResource({ ...resource, id: found.id });
  } else {
    await client.createResource({ ...resource, id: undefined });
  }
}
```

- [ ] **Step 4: Add CLI entrypoint at the end of the file**

Append to `scripts/sync-country-profile.ts`:

```typescript
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const country = (args.find((a) => /^[A-Z]{2}$/.test(a)) ?? 'HN') as CountryCode;
  console.error(
    'sync-country-profile CLI scaffold — connect to real master + facility clients in your operator harness.',
  );
  console.error(`Country: ${country}, dry-run: ${dryRun}`);
  // Real wiring: load master client, enumerate facility Project IDs, construct one
  // MedplumClient per facility (project-scoped), then call syncCountryProfile().
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 5: Add npm script in `package.json`**

```json
"sync:country": "tsx scripts/sync-country-profile.ts"
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run scripts/sync-country-profile.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add scripts/sync-country-profile.ts scripts/sync-country-profile.test.ts package.json
git commit -m "feat(scripts): sync-country-profile with --dry-run and idempotent upsert"
```

---

### Task 16: AccessPolicy enforcement test

**Files:**
- Create: `scripts/access-policy-enforcement.test.ts`

This task documents the AccessPolicy *intent* via integration-style tests against `MockClient`. `MockClient` does not enforce real Medplum AccessPolicies, so these tests assert the SHAPE of the policy resource the provisioning script must create. A separate end-to-end check against a live Medplum server is required before going to production (see Task 28).

- [ ] **Step 1: Write the test capturing required policy shape**

`scripts/access-policy-enforcement.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { facilityAdminAccessPolicy } from './lib/accessPolicies';

describe('facility admin AccessPolicy', () => {
  it('explicitly denies write to country-profile artifact resource types', () => {
    const policy = facilityAdminAccessPolicy();
    const deniedTypes = policy.resource
      ?.filter((r) => r.readonly === true)
      .map((r) => r.resourceType) ?? [];
    expect(deniedTypes).toEqual(
      expect.arrayContaining(['Library', 'Questionnaire', 'Measure', 'CodeSystem', 'ValueSet']),
    );
  });

  it('explicitly denies write to Basic resources matching the country-profile profile', () => {
    const policy = facilityAdminAccessPolicy();
    const basicRule = policy.resource?.find((r) => r.resourceType === 'Basic');
    expect(basicRule?.readonly).toBe(true);
  });
});
```

- [ ] **Step 2: Create `scripts/lib/accessPolicies.ts` with the policy factory**

```typescript
import type { AccessPolicy } from '@medplum/fhirtypes';

/**
 * Returns the AccessPolicy that must be applied to facility admin users.
 * Marks country-profile artifact resource types as read-only — facility admins
 * cannot mutate them. They can read everything in their Project, but the master
 * Project is the only place these resources are authored.
 */
export function facilityAdminAccessPolicy(): AccessPolicy {
  return {
    resourceType: 'AccessPolicy',
    name: 'HopeEMRFacilityAdmin',
    resource: [
      // Read-write resources (typical clinical/admin work)
      { resourceType: 'Patient' },
      { resourceType: 'Encounter' },
      { resourceType: 'Observation' },
      { resourceType: 'Condition' },
      { resourceType: 'MedicationRequest' },
      { resourceType: 'MedicationStatement' },
      { resourceType: 'ServiceRequest' },
      { resourceType: 'DiagnosticReport' },
      { resourceType: 'Task' },
      { resourceType: 'Appointment' },
      { resourceType: 'Schedule' },
      { resourceType: 'Slot' },
      { resourceType: 'Provenance' },
      { resourceType: 'ChargeItem' },
      { resourceType: 'PaymentReconciliation' },
      { resourceType: 'Account' },
      { resourceType: 'Organization' }, // emr-settings lives here
      { resourceType: 'Practitioner' },
      { resourceType: 'PractitionerRole' },
      { resourceType: 'Location' },

      // Read-only — country-profile artifacts owned by the master Project
      { resourceType: 'Library', readonly: true },
      { resourceType: 'Questionnaire', readonly: true },
      { resourceType: 'Measure', readonly: true },
      { resourceType: 'CodeSystem', readonly: true },
      { resourceType: 'ValueSet', readonly: true },
      { resourceType: 'Basic', readonly: true },
    ],
  };
}
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx vitest run scripts/access-policy-enforcement.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 4: Wire AccessPolicy creation into provisioning**

Modify `scripts/provision-facility.ts` to also create the AccessPolicy resource and attach it to the admin's `ProjectMembership` after the Organization is created. Add this code immediately after the `medplum.createResource({ resourceType: 'Organization', ... })` call:

```typescript
import { facilityAdminAccessPolicy } from './lib/accessPolicies';

// ... after Organization creation ...

const policy = await medplum.createResource(facilityAdminAccessPolicy());
// NOTE: attaching the policy to admin user ProjectMembership.access is a Medplum
// admin-API call that requires a privileged client. The CLI entrypoint logs the
// policy ID and instructs the operator to attach it via the Medplum admin console
// when running against a real server. This keeps the test against MockClient simple.
console.log(`Created AccessPolicy: ${policy.id}`);
```

- [ ] **Step 5: Re-run all script tests**

Run: `npx vitest run scripts/`
Expected: PASS for all tests.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/accessPolicies.ts scripts/access-policy-enforcement.test.ts scripts/provision-facility.ts
git commit -m "feat(scripts): facility admin AccessPolicy with country-profile read-only"
```

---

## Phase 6 — Wire UI to config

### Task 17: Extend settings.ts with new extension helpers

**Files:**
- Modify: `src/utils/settings.ts`
- Create: `src/utils/settings.test.ts`

- [ ] **Step 1: Read current `src/utils/settings.ts`**

Run: `cat src/utils/settings.ts`

Expected: existing `getEMRSettings`, `saveEMRSettings`, `getWorkflowConfiguration`, `saveWorkflowConfiguration`.

- [ ] **Step 2: Write failing tests for the new helpers**

`src/utils/settings.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { MockClient } from '@medplum/mock';
import {
  getFreeClinicMode,
  setFreeClinicMode,
  getEnabledModules,
  setEnabledModules,
} from './settings';

async function seedSettings(medplum: MockClient): Promise<void> {
  await medplum.createResource({
    resourceType: 'Organization',
    identifier: [{ system: 'http://medplum.com/emr', value: 'emr-settings' }],
    name: 'Test',
    active: true,
  });
}

describe('free clinic mode', () => {
  it('defaults to false when not set', async () => {
    const medplum = new MockClient();
    await seedSettings(medplum);
    expect(await getFreeClinicMode(medplum)).toBe(false);
  });

  it('round-trips a true setting', async () => {
    const medplum = new MockClient();
    await seedSettings(medplum);
    await setFreeClinicMode(medplum, true);
    expect(await getFreeClinicMode(medplum)).toBe(true);
  });
});

describe('enabled modules', () => {
  it('returns empty array when no module-enabled extensions exist', async () => {
    const medplum = new MockClient();
    await seedSettings(medplum);
    expect(await getEnabledModules(medplum)).toEqual([]);
  });

  it('round-trips imaging and departments', async () => {
    const medplum = new MockClient();
    await seedSettings(medplum);
    await setEnabledModules(medplum, ['imaging', 'departments']);
    const result = await getEnabledModules(medplum);
    expect(result).toEqual(expect.arrayContaining(['imaging', 'departments']));
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/utils/settings.test.ts`
Expected: FAIL — exports not found.

- [ ] **Step 4: Add new helpers to `src/utils/settings.ts`**

Append to `src/utils/settings.ts`:

```typescript
import {
  EXT_FREE_CLINIC_MODE,
  EXT_MODULE_ENABLED,
} from '../config/extensionUrls';
import type { ModuleId } from '../config/types';

async function getOrCreateSettingsOrg(medplum: MedplumClient): Promise<Organization> {
  const result = await medplum.search('Organization', {
    identifier: SETTINGS_ORG_IDENTIFIER,
    _count: '1',
  });
  const found = result.entry?.[0]?.resource as Organization | undefined;
  if (found) return found;
  return await medplum.createResource({
    resourceType: 'Organization',
    identifier: [{ system: 'http://medplum.com/emr', value: SETTINGS_ORG_IDENTIFIER }],
    name: 'HopeEMR',
    active: true,
  });
}

export async function getFreeClinicMode(medplum: MedplumClient): Promise<boolean> {
  const org = await getOrCreateSettingsOrg(medplum);
  return (
    org.extension?.find((e) => e.url === EXT_FREE_CLINIC_MODE)?.valueBoolean ?? false
  );
}

export async function setFreeClinicMode(
  medplum: MedplumClient,
  value: boolean,
): Promise<void> {
  const org = await getOrCreateSettingsOrg(medplum);
  const others = (org.extension ?? []).filter((e) => e.url !== EXT_FREE_CLINIC_MODE);
  await medplum.updateResource({
    ...org,
    extension: [...others, { url: EXT_FREE_CLINIC_MODE, valueBoolean: value }],
  });
}

export async function getEnabledModules(medplum: MedplumClient): Promise<ModuleId[]> {
  const org = await getOrCreateSettingsOrg(medplum);
  return (org.extension ?? [])
    .filter((e) => e.url === EXT_MODULE_ENABLED)
    .map((e) => e.valueCode as ModuleId)
    .filter((id): id is ModuleId => Boolean(id));
}

export async function setEnabledModules(
  medplum: MedplumClient,
  modules: ModuleId[],
): Promise<void> {
  const org = await getOrCreateSettingsOrg(medplum);
  const others = (org.extension ?? []).filter((e) => e.url !== EXT_MODULE_ENABLED);
  const moduleExts = modules.map((m) => ({ url: EXT_MODULE_ENABLED, valueCode: m }));
  await medplum.updateResource({
    ...org,
    extension: [...others, ...moduleExts],
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/utils/settings.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/utils/settings.ts src/utils/settings.test.ts
git commit -m "feat(settings): add free-clinic-mode and enabled-modules helpers"
```

---

### Task 18: Wrap Imaging and Departments/Beds routes with `<RequireModule>`

**Files:**
- Modify: `src/EMRApp.tsx`

- [ ] **Step 1: Add `<RequireModule>` import to `src/EMRApp.tsx`**

```typescript
import { RequireModule } from './components/shared/Module';
```

- [ ] **Step 2: Wrap the `/admin/imaging-tests` route**

Find the existing `<Route path="/admin/imaging-tests" ...>` and replace its element with:

```tsx
<Route
  path="/admin/imaging-tests"
  element={
    <RequireModule id="imaging" fallback="/">
      <RequireAdmin membership={membership!}>
        <Container fluid size="100%" className={styles.pageContainer} m={0}>
          <ImagingTestsPage />
        </Container>
      </RequireAdmin>
    </RequireModule>
  }
/>
```

- [ ] **Step 3: Wrap the `/admin/departments` and `/admin/beds` routes**

```tsx
<Route
  path="/admin/departments"
  element={
    <RequireModule id="departments" fallback="/">
      <RequireAdmin membership={membership!}>
        <Container fluid size="100%" className={styles.pageContainer} m={0}>
          <DepartmentsPage />
        </Container>
      </RequireAdmin>
    </RequireModule>
  }
/>
<Route
  path="/admin/beds"
  element={
    <RequireModule id="departments" fallback="/">
      <RequireAdmin membership={membership!}>
        <Container fluid size="100%" className={styles.pageContainer} m={0}>
          <BedsPage />
        </Container>
      </RequireAdmin>
    </RequireModule>
  }
/>
```

- [ ] **Step 4: Run typecheck and dev server**

Run: `npm run build`
Expected: clean compile.

Run: `npm run dev`. In the browser, with default config, navigate to `/admin/imaging-tests`. Expected: page renders. Then disable the imaging module via FHIR (manually delete the `module-enabled: imaging` extension on the `emr-settings` Organization in the Medplum admin console) and revisit. Expected: redirected to `/`.

- [ ] **Step 5: Commit**

```bash
git add src/EMRApp.tsx
git commit -m "feat(routes): gate imaging and departments admin routes with <RequireModule>"
```

---

### Task 19: Update Header.tsx nav for module visibility

**Files:**
- Modify: `src/components/shared/Header.tsx`

- [ ] **Step 1: Add `useConfig` import to `src/components/shared/Header.tsx`**

```typescript
import { useConfig } from '../../config/ConfigContext';
```

- [ ] **Step 2: Read current config in the Header component**

Inside the `Header` function, after the existing `const flags = useFeatureFlags();`:

```typescript
const config = useConfig();
```

- [ ] **Step 3: Gate Imaging-related nav items**

Find the Imaging Tests menu item (probably under Admin menu) and wrap with a conditional:

```tsx
{config.modules.imaging.enabled && flags.canManageImagingTests && (
  <Menu.Item leftSection={<IconPhoto size={14} />} onClick={() => navigate('/admin/imaging-tests')}>
    {t('admin.imagingTests', 'Imaging Tests')}
  </Menu.Item>
)}
```

- [ ] **Step 4: Gate Departments and Beds nav items**

```tsx
{config.modules.departments.enabled && flags.canManageDepartments && (
  <Menu.Item leftSection={<IconBuildingHospital size={14} />} onClick={() => navigate('/admin/departments')}>
    {t('admin.departments', 'Departments')}
  </Menu.Item>
)}
{config.modules.departments.enabled && flags.canManageBeds && (
  <Menu.Item leftSection={<IconBed size={14} />} onClick={() => navigate('/admin/beds')}>
    {t('admin.beds', 'Beds')}
  </Menu.Item>
)}
```

- [ ] **Step 5: Run typecheck and dev**

Run: `npm run build`
Expected: clean compile.

Run: `npm run dev`. With imaging disabled (manually via Medplum console), confirm the imaging menu item is hidden.

- [ ] **Step 6: Commit**

```bash
git add src/components/shared/Header.tsx
git commit -m "feat(header): gate imaging and departments nav by module config"
```

---

### Task 20: Add Modules section to SettingsPage

**Files:**
- Modify: `src/pages/admin/SettingsPage.tsx`
- Modify: `src/i18n/en.json`, `src/i18n/es.json`

- [ ] **Step 1: Add translation keys**

In `src/i18n/en.json`, add under `admin.settings`:

```json
"modulesTitle": "Modules",
"modulesAvailable": "Available Modules",
"modulesUnavailable": "Hospital-only Modules",
"modulesUnavailableMessage": "Available in Hospital facility type only. Contact HopeEMR support to upgrade your facility.",
"moduleImaging": "Imaging",
"moduleImagingDescription": "Order imaging studies and view results",
"moduleDepartments": "Departments & Beds",
"moduleDepartmentsDescription": "Manage physical departments and bed assignments",
"moduleInpatient": "Inpatient (MAR, Admissions)",
"moduleInpatientDescription": "Inpatient encounter type, admission ordersets, MAR, ward management"
```

In `src/i18n/es.json`, add the same keys with Spanish values.

- [ ] **Step 2: Read current `src/pages/admin/SettingsPage.tsx`**

Run: `cat src/pages/admin/SettingsPage.tsx`

Familiarize with structure (it uses Mantine).

- [ ] **Step 3: Add a Modules section to SettingsPage**

Add imports at top:

```typescript
import { useConfig, notifyConfigChanged } from '../../config/ConfigContext';
import { getEnabledModules, setEnabledModules } from '../../utils/settings';
import { getFacilityType } from '../../config/facility-types';
import type { ModuleId } from '../../config/types';
import { Switch, Text, Stack, Divider } from '@mantine/core';
```

Add a Modules card (somewhere appropriate in the existing form layout):

```tsx
function ModulesCard(): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const config = useConfig();
  const facilityType = getFacilityType(config.facilityType);
  const ceiling = facilityType.availableModules;

  // For phase 1, the only Hospital-only module surfaced as a teaser is 'inpatient'
  const hospitalOnlyTeaserModules: ModuleId[] = ['inpatient'];

  const handleToggle = async (moduleId: ModuleId, next: boolean): Promise<void> => {
    const current = await getEnabledModules(medplum);
    const setOf = new Set(current);
    if (next) setOf.add(moduleId);
    else setOf.delete(moduleId);
    await setEnabledModules(medplum, Array.from(setOf));
    notifyConfigChanged();
  };

  return (
    <Stack gap="sm">
      <Text fw={600}>{t('admin.settings.modulesAvailable', 'Available Modules')}</Text>
      {ceiling.map((moduleId) => (
        <Switch
          key={moduleId}
          checked={config.modules[moduleId].enabled}
          onChange={(e) => handleToggle(moduleId, e.currentTarget.checked)}
          label={t(`admin.settings.module${capitalize(moduleId)}`, moduleId)}
          description={t(
            `admin.settings.module${capitalize(moduleId)}Description`,
            '',
          )}
        />
      ))}

      <Divider />

      <Text fw={600}>{t('admin.settings.modulesUnavailable', 'Hospital-only Modules')}</Text>
      {hospitalOnlyTeaserModules.map((moduleId) => (
        <Stack key={moduleId} gap={2}>
          <Text c="dimmed">
            {t(`admin.settings.module${capitalize(moduleId)}`, moduleId)}
          </Text>
          <Text size="xs" c="dimmed">
            {t(
              'admin.settings.modulesUnavailableMessage',
              'Available in Hospital facility type only. Contact HopeEMR support to upgrade your facility.',
            )}
          </Text>
        </Stack>
      ))}
    </Stack>
  );
}

function capitalize(s: string): string {
  // 'admission-ordersets' -> 'AdmissionOrdersets'
  return s
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}
```

Then mount `<ModulesCard />` in the existing SettingsPage layout (under a heading like "Modules").

- [ ] **Step 4: Run typecheck and dev**

Run: `npm run build`
Expected: clean compile.

Run: `npm run dev`. Sign in as admin. Visit `/admin/settings`. Expected: Modules section appears with two toggles (Imaging, Departments) and one greyed-out teaser (Inpatient). Toggling Imaging off and reloading the page should hide the imaging admin link in the header.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/SettingsPage.tsx src/i18n/en.json src/i18n/es.json
git commit -m "feat(settings): Modules section with toggles and Hospital-only teaser"
```

---

### Task 21: Add Free Clinic Mode toggle to SettingsPage

**Files:**
- Modify: `src/pages/admin/SettingsPage.tsx`
- Modify: `src/i18n/en.json`, `src/i18n/es.json`

- [ ] **Step 1: Add translation keys**

In `src/i18n/en.json` under `admin.settings`:

```json
"freeClinicModeTitle": "Free Clinic Mode",
"freeClinicModeDescription": "When enabled, new encounters default to no-charge. Existing encounters are unaffected.",
"freeClinicModeOn": "Free Clinic Mode is currently ON"
```

Spanish equivalents in `es.json`.

- [ ] **Step 2: Add the toggle component**

Append to `src/pages/admin/SettingsPage.tsx`:

```tsx
function FreeClinicModeCard(): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const config = useConfig();

  const handleChange = async (next: boolean): Promise<void> => {
    await setFreeClinicMode(medplum, next);
    notifyConfigChanged();
  };

  return (
    <Stack gap="sm">
      <Text fw={600}>{t('admin.settings.freeClinicModeTitle', 'Free Clinic Mode')}</Text>
      <Text size="sm" c="dimmed">
        {t(
          'admin.settings.freeClinicModeDescription',
          'When enabled, new encounters default to no-charge. Existing encounters are unaffected.',
        )}
      </Text>
      <Switch
        checked={config.freeClinicMode}
        onChange={(e) => handleChange(e.currentTarget.checked)}
        label={
          config.freeClinicMode
            ? t('admin.settings.freeClinicModeOn', 'Free Clinic Mode is currently ON')
            : t('admin.settings.freeClinicModeTitle', 'Free Clinic Mode')
        }
      />
    </Stack>
  );
}
```

Add import at top:

```typescript
import { setFreeClinicMode } from '../../utils/settings';
```

Mount `<FreeClinicModeCard />` in the SettingsPage layout (e.g., adjacent to the Modules card).

- [ ] **Step 3: Verify in dev**

Run: `npm run dev`. Toggle Free Clinic Mode on. Reload. Toggle should remain on.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/SettingsPage.tsx src/i18n/en.json src/i18n/es.json
git commit -m "feat(settings): Free Clinic Mode toggle"
```

---

## Phase 7 — Per-encounter charge status

### Task 22: Charge-status helpers + Provenance audit

**Files:**
- Create: `src/utils/chargeStatus.ts`
- Create: `src/utils/chargeStatus.test.ts`
- Modify: `src/utils/permissions.ts` — add `OVERRIDE_CHARGE_STATUS_POST_CHARGE`

- [ ] **Step 1: Add the new permission**

In `src/utils/permissions.ts`, find the `Permission` enum and add:

```typescript
OVERRIDE_CHARGE_STATUS_POST_CHARGE = 'override_charge_status_post_charge',
```

In the `ROLE_PERMISSIONS` map, this is automatically included for `ADMIN` (which gets `...Object.values(Permission)`). Add it explicitly to other roles only if intended; do NOT grant to PROVIDER, NURSE, etc.

- [ ] **Step 2: Write the failing test**

`src/utils/chargeStatus.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { MockClient } from '@medplum/mock';
import {
  getChargeStatus,
  setChargeStatus,
  ChargeStatus,
  hasChargeItems,
} from './chargeStatus';

async function makeEncounter(medplum: MockClient, status: 'in-progress' | 'finished' = 'in-progress') {
  return medplum.createResource({
    resourceType: 'Encounter',
    status,
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
  });
}

describe('chargeStatus', () => {
  it('defaults to "standard" when no extension exists', async () => {
    const medplum = new MockClient();
    const enc = await makeEncounter(medplum);
    expect(getChargeStatus(enc)).toBe('standard');
  });

  it('round-trips no-charge with reason and emits a Provenance', async () => {
    const medplum = new MockClient();
    const enc = await makeEncounter(medplum);
    await setChargeStatus(medplum, enc.id!, 'no-charge', 'Free Clinic Day');

    const reloaded = await medplum.readResource('Encounter', enc.id!);
    expect(getChargeStatus(reloaded)).toBe('no-charge');

    const provs = await medplum.search('Provenance', { target: `Encounter/${enc.id}` });
    expect(provs.entry?.length ?? 0).toBeGreaterThanOrEqual(1);
  });

  it('rejects no-charge without a reason', async () => {
    const medplum = new MockClient();
    const enc = await makeEncounter(medplum);
    await expect(
      setChargeStatus(medplum, enc.id!, 'no-charge' as ChargeStatus, ''),
    ).rejects.toThrow(/reason is required/);
  });

  it('hasChargeItems returns true when ChargeItem exists for the encounter', async () => {
    const medplum = new MockClient();
    const enc = await makeEncounter(medplum);
    expect(await hasChargeItems(medplum, enc.id!)).toBe(false);
    await medplum.createResource({
      resourceType: 'ChargeItem',
      status: 'billable',
      code: { text: 'Office visit' },
      subject: { reference: `Patient/test` },
      context: { reference: `Encounter/${enc.id}` },
    });
    expect(await hasChargeItems(medplum, enc.id!)).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/utils/chargeStatus.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Create `src/utils/chargeStatus.ts`**

```typescript
import type { MedplumClient } from '@medplum/core';
import type { Encounter, Provenance } from '@medplum/fhirtypes';
import { EXT_CHARGE_STATUS, EXT_CHARGE_STATUS_REASON } from '../config/extensionUrls';

export type ChargeStatus = 'standard' | 'no-charge' | 'scholarship';

export function getChargeStatus(encounter: Encounter): ChargeStatus {
  const code =
    encounter.extension?.find((e) => e.url === EXT_CHARGE_STATUS)?.valueCode ?? 'standard';
  return (['standard', 'no-charge', 'scholarship'] as ChargeStatus[]).includes(
    code as ChargeStatus,
  )
    ? (code as ChargeStatus)
    : 'standard';
}

export function getChargeStatusReason(encounter: Encounter): string | undefined {
  return encounter.extension?.find((e) => e.url === EXT_CHARGE_STATUS_REASON)?.valueString;
}

export async function setChargeStatus(
  medplum: MedplumClient,
  encounterId: string,
  status: ChargeStatus,
  reason: string,
): Promise<void> {
  if (status !== 'standard' && !reason.trim()) {
    throw new Error('reason is required when chargeStatus is not "standard"');
  }
  const encounter = await medplum.readResource('Encounter', encounterId);
  const previousStatus = getChargeStatus(encounter);
  const others = (encounter.extension ?? []).filter(
    (e) => e.url !== EXT_CHARGE_STATUS && e.url !== EXT_CHARGE_STATUS_REASON,
  );
  const next: typeof encounter.extension = [
    ...others,
    { url: EXT_CHARGE_STATUS, valueCode: status },
  ];
  if (status !== 'standard') {
    next.push({ url: EXT_CHARGE_STATUS_REASON, valueString: reason });
  }
  await medplum.updateResource({ ...encounter, extension: next });

  // Provenance audit
  const profile = medplum.getProfile();
  const provenance: Provenance = {
    resourceType: 'Provenance',
    target: [{ reference: `Encounter/${encounterId}` }],
    recorded: new Date().toISOString(),
    activity: {
      coding: [
        {
          system: 'http://hopeemr.org/fhir/CodeSystem/charge-status-change',
          code: `${previousStatus}->${status}`,
        },
      ],
      text: `Charge status changed from ${previousStatus} to ${status}: ${reason}`,
    },
    agent: [
      {
        who: profile ? { reference: `${profile.resourceType}/${profile.id}` } : { display: 'unknown' },
      },
    ],
  };
  await medplum.createResource(provenance);
}

export async function hasChargeItems(
  medplum: MedplumClient,
  encounterId: string,
): Promise<boolean> {
  const result = await medplum.search('ChargeItem', {
    context: `Encounter/${encounterId}`,
    _count: '1',
  });
  return (result.entry?.length ?? 0) > 0;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/utils/chargeStatus.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/utils/chargeStatus.ts src/utils/chargeStatus.test.ts src/utils/permissions.ts
git commit -m "feat(charge-status): helpers with Provenance audit and reason validation"
```

---

### Task 23: Charge-status chip on EncounterHeader (read + write + auth)

**Files:**
- Modify: `src/components/encounter/EncounterHeader.tsx`
- Modify: `src/i18n/en.json`, `src/i18n/es.json`

- [ ] **Step 1: Add translations**

In `src/i18n/en.json` under `encounter`:

```json
"chargeStatus": {
  "standard": "Standard",
  "noCharge": "No Charge",
  "scholarship": "Scholarship",
  "changeTitle": "Change Charge Status",
  "reasonLabel": "Reason",
  "reasonPlaceholder": "e.g. Free clinic day, indigent patient",
  "lockedTooltip": "Charges have already been posted. An administrator must override.",
  "save": "Save"
}
```

Spanish equivalents.

- [ ] **Step 2: Read current `src/components/encounter/EncounterHeader.tsx`**

Run: `cat src/components/encounter/EncounterHeader.tsx`

Familiarize with where to mount the chip.

- [ ] **Step 3: Add a ChargeStatusChip subcomponent**

In `src/components/encounter/EncounterHeader.tsx`, add at the top (or as a new file `ChargeStatusChip.tsx` if you prefer):

```tsx
import { useState } from 'react';
import { Badge, Menu, Modal, Textarea, Button, Stack, Tooltip } from '@mantine/core';
import { useMedplum } from '@medplum/react';
import { useTranslation } from 'react-i18next';
import type { Encounter } from '@medplum/fhirtypes';
import {
  getChargeStatus,
  setChargeStatus,
  hasChargeItems,
  ChargeStatus,
} from '../../utils/chargeStatus';
import { usePermissions } from '../../hooks/usePermissions';
import { Permission } from '../../utils/permissions';
import { handleError } from '../../utils/errorHandling';

interface Props {
  encounter: Encounter;
  onChanged: () => void;
}

export function ChargeStatusChip({ encounter, onChanged }: Props): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const { hasPermission } = usePermissions();
  const [modalOpen, setModalOpen] = useState(false);
  const [target, setTarget] = useState<ChargeStatus>('standard');
  const [reason, setReason] = useState('');
  const [chargesPosted, setChargesPosted] = useState(false);
  const [loading, setLoading] = useState(false);

  const current = getChargeStatus(encounter);
  const canOverride = hasPermission(Permission.OVERRIDE_CHARGE_STATUS_POST_CHARGE);

  const openMenu = async (): Promise<void> => {
    if (!encounter.id) return;
    const has = await hasChargeItems(medplum, encounter.id);
    setChargesPosted(has);
  };

  const beginChange = (next: ChargeStatus): void => {
    setTarget(next);
    setReason('');
    setModalOpen(true);
  };

  const submit = async (): Promise<void> => {
    if (!encounter.id) return;
    try {
      setLoading(true);
      await setChargeStatus(medplum, encounter.id, target, reason);
      setModalOpen(false);
      onChanged();
    } catch (err) {
      handleError(err, 'updating charge status');
    } finally {
      setLoading(false);
    }
  };

  const locked = chargesPosted && !canOverride;
  const label = t(`encounter.chargeStatus.${camel(current)}`, current);

  const chipColor: Record<ChargeStatus, string> = {
    standard: 'gray',
    'no-charge': 'green',
    scholarship: 'blue',
  };

  const chip = (
    <Badge
      color={chipColor[current]}
      style={{ cursor: locked ? 'not-allowed' : 'pointer' }}
    >
      {label}
    </Badge>
  );

  return (
    <>
      <Menu shadow="md" width={220} onOpen={() => void openMenu()} disabled={locked}>
        <Menu.Target>
          {locked ? (
            <Tooltip label={t('encounter.chargeStatus.lockedTooltip', '')}>{chip}</Tooltip>
          ) : (
            <span>{chip}</span>
          )}
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item onClick={() => beginChange('standard')}>
            {t('encounter.chargeStatus.standard', 'Standard')}
          </Menu.Item>
          <Menu.Item onClick={() => beginChange('no-charge')}>
            {t('encounter.chargeStatus.noCharge', 'No Charge')}
          </Menu.Item>
          <Menu.Item onClick={() => beginChange('scholarship')}>
            {t('encounter.chargeStatus.scholarship', 'Scholarship')}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t('encounter.chargeStatus.changeTitle', 'Change Charge Status')}
      >
        <Stack>
          <Textarea
            label={t('encounter.chargeStatus.reasonLabel', 'Reason')}
            placeholder={t('encounter.chargeStatus.reasonPlaceholder', '')}
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
            required={target !== 'standard'}
          />
          <Button
            onClick={() => void submit()}
            loading={loading}
            disabled={target !== 'standard' && !reason.trim()}
          >
            {t('encounter.chargeStatus.save', 'Save')}
          </Button>
        </Stack>
      </Modal>
    </>
  );
}

function camel(s: ChargeStatus): string {
  return s === 'no-charge' ? 'noCharge' : s;
}
```

- [ ] **Step 4: Mount the chip in the header layout**

Find the existing `EncounterHeader` JSX and insert `<ChargeStatusChip encounter={encounter} onChanged={onEncounterChanged} />` near the top right (next to status / triage badges). The `onEncounterChanged` callback should re-fetch the encounter so the chip re-renders.

- [ ] **Step 5: Verify in dev**

Run: `npm run dev`. Open an encounter. Click the chip → menu → "No Charge" → enter reason → save. Reload the encounter — chip shows "No Charge". Check Medplum admin console: a `Provenance` resource targeting this encounter exists.

- [ ] **Step 6: Commit**

```bash
git add src/components/encounter/EncounterHeader.tsx src/i18n/en.json src/i18n/es.json
git commit -m "feat(encounter): charge-status chip with auth, reason, and Provenance"
```

---

### Task 24: Surface Free Clinic Mode default at encounter creation

**Files:**
- Modify: `src/components/encounter/NewEncounterModal.tsx`
- Modify: `src/i18n/en.json`, `src/i18n/es.json`

- [ ] **Step 1: Add translation**

In `src/i18n/en.json` under `encounter`:

```json
"chargeDefaultBanner": "This encounter will default to: {{label}}",
"freeClinicModeReason": "Free Clinic Mode active"
```

Spanish equivalent.

- [ ] **Step 2: Read `src/components/encounter/NewEncounterModal.tsx`**

Run: `cat src/components/encounter/NewEncounterModal.tsx`

- [ ] **Step 3: Show a banner when Free Clinic Mode is on**

Inside `NewEncounterModal`, near the top of the modal body, add:

```tsx
import { useConfig } from '../../config/ConfigContext';
import { Alert } from '@mantine/core';

// inside the component:
const config = useConfig();
{config.freeClinicMode && (
  <Alert color="green" mb="sm">
    {t('encounter.chargeDefaultBanner', 'This encounter will default to: {{label}}', {
      label: t('encounter.chargeStatus.noCharge', 'No Charge'),
    })}
    {' — '}
    {t('encounter.freeClinicModeReason', 'Free Clinic Mode active')}
  </Alert>
)}
```

- [ ] **Step 4: Apply the default to created encounter**

Find the `medplum.createResource({ resourceType: 'Encounter', ... })` call inside the submit handler and add the charge-status extensions when free clinic mode is active:

```tsx
import { EXT_CHARGE_STATUS, EXT_CHARGE_STATUS_REASON } from '../../config/extensionUrls';

// Inside submit handler, when building the new Encounter resource:
const extensions = [];
if (config.freeClinicMode) {
  extensions.push({ url: EXT_CHARGE_STATUS, valueCode: 'no-charge' });
  extensions.push({
    url: EXT_CHARGE_STATUS_REASON,
    valueString: t('encounter.freeClinicModeReason', 'Free Clinic Mode active'),
  });
}
const newEncounter = await medplum.createResource({
  resourceType: 'Encounter',
  // ... existing fields ...
  extension: extensions.length > 0 ? extensions : undefined,
});
```

**Important — timing edge case (per spec §6.4):** the default is captured at the moment of `createResource`. Encounters already in flight retain their original status. Do NOT loop through existing encounters when toggling Free Clinic Mode.

- [ ] **Step 5: Verify in dev**

Run: `npm run dev`. Toggle Free Clinic Mode on. Create a new encounter. Banner appears. After creation, the encounter's chip reads "No Charge" with reason "Free Clinic Mode active". Toggle off, create another encounter — no banner, default "Standard".

- [ ] **Step 6: Commit**

```bash
git add src/components/encounter/NewEncounterModal.tsx src/i18n/en.json src/i18n/es.json
git commit -m "feat(encounter): surface charge default and apply Free Clinic Mode at creation"
```

---

### Task 25: Free Clinic Mode timing edge-case test

**Files:**
- Create: `src/utils/freeClinicMode.test.ts`

This test asserts the timing behavior in §6.4 — toggling Free Clinic Mode does NOT retroactively change existing encounters.

- [ ] **Step 1: Create the test**

`src/utils/freeClinicMode.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { MockClient } from '@medplum/mock';
import { setFreeClinicMode } from './settings';
import { getChargeStatus } from './chargeStatus';

describe('Free Clinic Mode timing', () => {
  it('does not change existing encounters when toggled on', async () => {
    const medplum = new MockClient();
    await medplum.createResource({
      resourceType: 'Organization',
      identifier: [{ system: 'http://medplum.com/emr', value: 'emr-settings' }],
      name: 'Test',
      active: true,
    });
    const enc = await medplum.createResource({
      resourceType: 'Encounter',
      status: 'in-progress',
      class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
    });
    expect(getChargeStatus(enc)).toBe('standard');

    await setFreeClinicMode(medplum, true);

    const reloaded = await medplum.readResource('Encounter', enc.id!);
    expect(getChargeStatus(reloaded)).toBe('standard');
  });
});
```

- [ ] **Step 2: Run test**

Run: `npx vitest run src/utils/freeClinicMode.test.ts`
Expected: PASS (1 test).

- [ ] **Step 3: Commit**

```bash
git add src/utils/freeClinicMode.test.ts
git commit -m "test(free-clinic): assert toggling does not retroactively change encounters"
```

---

## Phase 8 — Billing integration and verification

### Task 26: Update billing to respect chargeStatus

**Files:**
- Modify: `src/utils/billing.ts`
- Modify (or create): `src/utils/billing.test.ts`

- [ ] **Step 1: Read current `src/utils/billing.ts`**

Run: `cat src/utils/billing.ts`

Identify the function(s) that create `ChargeItem` resources for an encounter.

- [ ] **Step 2: Write the failing test**

`src/utils/billing.test.ts` (append if exists, otherwise create):

```typescript
import { describe, it, expect } from 'vitest';
import { MockClient } from '@medplum/mock';
import { createChargeItemsForEncounter } from './billing'; // adjust to actual exported name
import { setChargeStatus } from './chargeStatus';

describe('createChargeItemsForEncounter', () => {
  it('creates a ChargeItem for a standard encounter', async () => {
    const medplum = new MockClient();
    const patient = await medplum.createResource({ resourceType: 'Patient' });
    const enc = await medplum.createResource({
      resourceType: 'Encounter',
      status: 'finished',
      class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
      subject: { reference: `Patient/${patient.id}` },
    });
    await createChargeItemsForEncounter(medplum, enc.id!, [
      { code: 'OFFICE_VISIT', amount: 100 },
    ]);
    const items = await medplum.search('ChargeItem', { context: `Encounter/${enc.id}` });
    expect(items.entry?.length).toBe(1);
  });

  it('skips ChargeItem creation for a no-charge encounter', async () => {
    const medplum = new MockClient();
    const patient = await medplum.createResource({ resourceType: 'Patient' });
    const enc = await medplum.createResource({
      resourceType: 'Encounter',
      status: 'finished',
      class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
      subject: { reference: `Patient/${patient.id}` },
    });
    await setChargeStatus(medplum, enc.id!, 'no-charge', 'Free Clinic Day');
    await createChargeItemsForEncounter(medplum, enc.id!, [
      { code: 'OFFICE_VISIT', amount: 100 },
    ]);
    const items = await medplum.search('ChargeItem', { context: `Encounter/${enc.id}` });
    expect(items.entry?.length ?? 0).toBe(0);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/utils/billing.test.ts`
Expected: FAIL — either function doesn't exist or doesn't skip on no-charge.

- [ ] **Step 4: Update `src/utils/billing.ts`**

Find the charge-item creation function and add a charge-status guard at the top:

```typescript
import { getChargeStatus } from './chargeStatus';

export async function createChargeItemsForEncounter(
  medplum: MedplumClient,
  encounterId: string,
  charges: Array<{ code: string; amount: number }>,
): Promise<void> {
  const encounter = await medplum.readResource('Encounter', encounterId);
  const status = getChargeStatus(encounter);
  if (status === 'no-charge' || status === 'scholarship') {
    logger.info(
      `Skipping ChargeItem creation for Encounter/${encounterId} — chargeStatus=${status}`,
    );
    return;
  }
  // ... existing ChargeItem creation logic ...
}
```

If the existing function name differs, adjust the test import and the implementation guard accordingly. The intent is: read the encounter's `chargeStatus` and skip the `ChargeItem` creation entirely when it is `no-charge` or `scholarship`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/utils/billing.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/utils/billing.ts src/utils/billing.test.ts
git commit -m "feat(billing): skip ChargeItem creation for no-charge/scholarship encounters"
```

---

### Task 27: Group billing reports by chargeStatus

**Files:**
- Modify: `src/utils/billing.ts` (add a reporting helper)

- [ ] **Step 1: Add reporting helper**

In `src/utils/billing.ts`, add a function:

```typescript
import type { ChargeStatus } from './chargeStatus';

export interface EncounterChargeStatusBreakdown {
  standard: number;
  noCharge: number;
  scholarship: number;
  totalEncounters: number;
}

export async function getEncounterChargeStatusBreakdown(
  medplum: MedplumClient,
  dateFrom: string,
  dateTo: string,
): Promise<EncounterChargeStatusBreakdown> {
  const result = await medplum.search('Encounter', {
    date: `ge${dateFrom}`,
    _count: '1000',
  });
  const breakdown: EncounterChargeStatusBreakdown = {
    standard: 0,
    noCharge: 0,
    scholarship: 0,
    totalEncounters: 0,
  };
  for (const e of result.entry ?? []) {
    const enc = e.resource;
    if (!enc) continue;
    breakdown.totalEncounters++;
    const status = getChargeStatus(enc as Encounter);
    if (status === 'standard') breakdown.standard++;
    else if (status === 'no-charge') breakdown.noCharge++;
    else if (status === 'scholarship') breakdown.scholarship++;
  }
  return breakdown;
}
```

(`getChargeStatus` is already imported from Task 26.)

- [ ] **Step 2: Add a test**

Append to `src/utils/billing.test.ts`:

```typescript
import { getEncounterChargeStatusBreakdown } from './billing';

describe('getEncounterChargeStatusBreakdown', () => {
  it('counts encounters per charge status', async () => {
    const medplum = new MockClient();
    const patient = await medplum.createResource({ resourceType: 'Patient' });
    const e1 = await medplum.createResource({
      resourceType: 'Encounter',
      status: 'finished',
      class: { system: 'x', code: 'AMB' },
      subject: { reference: `Patient/${patient.id}` },
      period: { start: '2026-05-01' },
    });
    const e2 = await medplum.createResource({
      resourceType: 'Encounter',
      status: 'finished',
      class: { system: 'x', code: 'AMB' },
      subject: { reference: `Patient/${patient.id}` },
      period: { start: '2026-05-02' },
    });
    await setChargeStatus(medplum, e2.id!, 'no-charge', 'Free clinic day');
    const result = await getEncounterChargeStatusBreakdown(
      medplum,
      '2026-05-01',
      '2026-05-31',
    );
    expect(result.standard).toBeGreaterThanOrEqual(1);
    expect(result.noCharge).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/utils/billing.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/utils/billing.ts src/utils/billing.test.ts
git commit -m "feat(billing): report breakdown by encounter charge status"
```

---

### Task 28: End-to-end verification on dev

This task is manual verification — no code changes. It validates every spec success criterion against a real running facility.

- [ ] **Step 1: Provision a test facility against your dev Medplum server**

```bash
export MEDPLUM_BASE_URL=https://your-dev-medplum.example/
export MEDPLUM_CLIENT_ID=...
export MEDPLUM_CLIENT_SECRET=...
npm run provision:facility -- --name "Dev Test Clinic" --admin-email admin@test.example
```

Expected: script prints "Provisioned facility 'Dev Test Clinic'" and an AccessPolicy ID.

- [ ] **Step 2: Sync the Honduras country profile into the new facility**

```bash
export HOPEEMR_MASTER_PROJECT_ID=...
npm run sync:country -- HN --dry-run
npm run sync:country -- HN
```

Expected: dry-run lists the artifacts that would be written; actual run writes them.

- [ ] **Step 3: Walk every module toggle**

Sign in to the dev app as the new admin. Visit `/admin/settings`.

- Toggle Imaging OFF. Reload. Confirm:
  - Imaging admin link no longer appears in the header
  - Visiting `/admin/imaging-tests` redirects to `/`
  - Imaging tab inside an encounter is gone (if applicable)
- Toggle Imaging ON. Reload. Confirm imaging surfaces are restored.
- Repeat for Departments / Beds.

- [ ] **Step 4: Walk Free Clinic Mode**

- Toggle Free Clinic Mode ON.
- Create a new encounter. Confirm the green banner appears at creation time.
- Confirm the new encounter's chip reads "No Charge".
- Open an encounter created BEFORE the toggle. Confirm its chip is unchanged.
- Toggle OFF. Create a new encounter. Confirm no banner; chip reads "Standard".

- [ ] **Step 5: Walk per-encounter charge status**

- On a "Standard" encounter, click the chip → "No Charge" → enter reason → save. Confirm the chip updates.
- In Medplum admin console, verify a `Provenance` resource exists targeting this encounter.
- Add a `ChargeItem` referencing this encounter via the admin console. Reload the encounter in the app. Confirm the chip is locked (cannot be changed) for non-admin users; admin users can still change it.

- [ ] **Step 6: Walk AccessPolicy enforcement**

- Sign in as the facility admin user.
- Attempt to update a `Library` resource via the Medplum console. Expected: denied.
- Attempt to update a `Questionnaire`. Expected: denied.
- This is the success criterion §12 #8 manual check.

- [ ] **Step 7: Document results**

Add a row to `.wolf/memory.md` summarizing the verification run, including any anomalies. If any step fails, file an issue or fix it before claiming the foundation is done.

---

## Phase 9 — Documentation

### Task 29: Update CLAUDE.md and `.wolf/cerebrum.md`

**Files:**
- Modify: `CLAUDE.md`
- Modify: `.wolf/cerebrum.md`

- [ ] **Step 1: Add a "Facility Configuration" section to `CLAUDE.md`**

In the project `CLAUDE.md`, add (under "Critical Utilities" or "Development Guidelines"):

```markdown
## Facility Configuration & Module Gating

HopeEMR is multi-tenant: one Medplum Project per facility. Facility-level config
and module enablement live in a four-layer model:

1. **Country Profile** (data, master Project) — regulatory artifacts (Library +
   Questionnaire/Measure/CodeSystem/ValueSet)
2. **FacilityType** (code, `src/config/facility-types/`) — Clinic only in phase 1
3. **Facility Config** (data, per-Project `emr-settings` Organization extensions)
4. **User Preferences** (deferred)

### Reading config in components

```tsx
import { useConfig, useModule } from '../config/ConfigContext';
import { Module, RequireModule } from '../components/shared/Module';

// Inline check
const config = useConfig();
if (config.modules.imaging.enabled) { ... }

// Component boundary
<Module id="imaging">
  <ImagingButton />
</Module>

// Route guard
<RequireModule id="imaging" fallback="/">
  <ImagingPage />
</RequireModule>
```

### Provisioning

Operator provisioning: `npm run provision:facility -- --name <name> --admin-email <email>`

Country-profile sync: `npm run sync:country -- HN [--dry-run]`

### Per-encounter charge status

Set via `src/utils/chargeStatus.ts`. Always creates a Provenance audit. Reason
required when status != 'standard'. Operator override required to change status
once a ChargeItem exists for the encounter.
```

- [ ] **Step 2: Add learnings to `.wolf/cerebrum.md`**

Append to the `## Key Learnings` section:

```markdown
### Facility Configuration Foundation
- Facility config = four layers (Country / FacilityType / Facility / User), resolved by `src/config/resolveConfig.ts`
- Module gating: use `<Module>` and `<RequireModule>` components — searchable via `git grep '<Module id='`
- Charge status on Encounter: extension `http://hopeemr.org/fhir/charge-status`; helpers in `src/utils/chargeStatus.ts`
- Free Clinic Mode toggle is operational state, NOT retroactive — affects only encounters created after toggle
- Country profile resources live in master Project (`hopeemr-system`), synced into facility Projects via `scripts/sync-country-profile.ts`
- Facility admins CANNOT write Library/Questionnaire/Measure/CodeSystem/ValueSet — enforced by AccessPolicy
- Hospital facility type is phase 2; Clinic only in phase 1
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md .wolf/cerebrum.md
git commit -m "docs: facility-config foundation patterns and learnings"
```

---

## Self-review notes

The plan's tasks map to spec sections as follows:

| Spec section | Tasks |
|---|---|
| §3 Module taxonomy | Task 3 (FacilityType), Task 18-19 (gating) |
| §4 Four-layer config | Tasks 1, 2, 4, 5 (resolver), 6 (loadFacilityConfig), 7 (loadCountryProfile) |
| §5 Master Project + sync | Tasks 11 (runbook), 13 (client helper), 15 (sync), 16 (AccessPolicy) |
| §6 Free Clinic Mode + charge status | Tasks 17 (helpers), 21 (toggle UI), 22 (charge status), 23 (chip), 24 (encounter create), 25 (timing test), 26-27 (billing) |
| §7 Runtime gating | Tasks 8 (provider/hooks), 9 (components), 10 (mount) |
| §8 Admin UI | Tasks 19 (header), 20 (modules section), 21 (free clinic) |
| §9 Migration sequence | Tasks 1-29 collectively follow the 5-step migration order |
| §10 Scope | Plan is bounded — no inpatient, no user prefs, no module dep graph |
| §12 Success criteria | Task 28 walks all 11 criteria explicitly |

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-09-facility-types-foundation.md`. Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — I execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

**Which approach?**
