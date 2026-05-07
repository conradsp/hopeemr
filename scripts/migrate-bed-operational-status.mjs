#!/usr/bin/env node
// One-off migration for HopeEMR Location resources with physicalType=bd.
//
// Background: the prior getOperationalStatusCode mapping used FHIR v2-0116 codes
// incorrectly (K used for housekeeping, I used for contaminated, H missing entirely;
// 'reserved' silently collapsed to 'housekeeping' on round-trip).
// See .wolf/buglog.json bug-004 for the full context.
//
// This script:
//   1. Walks every Location with physicalType.coding.code = 'bd'.
//   2. Skips beds that already carry the BED_STATUS_EXTENSION_URL extension (idempotent).
//   3. For unmigrated beds, derives the user-visible BedStatus from the legacy code
//      mapping (preserves what the user has been seeing on screen), then writes:
//        - operationalStatus.code   = FHIR-correct v2-0116 code
//        - extension[bed-status]    = HopeEMR BedStatus literal
//
// Usage:
//   MEDPLUM_BASE_URL=...
//   MEDPLUM_CLIENT_ID=...
//   MEDPLUM_CLIENT_SECRET=...
//   node scripts/migrate-bed-operational-status.mjs [--dry-run]
//
// 'reserved' is unrecoverable from existing data: pre-migration, the round-trip
// already collapsed it to 'housekeeping' from the user's point of view, so the
// migration writes 'housekeeping' for those beds. Going forward, new/edited beds
// preserve 'reserved' via the extension.

import { MedplumClient } from '@medplum/core';

const BED_STATUS_EXTENSION_URL = 'http://example.org/fhir/StructureDefinition/bed-status';
const OPERATIONAL_STATUS_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v2-0116';

// Mirrors the pre-migration getBedStatusFromCode in src/utils/bedManagement.ts.
// Do NOT change this — it represents what the user has been seeing.
function legacyCodeToBedStatus(code) {
  switch (code) {
    case 'U': return 'available';
    case 'O': return 'occupied';
    case 'K': return 'housekeeping';
    case 'C': return 'maintenance';
    case 'I': return 'contaminated';
    default: return 'available';
  }
}

// Mirrors the post-fix getOperationalStatusCode in src/utils/bedManagement.ts.
function bedStatusToOperationalCode(status) {
  switch (status) {
    case 'available':    return 'U';
    case 'occupied':     return 'O';
    case 'reserved':     return 'O';
    case 'maintenance':  return 'C';
    case 'contaminated': return 'K';
    case 'housekeeping': return 'H';
    default:             return 'U';
  }
}

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
    pageSize: 100,
  };
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const { dryRun, pageSize } = parseArgs(process.argv.slice(2));
  const baseUrl = requireEnv('MEDPLUM_BASE_URL');
  const clientId = requireEnv('MEDPLUM_CLIENT_ID');
  const clientSecret = requireEnv('MEDPLUM_CLIENT_SECRET');

  const medplum = new MedplumClient({ baseUrl, fetch });
  await medplum.startClientLogin(clientId, clientSecret);

  console.log(dryRun ? 'DRY RUN — no writes will be made' : 'LIVE — beds will be updated');
  console.log(`Server: ${baseUrl}`);
  console.log('');

  let processed = 0;
  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  let offset = 0;

  while (true) {
    const result = await medplum.search('Location', {
      'physical-type': 'bd',
      _count: String(pageSize),
      _offset: String(offset),
    });
    const entries = result.entry ?? [];
    if (entries.length === 0) break;

    for (const entry of entries) {
      const bed = entry.resource;
      if (!bed || !bed.id) continue;
      processed++;

      const alreadyMigrated = bed.extension?.some((e) => e.url === BED_STATUS_EXTENSION_URL);
      if (alreadyMigrated) {
        skipped++;
        continue;
      }

      const oldCode = bed.operationalStatus?.code;
      const status = legacyCodeToBedStatus(oldCode);
      const newCode = bedStatusToOperationalCode(status);

      const label = bed.name ?? bed.identifier?.[0]?.value ?? '?';
      console.log(`  ${bed.id} (${label}): code ${oldCode ?? '(none)'} -> ${newCode}, extension '${status}'`);

      if (dryRun) {
        migrated++;
        continue;
      }

      const updated = {
        ...bed,
        operationalStatus: {
          system: OPERATIONAL_STATUS_SYSTEM,
          code: newCode,
          display: status,
        },
        extension: [
          ...(bed.extension ?? []),
          { url: BED_STATUS_EXTENSION_URL, valueCode: status },
        ],
      };

      try {
        await medplum.updateResource(updated);
        migrated++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ERROR updating ${bed.id}: ${msg}`);
        errors++;
      }
    }

    if (entries.length < pageSize) break;
    offset += pageSize;
  }

  console.log('');
  console.log(`Done. Processed: ${processed}, Migrated: ${migrated}, Skipped (already migrated): ${skipped}, Errors: ${errors}`);

  if (errors > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
