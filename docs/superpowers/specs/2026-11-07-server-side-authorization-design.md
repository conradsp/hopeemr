# Server-Side Authorization — Design Spec

**Date:** 2026-11-07
**Status:** Approved 2026-11-08 — Decision A1 (strict writes, open reads), matrix as drafted
**Roadmap:** Phase 0, finding 1 (blocker)

## Problem

Authorization is enforced only in the browser. Roles are a JSON string in a `Practitioner`
extension (`http://hopeemr.com/fhir/StructureDefinition/user-roles`) and no `AccessPolicy`
exists, so Medplum gives every project member full read/write on the project. Any user can
call the FHIR API directly, and can edit their own `Practitioner` to grant themselves roles.

## Goals

1. The Medplum server refuses every write a role is not allowed to make, regardless of client.
2. Users cannot change their own roles.
3. Clinical records cannot be hard-deleted by clinical roles.
4. The UI keeps working for every role (no new 403s on pages a role uses today).
5. Automated proof: a test logs in as each role and asserts allowed/forbidden operations
   against a real Medplum server.

## Non-goals (this spec)

- Field-level hiding (e.g. chief complaint on `Task` for front desk). Stays UI-only for now.
- Per-patient or per-department compartments.
- Read restrictions beyond what Decision A selects.

## Design

### Roles live on `ProjectMembership`, not `Practitioner`

- One `AccessPolicy` per role in each facility Project, keyed by
  `name = hopeemr-role-<role-code>` (Medplum's `AccessPolicy` has no `identifier` element).
- A user's roles = `ProjectMembership.access[]`, one entry per role. Medplum grants the
  union of all listed policies.
- `ProjectMembership` is writable only by project admins (Medplum built-in), so users cannot
  edit their own roles.
- Each access entry's `policy.display` is set to the role code (e.g. `provider`). The client
  reads roles from `medplum.getProjectMembership().access[].policy.display` synchronously.
  This is a UI hint only: the server enforces the actual policy, so a wrong display can
  only show a wrong button, never grant access.
- **Admin** = `ProjectMembership.admin = true` with no access policy (full project access,
  plus Medplum admin endpoints for inviting users and editing memberships).
- The `user-roles` `Practitioner` extension is removed. Existing data is test-only and reset.

### Policy definitions are code

`src/security/rolePolicies.ts` exports a typed `AccessPolicy` per role (pure data). The same
module is used by the app (role codes, display) and by scripts (to create the policies).

Shared building blocks:

| Block | Resource types | Access |
|-------|----------------|--------|
| Open read (Decision A1) | `*` (all types the project member may see) | read-only |
| Audit | AuditEvent | create only |

### Write matrix

`C` create, `U` update, `D` delete. Every role also gets the open-read and audit blocks.
A type not listed for a role is read-only or invisible per Decision A.

| Resource | Provider | Nurse | Pharmacy | Lab | Radiology | Billing | Front desk |
|----------|---------|-------|----------|-----|-----------|---------|------------|
| Patient | CU | | | | | | CU |
| Coverage | CU | | | | | CU | CU |
| Encounter | CU | U | | | | | CU |
| Appointment | CU | | | | | | CU |
| Slot | U | | | | | | U |
| Task (queue) | CU | CU | | | | | CU |
| Observation | CU | CU | | CU | CU | | |
| Condition | CU | | | | | | |
| Procedure | CU | | | | | | |
| ClinicalImpression | CU | | | | | | |
| QuestionnaireResponse | CU | | | | | | |
| DocumentReference | CU | | | CU | CU | | |
| Binary | C | | | C | C | | |
| ServiceRequest | CU | | | U | U | | |
| DiagnosticReport | | | | CU | CU | | |
| MedicationRequest | CU | | U | | | | |
| MedicationAdministration | CU | CU | CU | | | | |
| DetectedIssue | CU | CU | | | | | |
| Location (beds only) | U | U | | | | | |
| ChargeItem | C | C | C | C | C | CUD | C |
| Account | | | | | | CU | CU |
| Medication, MedicationKnowledge | | | CUD | | | | |
| ActivityDefinition | | | | CUD | CUD | | |

Notes:
- Charges are created automatically by clinical actions (order, administer, check-in, bed
  assignment), so those roles need `create` on `ChargeItem`; only billing can change or
  remove a charge.
- No clinical role can delete any clinical resource. Corrections use FHIR status
  (`entered-in-error`). The one current UI delete of clinical data (lab/imaging document in
  `OrdersTab`) becomes admin-only or a status change; see plan.
- Bed writes are limited with `criteria: 'Location?physical-type=bd'`; departments stay
  admin-only.
- Lab and radiology both write `ActivityDefinition` (their test catalogs share the type).
  Accepted for phase 0.
- Admin-only types (no role policy grants write): Practitioner, Organization, Questionnaire,
  ValueSet, Schedule, AccessPolicy, ProjectMembership, User.

### Decision A — read scope

- **A1 (recommended): writes strict, reads open to clinical data.** Every role can read
  clinical resources as the UI shows them today. Fixes the escalation and tampering hole
  now without breaking pages; read tightening happens per page in Phase 1.
- **A2: least-privilege reads now.** Front desk and billing cannot read Observation,
  Condition, DocumentReference, QuestionnaireResponse, MedicationRequest, etc. Requires
  making every page they can reach handle 403s first.

### Scripts

- `scripts/setup-access-policies.ts` — creates or updates the role policies in a Project,
  keyed by name. Idempotent, `--dry-run`. Run once per facility; reused by the
  future provisioning script.
- `scripts/test-access-policies.ts` — against a real Medplum: creates a throwaway test user
  per role (invite with password, no email), signs in as each, asserts each allowed write
  succeeds and each forbidden write returns 403, then removes the test users.
- Scripts run with `tsx` so they import the policy definitions from `src/`.

### App changes

- `permissionUtils.getUserRoles(membership)` reads roles from membership access entries;
  admin from `membership.admin`.
- `EditUserRolesModal` updates `ProjectMembership.access` through the Medplum admin API.
- `NewProviderModal` invites with the chosen roles and the already-created `Practitioner`
  as `membership.profile` (also fixes the current duplicate-Practitioner bug).
- `ManageUsersPage` shows roles from memberships.

### Testing

- Unit: policy invariants (no role writes admin-only types; no role deletes clinical
  types; every role has open read and audit), role derivation from membership.
- Integration: `test-access-policies.ts` against `docker-compose-emr.yml` locally; added to
  CI as a job with Postgres/Redis/Medplum service containers.

### Risks

- A missing grant breaks a real workflow with a 403. Mitigation: the write matrix was built
  from every create/update/delete call site; the integration test exercises each role's
  core writes; walk each role through the app before the pilot.
- Offline queue replays writes later; a 403 on replay must surface to the user, not retry
  forever. Check `SyncManager` handling of 403.
