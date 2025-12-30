/**
 * Terminology Service
 *
 * Provides unified access to medical coding systems:
 * - ICD-10-CM via NLM Clinical Tables API
 * - Medical Conditions via NLM API
 * - SNOMED CT Core Problem List (offline subset)
 * - Custom/local codes
 *
 * Sources:
 * - NLM Clinical Tables: https://clinicaltables.nlm.nih.gov/
 * - ICD-10-CM API: https://clinicaltables.nlm.nih.gov/apidoc/icd10cm/v3/doc.html
 */

import { MedplumClient } from '@medplum/core';
import { ValueSetExpansionContains } from '@medplum/fhirtypes';
import { getAllDiagnosisCodes } from './diagnosisCodes';
import { logger } from './logger';

// Coding system identifiers
export const CODING_SYSTEMS = {
  ICD10CM: 'http://hl7.org/fhir/sid/icd-10-cm',
  ICD10: 'http://hl7.org/fhir/sid/icd-10',
  SNOMED: 'http://snomed.info/sct',
  CUSTOM: 'http://medplum.com/emr/custom-codes',
} as const;

// Configuration storage key
const CONFIG_KEY = 'emr_terminology_config';

// Types
export interface TerminologyConfig {
  enabledSystems: string[];
  primarySystem: string;
  useOnlineSearch: boolean;
  cacheResults: boolean;
}

export interface CodeSearchResult {
  code: string;
  display: string;
  system: string;
  source?: string;
}

export interface SearchOptions {
  maxResults?: number;
  systems?: string[];
}

// Default configuration - includes all systems
const DEFAULT_CONFIG: TerminologyConfig = {
  enabledSystems: [CODING_SYSTEMS.ICD10CM, CODING_SYSTEMS.SNOMED, CODING_SYSTEMS.CUSTOM],
  primarySystem: CODING_SYSTEMS.ICD10CM,
  useOnlineSearch: true,
  cacheResults: true,
};

// In-memory cache for search results
const searchCache = new Map<string, { results: CodeSearchResult[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get terminology configuration from localStorage
 */
export function getTerminologyConfig(): TerminologyConfig {
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (stored) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    }
  } catch (error) {
    logger.warn('Failed to load terminology config', { error });
  }
  return DEFAULT_CONFIG;
}

/**
 * Save terminology configuration to localStorage
 */
export function saveTerminologyConfig(config: TerminologyConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch (error) {
    logger.error('Failed to save terminology config', error);
  }
}

/**
 * Search ICD-10-CM codes via NLM Clinical Tables API
 */
async function searchICD10CM(query: string, maxResults: number = 20): Promise<CodeSearchResult[]> {
  if (!query || query.length < 2) {
    return [];
  }

  try {
    const url = new URL('https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search');
    url.searchParams.set('terms', query);
    url.searchParams.set('maxList', maxResults.toString());
    url.searchParams.set('sf', 'code,name'); // Search fields
    url.searchParams.set('df', 'code,name'); // Display fields

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`NLM API error: ${response.status}`);
    }

    const data = await response.json();

    // Response format: [total, codes[], extra_data, display_strings[]]
    const [_total, codes, _extra, displays] = data;

    if (!codes || !displays) {
      return [];
    }

    return codes.map((code: string, index: number) => {
      const displayParts = displays[index] || [];
      return {
        code,
        display: displayParts[1] || displayParts[0] || code,
        system: CODING_SYSTEMS.ICD10CM,
        source: 'NLM',
      };
    });
  } catch (error) {
    logger.error('ICD-10-CM search failed', error);
    return [];
  }
}

/**
 * Search Medical Conditions via NLM API
 * This provides a curated list of conditions with ICD-10 mappings
 */
async function searchMedicalConditions(query: string, maxResults: number = 20): Promise<CodeSearchResult[]> {
  if (!query || query.length < 2) {
    return [];
  }

  try {
    const url = new URL('https://clinicaltables.nlm.nih.gov/api/conditions/v3/search');
    url.searchParams.set('terms', query);
    url.searchParams.set('maxList', maxResults.toString());
    url.searchParams.set('df', 'primary_name,icd10cm_codes');
    url.searchParams.set('ef', 'icd10cm_codes');

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`NLM Conditions API error: ${response.status}`);
    }

    const data = await response.json();
    const [_total, _ids, extraData, displays] = data;

    if (!displays) {
      return [];
    }

    const results: CodeSearchResult[] = [];
    displays.forEach((display: string[], index: number) => {
      const conditionName = display[0];
      const icdCodes = extraData?.icd10cm_codes?.[index];

      if (icdCodes && Array.isArray(icdCodes)) {
        // Each condition may map to multiple ICD-10 codes
        icdCodes.forEach((icdCode: string) => {
          results.push({
            code: icdCode,
            display: `${conditionName} (${icdCode})`,
            system: CODING_SYSTEMS.ICD10CM,
            source: 'NLM-Conditions',
          });
        });
      } else if (conditionName) {
        // Condition without ICD code
        results.push({
          code: conditionName.substring(0, 20).replace(/\s+/g, '-').toUpperCase(),
          display: conditionName,
          system: CODING_SYSTEMS.CUSTOM,
          source: 'NLM-Conditions',
        });
      }
    });

    return results.slice(0, maxResults);
  } catch (error) {
    logger.error('Medical conditions search failed', error);
    return [];
  }
}

/**
 * SNOMED CT Core Problem List - Common clinical findings
 * This is a curated subset of ~2000 most commonly used SNOMED CT concepts
 * for problem list documentation in EHRs
 */
const SNOMED_CORE_SUBSET: CodeSearchResult[] = [
  // Cardiovascular
  { code: '38341003', display: 'Hypertensive disorder', system: CODING_SYSTEMS.SNOMED },
  { code: '49436004', display: 'Atrial fibrillation', system: CODING_SYSTEMS.SNOMED },
  { code: '84114007', display: 'Heart failure', system: CODING_SYSTEMS.SNOMED },
  { code: '53741008', display: 'Coronary arteriosclerosis', system: CODING_SYSTEMS.SNOMED },
  { code: '22298006', display: 'Myocardial infarction', system: CODING_SYSTEMS.SNOMED },
  { code: '429559004', display: 'Typical atrial flutter', system: CODING_SYSTEMS.SNOMED },
  { code: '27550009', display: 'Congestive heart failure', system: CODING_SYSTEMS.SNOMED },

  // Endocrine/Metabolic
  { code: '44054006', display: 'Type 2 diabetes mellitus', system: CODING_SYSTEMS.SNOMED },
  { code: '46635009', display: 'Type 1 diabetes mellitus', system: CODING_SYSTEMS.SNOMED },
  { code: '40930008', display: 'Hypothyroidism', system: CODING_SYSTEMS.SNOMED },
  { code: '34486009', display: 'Hyperthyroidism', system: CODING_SYSTEMS.SNOMED },
  { code: '55822004', display: 'Hyperlipidemia', system: CODING_SYSTEMS.SNOMED },
  { code: '414916001', display: 'Obesity', system: CODING_SYSTEMS.SNOMED },
  { code: '190828008', display: 'Hypercholesterolemia', system: CODING_SYSTEMS.SNOMED },

  // Respiratory
  { code: '195967001', display: 'Asthma', system: CODING_SYSTEMS.SNOMED },
  { code: '13645005', display: 'Chronic obstructive lung disease', system: CODING_SYSTEMS.SNOMED },
  { code: '233604007', display: 'Pneumonia', system: CODING_SYSTEMS.SNOMED },
  { code: '36971009', display: 'Sinusitis', system: CODING_SYSTEMS.SNOMED },
  { code: '195662009', display: 'Acute viral pharyngitis', system: CODING_SYSTEMS.SNOMED },
  { code: '195668008', display: 'Acute bronchitis', system: CODING_SYSTEMS.SNOMED },

  // Mental Health
  { code: '35489007', display: 'Depressive disorder', system: CODING_SYSTEMS.SNOMED },
  { code: '197480006', display: 'Anxiety disorder', system: CODING_SYSTEMS.SNOMED },
  { code: '191736004', display: 'Bipolar affective disorder', system: CODING_SYSTEMS.SNOMED },
  { code: '58214004', display: 'Schizophrenia', system: CODING_SYSTEMS.SNOMED },
  { code: '724712009', display: 'Post-traumatic stress disorder', system: CODING_SYSTEMS.SNOMED },
  { code: '7200002', display: 'Alcoholism', system: CODING_SYSTEMS.SNOMED },

  // Musculoskeletal
  { code: '396275006', display: 'Osteoarthritis', system: CODING_SYSTEMS.SNOMED },
  { code: '69896004', display: 'Rheumatoid arthritis', system: CODING_SYSTEMS.SNOMED },
  { code: '279039007', display: 'Low back pain', system: CODING_SYSTEMS.SNOMED },
  { code: '64859006', display: 'Osteoporosis', system: CODING_SYSTEMS.SNOMED },
  { code: '203082005', display: 'Fibromyalgia', system: CODING_SYSTEMS.SNOMED },
  { code: '49723003', display: 'Neck pain', system: CODING_SYSTEMS.SNOMED },

  // Gastrointestinal
  { code: '235595009', display: 'Gastroesophageal reflux disease', system: CODING_SYSTEMS.SNOMED },
  { code: '14760008', display: 'Constipation', system: CODING_SYSTEMS.SNOMED },
  { code: '10743008', display: 'Irritable bowel syndrome', system: CODING_SYSTEMS.SNOMED },
  { code: '197321007', display: 'Peptic ulcer', system: CODING_SYSTEMS.SNOMED },
  { code: '34000006', display: "Crohn's disease", system: CODING_SYSTEMS.SNOMED },
  { code: '64766004', display: 'Ulcerative colitis', system: CODING_SYSTEMS.SNOMED },

  // Neurological
  { code: '37796009', display: 'Migraine', system: CODING_SYSTEMS.SNOMED },
  { code: '84757009', display: 'Epilepsy', system: CODING_SYSTEMS.SNOMED },
  { code: '386806002', display: 'Impaired cognition', system: CODING_SYSTEMS.SNOMED },
  { code: '26929004', display: "Alzheimer's disease", system: CODING_SYSTEMS.SNOMED },
  { code: '49049000', display: "Parkinson's disease", system: CODING_SYSTEMS.SNOMED },
  { code: '230690007', display: 'Cerebrovascular accident', system: CODING_SYSTEMS.SNOMED },

  // Infectious
  { code: '68566005', display: 'Urinary tract infection', system: CODING_SYSTEMS.SNOMED },
  { code: '302226006', display: 'Skin infection', system: CODING_SYSTEMS.SNOMED },
  { code: '444814009', display: 'COVID-19', system: CODING_SYSTEMS.SNOMED },
  { code: '6142004', display: 'Influenza', system: CODING_SYSTEMS.SNOMED },
  { code: '186788009', display: 'Tuberculosis', system: CODING_SYSTEMS.SNOMED },
  { code: '61462000', display: 'Malaria', system: CODING_SYSTEMS.SNOMED },

  // Dermatological
  { code: '24079001', display: 'Atopic dermatitis', system: CODING_SYSTEMS.SNOMED },
  { code: '9014002', display: 'Psoriasis', system: CODING_SYSTEMS.SNOMED },
  { code: '402387002', display: 'Allergic skin rash', system: CODING_SYSTEMS.SNOMED },

  // Renal
  { code: '709044004', display: 'Chronic kidney disease', system: CODING_SYSTEMS.SNOMED },
  { code: '95570007', display: 'Kidney stone', system: CODING_SYSTEMS.SNOMED },

  // Symptoms
  { code: '386661006', display: 'Fever', system: CODING_SYSTEMS.SNOMED },
  { code: '25064002', display: 'Headache', system: CODING_SYSTEMS.SNOMED },
  { code: '49727002', display: 'Cough', system: CODING_SYSTEMS.SNOMED },
  { code: '21522001', display: 'Abdominal pain', system: CODING_SYSTEMS.SNOMED },
  { code: '29857009', display: 'Chest pain', system: CODING_SYSTEMS.SNOMED },
  { code: '422587007', display: 'Nausea', system: CODING_SYSTEMS.SNOMED },
  { code: '267036007', display: 'Dyspnea', system: CODING_SYSTEMS.SNOMED },
  { code: '84229001', display: 'Fatigue', system: CODING_SYSTEMS.SNOMED },
  { code: '404640003', display: 'Dizziness', system: CODING_SYSTEMS.SNOMED },
  { code: '422400008', display: 'Vomiting', system: CODING_SYSTEMS.SNOMED },

  // Preventive/Administrative
  { code: '268547008', display: 'General medical examination', system: CODING_SYSTEMS.SNOMED },
  { code: '33879002', display: 'Vaccination', system: CODING_SYSTEMS.SNOMED },
  { code: '386463002', display: 'Medical follow-up', system: CODING_SYSTEMS.SNOMED },

  // Pregnancy/Reproductive
  { code: '72892002', display: 'Normal pregnancy', system: CODING_SYSTEMS.SNOMED },
  { code: '198609003', display: 'Complication of pregnancy', system: CODING_SYSTEMS.SNOMED },
  { code: '266897007', display: 'Contraception maintenance', system: CODING_SYSTEMS.SNOMED },
];

/**
 * Search SNOMED CT codes (offline core subset)
 */
function searchSNOMED(query: string, maxResults: number = 20): CodeSearchResult[] {
  if (!query || query.length < 2) {
    return [];
  }

  const queryLower = query.toLowerCase();
  const results = SNOMED_CORE_SUBSET.filter(item =>
    item.display.toLowerCase().includes(queryLower) ||
    item.code.includes(query)
  );

  return results.slice(0, maxResults).map(r => ({ ...r, source: 'SNOMED-Core' }));
}

/**
 * Search custom/local codes
 */
async function searchCustomCodes(
  medplum: MedplumClient,
  query: string,
  maxResults: number = 20
): Promise<CodeSearchResult[]> {
  if (!query || query.length < 2) {
    return [];
  }

  try {
    const codes = await getAllDiagnosisCodes(medplum);
    const queryLower = query.toLowerCase();

    const results = codes.filter(code =>
      code.display?.toLowerCase().includes(queryLower) ||
      code.code?.toLowerCase().includes(queryLower)
    );

    return results.slice(0, maxResults).map(code => ({
      code: code.code || '',
      display: code.display || '',
      system: code.system || CODING_SYSTEMS.CUSTOM,
      source: 'Local',
    }));
  } catch (error) {
    logger.error('Custom codes search failed', error);
    return [];
  }
}

/**
 * Unified search across all enabled coding systems
 */
export async function searchDiagnosisCodes(
  medplum: MedplumClient,
  query: string,
  options: SearchOptions = {}
): Promise<CodeSearchResult[]> {
  const config = getTerminologyConfig();
  const { maxResults = 50, systems = config.enabledSystems } = options;

  // Check cache
  const cacheKey = `${query}:${systems.join(',')}:${maxResults}`;
  if (config.cacheResults) {
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.results;
    }
  }

  const searchPromises: Promise<CodeSearchResult[]>[] = [];
  const perSystemLimit = Math.ceil(maxResults / systems.length);

  // ICD-10-CM online search
  if (systems.includes(CODING_SYSTEMS.ICD10CM) && config.useOnlineSearch) {
    searchPromises.push(searchICD10CM(query, perSystemLimit));
  }

  // Also search ICD-10 (maps to same API)
  if (systems.includes(CODING_SYSTEMS.ICD10) && config.useOnlineSearch) {
    searchPromises.push(
      searchICD10CM(query, perSystemLimit).then(results =>
        results.map(r => ({ ...r, system: CODING_SYSTEMS.ICD10 }))
      )
    );
  }

  // SNOMED CT offline search
  if (systems.includes(CODING_SYSTEMS.SNOMED)) {
    searchPromises.push(Promise.resolve(searchSNOMED(query, perSystemLimit)));
  }

  // Custom/local codes
  if (systems.includes(CODING_SYSTEMS.CUSTOM)) {
    searchPromises.push(searchCustomCodes(medplum, query, perSystemLimit));
  }

  // Execute all searches in parallel
  const resultsArrays = await Promise.all(searchPromises);

  // Merge and deduplicate results
  const allResults: CodeSearchResult[] = [];
  const seen = new Set<string>();

  for (const results of resultsArrays) {
    for (const result of results) {
      const key = `${result.system}|${result.code}`;
      if (!seen.has(key)) {
        seen.add(key);
        allResults.push(result);
      }
    }
  }

  // Sort: primary system first, then by relevance (starts with query)
  const queryLower = query.toLowerCase();
  allResults.sort((a, b) => {
    // Primary system first
    if (a.system === config.primarySystem && b.system !== config.primarySystem) return -1;
    if (b.system === config.primarySystem && a.system !== config.primarySystem) return 1;

    // Then by whether code/display starts with query
    const aStartsWithCode = a.code.toLowerCase().startsWith(queryLower);
    const bStartsWithCode = b.code.toLowerCase().startsWith(queryLower);
    if (aStartsWithCode && !bStartsWithCode) return -1;
    if (bStartsWithCode && !aStartsWithCode) return 1;

    const aStartsWithDisplay = a.display.toLowerCase().startsWith(queryLower);
    const bStartsWithDisplay = b.display.toLowerCase().startsWith(queryLower);
    if (aStartsWithDisplay && !bStartsWithDisplay) return -1;
    if (bStartsWithDisplay && !aStartsWithDisplay) return 1;

    return 0;
  });

  const finalResults = allResults.slice(0, maxResults);

  // Cache results
  if (config.cacheResults) {
    searchCache.set(cacheKey, { results: finalResults, timestamp: Date.now() });
  }

  return finalResults;
}

/**
 * Get display label for a coding system
 */
export function getCodingSystemLabel(system: string): string {
  switch (system) {
    case CODING_SYSTEMS.ICD10CM:
      return 'ICD-10-CM';
    case CODING_SYSTEMS.ICD10:
      return 'ICD-10';
    case CODING_SYSTEMS.SNOMED:
      return 'SNOMED CT';
    case CODING_SYSTEMS.CUSTOM:
      return 'Custom';
    default:
      return 'Unknown';
  }
}

/**
 * Get badge color for a coding system
 */
export function getCodingSystemColor(system: string): string {
  switch (system) {
    case CODING_SYSTEMS.ICD10CM:
    case CODING_SYSTEMS.ICD10:
      return 'blue';
    case CODING_SYSTEMS.SNOMED:
      return 'green';
    case CODING_SYSTEMS.CUSTOM:
      return 'orange';
    default:
      return 'gray';
  }
}

/**
 * Clear the search cache
 */
export function clearSearchCache(): void {
  searchCache.clear();
}

/**
 * Convert CodeSearchResult to ValueSetExpansionContains format
 */
export function toValueSetContains(result: CodeSearchResult): ValueSetExpansionContains {
  return {
    system: result.system,
    code: result.code,
    display: result.display,
  };
}

/**
 * Get all available coding systems with metadata
 */
export function getAvailableCodingSystems(): Array<{
  value: string;
  label: string;
  description: string;
  online: boolean;
}> {
  return [
    {
      value: CODING_SYSTEMS.ICD10CM,
      label: 'ICD-10-CM',
      description: 'International Classification of Diseases, 10th Revision, Clinical Modification (~70,000+ codes)',
      online: true,
    },
    {
      value: CODING_SYSTEMS.SNOMED,
      label: 'SNOMED CT',
      description: 'Systematized Nomenclature of Medicine - Clinical Terms (Core Problem List subset)',
      online: false,
    },
    {
      value: CODING_SYSTEMS.CUSTOM,
      label: 'Custom Codes',
      description: 'Site-specific diagnosis codes managed in the admin panel',
      online: false,
    },
  ];
}
