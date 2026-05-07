# anatomy.md

> Auto-maintained by OpenWolf. Last scanned: 2026-05-07T22:37:27.384Z
> Files: 263 tracked | Anatomy hits: 0 | Misses: 0

## ./

- `.dockerignore` — Docker ignore rules (~94 tok)
- `.gitignore` — Git ignore rules (~260 tok)
- `CLAUDE.md` — OpenWolf (~1372 tok)
- `deploy.sh` — HopeEMR Deployment Script (~910 tok)
- `docker-compose-emr-https.yml` — HopeEMR Production Docker Compose with HTTPS (~2058 tok)
- `docker-compose-emr-production.yml` — Production-Ready Docker Compose for Medplum EMR (~2228 tok)
- `docker-compose-emr.yml` — Docker Compose: 5 services (~1265 tok)
- `docker-compose.yml` — Docker Compose services (~214 tok)
- `Dockerfile` — Docker container definition (~304 tok)
- `Dockerfile.production` — Production Dockerfile for HopeEMR (~775 tok)
- `eslint.config.js` — ESLint flat configuration (~831 tok)
- `index.html` — HopeEMR (~358 tok)
- `LOW-RESOURCE-PROVIDER-RECOMMENDATIONS.md` — EMR Recommendations for High-Volume Providers in Low-Resource Settings (~5034 tok)
- `nginx-secure.conf` — Secure Nginx Configuration for EMR Application (~964 tok)
- `nginx.conf` — Nginx configuration (~298 tok)
- `package-lock.json` — npm lock file (~106496 tok)
- `package.json` — Node.js package manifest (~578 tok)
- `postcss.config.mjs` — Declares config (~118 tok)
- `README.md` — Project documentation (~1557 tok)
- `tsconfig.json` — TypeScript configuration (~147 tok)
- `vercel.json` (~39 tok)
- `vite.config.ts` — Vite build configuration (~1180 tok)
- `vitest.config.js` (~52 tok)

## .claude/

- `settings.json` (~441 tok)
- `settings.local.json` (~660 tok)

## .claude/rules/

- `openwolf.md` (~313 tok)

## .claude/skills/fhir-architect/

- `SKILL.md` — FHIR Architect (~916 tok)

## .claude/skills/healthcare-validator/

- `SKILL.md` — Healthcare Validator (~699 tok)

## .claude/skills/i18n-validator/

- `SKILL.md` — i18n Validator (~663 tok)

## .claude/skills/security-validator/

- `SKILL.md` — Security Validator (~777 tok)

## .claude/skills/testing-validator/

- `SKILL.md` — Testing Validator (~1210 tok)

## .claude/skills/ux-design/

- `SKILL.md` — UX Design (~922 tok)

## data/core/

- `encounter-note-questionnaires.json` (~6438 tok)
- `encounter-types.json` (~866 tok)
- `example-bots.json` (~20642 tok)

## data/example/

- `example-patient-data.json` (~6619 tok)

## dev-dist/

- `registerSW.js` (~34 tok)
- `sw.js` — Copyright 2018 Google Inc. All Rights Reserved. (~1204 tok)
- `sw.js.map` — \n * Welcome to your Workbox-powered service worker!\n *\n * You'll need to register this file in your web app.\n * See https://goo.gl/nhQhGp\n *\n... (~3568 tok)
- `workbox-137dedbd.js` — Declares logger (~52229 tok)
- `workbox-137dedbd.js.map` — Exports messages (~84425 tok)

## docs/

- `BED_MANAGEMENT.md` — Bed Management System (~2425 tok)
- `BILLING_SYSTEM.md` — Billing System Implementation (~2622 tok)
- `CLINICAL_NOTES.md` — Clinical Notes System (~1353 tok)
- `DEPLOYMENT_CHECKLIST.md` — 📋 Medplum EMR Deployment Checklist (~2188 tok)
- `DEPLOYMENT.md` — EMR Application Deployment Guide (~2543 tok)
- `PERMISSIONS_SYSTEM.md` — Roles and Permissions System - Implementation Complete! (~2153 tok)
- `PHARMACY_MODULE.md` — Pharmacy & Medication Management Module (~2320 tok)
- `QUEUE_MANAGEMENT_ARCHITECTURE.md` — Queue Management System Architecture (~4681 tok)
- `QUICKSTART.md` — Medplum EMR - Quick Start Guide (~1044 tok)
- `README.docker.md` — Quick Start - Docker Deployment (~1240 tok)
- `SCHEDULING.md` — Scheduling System (~2538 tok)
- `SETUP_LOCAL.md` — Local Development Setup for Medplum EMR (~1378 tok)
- `TESTING_GUIDE.md` — 🧪 Billing System - Complete Test Plan (~3706 tok)

## nginx/

- `nginx.conf` — Nginx configuration (~267 tok)

## nginx/conf.d/

- `emr-app.conf` — EMR Application (hopeemr.com) (~650 tok)
- `medplum-api.conf` — Medplum API Server (api.hopeemr.com) (~542 tok)

## scripts/

- `check-inline-styles.sh` — Quick script to find and show all remaining inline styles (~155 tok)
- `migrate-bed-operational-status.mjs` — One-off migration for HopeEMR Location resources with physicalType=bd. (~1369 tok)
- `setup-server.sh` — HopeEMR Server Setup Script (~1202 tok)

## src/

- `App.css` — Styles: 5 rules (~212 tok)
- `EMRApp.module.css` — Styles: 2 rules (~52 tok)
- `EMRApp.tsx` — EMRApp (~3358 tok)
- `i18n.ts` — Declares savedLanguage (~185 tok)
- `main.tsx` — container (~950 tok)
- `vite-env.d.ts` — / <reference types="vite/client" /> (~68 tok)

## src/components/

- `ConfigError.tsx` — Configuration Error Display Component (~696 tok)
- `ErrorBoundary.tsx` — Safe translation helper for ErrorBoundary. (~1352 tok)

## src/components/admin/

- `EditAppointmentTypeModal.tsx` — EditAppointmentTypeModal — renders form, modal — uses useState, useEffect (~1428 tok)
- `EditDiagnosticProviderModal.tsx` — EditDiagnosticProviderModal — renders modal (~1846 tok)
- `EditImagingTestModal.tsx` — CATEGORIES — renders modal — uses useState, useEffect (~2023 tok)
- `EditLabTestModal.module.css` — Styles: 7 rules (~88 tok)
- `EditLabTestModal.tsx` — CATEGORIES — renders modal — uses useState, useEffect (~2844 tok)
- `EditNoteTemplateModal.module.css` — Styles: 2 rules (~28 tok)
- `EditNoteTemplateModal.tsx` — EditNoteTemplateModal — renders form, modal — uses useState, useEffect (~1940 tok)
- `EditUserRolesModal.module.css` — Styles: 2 rules (~19 tok)
- `EditUserRolesModal.tsx` — EditUserRolesModal — renders modal — uses useState, useEffect (~1369 tok)
- `NewProviderModal.tsx` — NewProviderModal — renders form, modal (~2574 tok)

## src/components/auth/

- `RequireAdmin.tsx` — Route protection component that ensures only admin users can access wrapped routes (~292 tok)

## src/components/billing/

- `BillingSearchSection.tsx` — Search section for selecting patient and encounter in billing (~469 tok)
- `BillingSummaryCard.tsx` — Display billing summary with totals and action button (~591 tok)
- `ChargesTable.tsx` — Display table of charges (~551 tok)
- `PaymentModal.tsx` — PaymentModal — renders modal — uses useState (~1168 tok)
- `PaymentsTable.tsx` — Display table of payments (~435 tok)

## src/components/clinical-alerts/

- `CriticalAlertModal.module.css` — Styles for the CriticalAlertModal component (~162 tok)
- `CriticalAlertModal.tsx` — CriticalAlertModal Component (~1646 tok)
- `index.ts` — Clinical Alerts Components (~28 tok)

## src/components/encounter/

- `AddDiagnosisModal.tsx` — AddDiagnosisModal — renders modal — uses useState, useEffect, useCallback (~3390 tok)
- `AdministerMedicationModal.tsx` — AdministerMedicationModal — renders modal — uses useState (~1438 tok)
- `CreateNoteModal.tsx` — CreateNoteModal — renders modal — uses useEffect (~1850 tok)
- `EncounterHeader.module.css` — Styles: 1 rules (~19 tok)
- `EncounterHeader.tsx` — EncounterHeader — renders modal (~2655 tok)
- `EncounterList.tsx` — EncounterList — renders table (~342 tok)
- `EncounterPageWrapper.module.css` — Styles: 1 rules (~32 tok)
- `EncounterPageWrapper.tsx` — EncounterPageWrapper (~604 tok)
- `EncounterQuickActions.tsx` — EncounterQuickActions (~604 tok)
- `EncounterTabs.module.css` — Styles: 6 rules (~143 tok)
- `EnterLabResultModal.module.css` — Styles: 2 rules (~30 tok)
- `EnterLabResultModal.tsx` — EnterLabResultModal — renders modal (~660 tok)
- `NewEncounterModal.tsx` — NewEncounterModal — renders form, modal — uses useNavigate, useState, useEffect (~3760 tok)
- `OrderDiagnosticModal.tsx` — OrderDiagnosticModal — renders modal (~3956 tok)
- `PrescribeMedicationModal.tsx` — PrescribeMedicationModal — renders modal — uses useState, useEffect (~2021 tok)
- `RecordVitalsModal.tsx` — Build observation resources from vitals data (~5570 tok)

## src/components/encounter/tabs/

- `DetailsTab.tsx` — DetailsTab (~111 tok)
- `DiagnosesTab.tsx` — DiagnosesTab (~918 tok)
- `HistoryTab.tsx` — HistoryTab (~125 tok)
- `MedicationsTab.tsx` — MedicationsTab — renders table — uses useEffect (~2835 tok)
- `NotesTab.tsx` — NotesTab (~1667 tok)
- `ObservationsTab.tsx` — ObservationsTab (~997 tok)
- `OrdersTab.module.css` — Styles: 4 rules (~82 tok)
- `OrdersTab.tsx` — OrdersTab — renders modal (~3767 tok)
- `OverviewTab.tsx` — OverviewTab (~1001 tok)
- `ProceduresTab.tsx` — ProceduresTab (~725 tok)
- `VitalsTab.tsx` — VitalsTab (~1918 tok)

## src/components/encounter/tabs/orders/

- `OrderCard.module.css` — Styles: 2 rules (~60 tok)
- `OrderCard.tsx` — OrderCard (~2368 tok)
- `orderHelpers.ts` — Exports getOrderDocuments, getOrderResults (~336 tok)

## src/components/patient/

- `AddEmergencyContactModal.tsx` — AddEmergencyContactModal — renders form, modal — uses useState (~1566 tok)
- `AddInsuranceModal.tsx` — AddInsuranceModal — renders form, modal — uses useState (~1522 tok)
- `AddPractitionerModal.tsx` — AddPractitionerModal — renders form, modal — uses useState (~1062 tok)
- `NewPatientModal.tsx` — NewPatientModal — renders form, modal — uses useNavigate, useState (~1849 tok)
- `PatientDemographics.tsx` — PatientDemographics (~446 tok)
- `PatientEncounters.module.css` — Styles: 2 rules (~46 tok)
- `PatientEncounters.tsx` — PatientEncounters — renders table — uses useNavigate (~1065 tok)
- `PatientMainSection.module.css` — Styles: 2 rules (~47 tok)
- `PatientMainSection.tsx` — PatientMainSection (~1162 tok)
- `PatientObservations.module.css` — Styles: 1 rules (~26 tok)
- `PatientObservations.tsx` — PatientObservations — renders table, chart (~1664 tok)
- `PatientOverview.module.css` — Styles: 2 rules (~36 tok)
- `PatientOverview.tsx` — PatientOverview (~4044 tok)
- `PatientSidebar.tsx` — PatientSidebar — uses useState, useEffect (~2845 tok)
- `PatientTimeline.module.css` — Styles: 1 rules (~22 tok)
- `PatientTimeline.tsx` — No user-facing strings to translate in PatientTimeline (~151 tok)
- `PatientTopMenu.tsx` — PatientTopMenu (~300 tok)

## src/components/queue/

- `CompleteTaskModal.tsx` — CompleteTaskModal - Modal for completing a provider task (~858 tok)
- `EndOfDaySummaryModal.tsx` — EndOfDaySummaryModal - Modal showing end of day statistics (~1682 tok)
- `PendingTaskCard.tsx` — PendingTaskCard - Displays a provider task in a card format (~1040 tok)
- `PriorityBadge.tsx` — Priority Badge Component (~276 tok)
- `QueueMetrics.tsx` — Queue Metrics Component (~2106 tok)
- `QueueTable.tsx` — Queue Table Component (~2601 tok)
- `TaskTypeIcon.tsx` — TaskTypeIcon - Displays an icon for a provider task type (~493 tok)
- `TriageLevelBadge.tsx` — Triage Level Badge Component (~554 tok)
- `WaitTimeDisplay.tsx` — Wait Time Display Component (~513 tok)

## src/components/registration/

- `QuickRegisterModal.tsx` — Quick Register Modal (~3623 tok)

## src/components/scheduling/

- `CreateScheduleModal.tsx` — CreateScheduleModal — renders form, modal (~3128 tok)

## src/components/shared/

- `BreadcrumbNav.module.css` — Styles: 1 rules (~20 tok)
- `BreadcrumbNav.tsx` — BreadcrumbNav (~1244 tok)
- `ClinicalImpressionDisplay.module.css` — Styles: 1 rules (~28 tok)
- `ClinicalImpressionDisplay.tsx` — ClinicalImpressionDisplay (~1250 tok)
- `ConfirmDialog.tsx` — Dialog title - defaults to i18n 'common.confirm' (~495 tok)
- `Header.module.css` — Styles: 3 rules (~57 tok)
- `Header.tsx` — Header — uses useState, useNavigate, useEffect (~4552 tok)
- `LanguageSelector.module.css` — Styles: 1 rules (~19 tok)
- `LanguageSelector.tsx` — LanguageSelector (~155 tok)
- `OfflineBanner.tsx` — Banner component that shows offline status and sync progress (~990 tok)
- `SyncStatusBadge.tsx` — Badge component showing sync status (~1163 tok)

## src/hooks/

- `useModalForm.ts` — Custom hook to manage modal form state and submission (~564 tok)
- `usePermissions.ts` — React Hooks for Permissions (~1230 tok)
- `useWorkflowConfig.ts` — Hook to access and manage workflow configuration (~1014 tok)

## src/i18n/

- `en.json` (~18646 tok)
- `es.json` (~20239 tok)

## src/offline/

- `index.ts` (~153 tok)
- `OfflineProvider.tsx` — Feature flag for offline encryption (~1714 tok)
- `types.ts` — Supported FHIR resource types for offline caching (~2041 tok)

## src/offline/crypto/

- `encryptedOperations.ts` — Encrypted cache operations for PHI protection (~3174 tok)
- `encryption.ts` — Encryption utilities for PHI protection in IndexedDB (~1414 tok)
- `index.ts` — Encryption module exports (~374 tok)
- `keyStore.ts` — Key management for offline encryption (~1772 tok)

## src/offline/db/

- `operations.ts` — Cache a patient for offline access (~4588 tok)
- `schema.ts` — IndexedDB schema for offline storage (~1541 tok)

## src/offline/hooks/

- `useOfflineMutation.ts` — Check if an error is a network error (~2014 tok)
- `useOfflineStatus.ts` — Hook for detecting online/offline status (~492 tok)

## src/offline/sync/

- `SyncManager.ts` — Resource types that don't need local caching after sync (~4678 tok)
- `SyncQueue.ts` — SyncQueue manages pending offline operations (~1331 tok)

## src/pages/

- `HomePage.module.css` — Styles: 2 rules (~27 tok)
- `HomePage.tsx` — HomePage — renders table — uses useNavigate, useState (~1419 tok)

## src/pages/admin/

- `AppointmentTypesPage.module.css` — Styles: 3 rules (~44 tok)
- `AppointmentTypesPage.tsx` — AppointmentTypesPage — renders table (~2389 tok)
- `BedsPage.module.css` — Styles: 1 rules (~15 tok)
- `BedsPage.tsx` — BedsPage — renders table, modal (~4245 tok)
- `DepartmentsPage.module.css` — Styles: 1 rules (~17 tok)
- `DepartmentsPage.tsx` — DepartmentsPage — renders table, modal (~3198 tok)
- `DiagnosisCodesPage.module.css` — Styles: 1 rules (~21 tok)
- `DiagnosisCodesPage.tsx` — DiagnosisCodesPage — renders table, modal (~2746 tok)
- `DiagnosisConfigPage.tsx` — DiagnosisConfigPage (~7248 tok)
- `DiagnosticProvidersPage.module.css` — Styles: 4 rules (~75 tok)
- `DiagnosticProvidersPage.tsx` — DiagnosticProvidersPage — renders table (~2598 tok)
- `ImagingTestsPage.module.css` — Styles: 2 rules (~46 tok)
- `ImagingTestsPage.tsx` — ImagingTestsPage — renders table (~2559 tok)
- `InventoryPage.module.css` — Styles: 2 rules (~25 tok)
- `InventoryPage.tsx` — InventoryPage — renders table, modal — uses useState, useEffect (~3096 tok)
- `LabTestsPage.module.css` — Styles: 3 rules (~63 tok)
- `LabTestsPage.tsx` — LabTestsPage — renders table (~2489 tok)
- `ManageUsersPage.module.css` — Styles: 3 rules (~29 tok)
- `ManageUsersPage.tsx` — ManageUsersPage — renders table (~4225 tok)
- `MedicationCatalogPage.module.css` — Styles: 2 rules (~25 tok)
- `MedicationCatalogPage.tsx` — ALLOWED_EXTENSION_URLS — renders modal (~5042 tok)
- `NoteTemplatesPage.module.css` — Styles: 3 rules (~43 tok)
- `NoteTemplatesPage.tsx` — NoteTemplatesPage — renders table (~2276 tok)
- `SettingsPage.module.css` — Styles: 2 rules (~49 tok)
- `SettingsPage.tsx` — SettingsPage — renders form — uses useState, useEffect (~4572 tok)

## src/pages/auth/

- `RegisterPage.module.css` — Styles: 3 rules (~48 tok)
- `RegisterPage.tsx` — RegisterPage (~298 tok)
- `ResetPasswordPage.module.css` — Styles: 2 rules (~69 tok)
- `ResetPasswordPage.tsx` — ResetPasswordPage — renders form (~1061 tok)
- `SetPasswordPage.module.css` — Styles: 2 rules (~69 tok)
- `SetPasswordPage.tsx` — SetPasswordPage — renders form (~1412 tok)
- `SignInPage.module.css` — Styles: 3 rules (~38 tok)
- `SignInPage.tsx` — SignInPage (~720 tok)

## src/pages/billing/

- `BillingPage.module.css` — Styles: 1 rules (~11 tok)
- `BillingPage.tsx` — BillingPage — uses useState, useEffect (~2319 tok)

## src/pages/encounter/

- `EncounterPage.module.css` — Styles: 2 rules (~46 tok)
- `EncounterPage.tsx` — EncounterPage — uses useState, useEffect (~3972 tok)
- `EncounterPageLayout.module.css` — Styles: 3 rules (~72 tok)

## src/pages/patient/

- `PatientPage.module.css` — Styles: 4 rules (~98 tok)
- `PatientPage.tsx` — PatientPage (~751 tok)

## src/pages/queue/

- `CheckInPage.tsx` — Check-In Page (~4421 tok)
- `ProviderWorkQueuePage.tsx` — Provider Work Queue Page (~12271 tok)
- `QueueDashboardPage.tsx` — Queue Dashboard Page (~4023 tok)

## src/pages/scheduling/

- `BookAppointmentPage.module.css` — Styles: 2 rules (~38 tok)
- `BookAppointmentPage.tsx` — BookAppointmentPage — renders modal — uses useState, useEffect (~4646 tok)
- `ProviderCalendarPage.module.css` — Styles: 6 rules (~82 tok)
- `ProviderCalendarPage.tsx` — ProviderCalendarPage — renders modal (~5992 tok)
- `ScheduleManagementPage.module.css` — Styles: 4 rules (~43 tok)
- `ScheduleManagementPage.tsx` — ScheduleManagementPage — renders table (~3640 tok)

## src/styles/

- `common.css` — Styles: 16 rules, 2 media queries (~520 tok)
- `global.css` — Styles: 1 rules, 1 media queries (~346 tok)
- `variables.css` — Styles: 42 vars (~526 tok)

## src/types/

- `clinicalAlerts.types.ts` — Clinical Alerts Type Definitions (~812 tok)
- `queue.types.ts` — Queue Management Type Definitions (~3918 tok)

## src/utils/

- `appointmentSyncService.ts` — Appointment to Queue Synchronization Service (~3305 tok)
- `appointmentTypes.ts` — Appointment Type definitions (~2382 tok)
- `appointmentUtils.ts` — Book an appointment and mark slot as busy (~2237 tok)
- `bedManagement.test.ts` — Declares makeBed (~1171 tok)
- `bedManagement.ts` — Get all departments (Location resources with physicalType = 'wa' for ward) (~3752 tok)
- `billing.ts` — Create a charge item for a service (~4207 tok)
- `constants.ts` — Application-wide constants (~1018 tok)
- `criticalThresholds.test.ts` — Declares emptyVitals (~3097 tok)
- `criticalThresholds.ts` — Critical Thresholds Configuration and Validation (~1846 tok)
- `dataRefresh.ts` — Data refresh utilities to replace window.location.reload() (~1348 tok)
- `defaultMedications.ts` — Alphabetize and lint the medication list (~1523 tok)
- `detectedIssueUtils.ts` — DetectedIssue FHIR Resource Utilities (~2261 tok)
- `diagnosisCodes.ts` — Exports DIAGNOSIS_VALUESET_URL, getDiagnosisValueSet, initializeDefaultDiagnosisCodes, addDiagnosisCode + 3 more (~1824 tok)
- `diagnosticProviders.ts` — Default diagnostic providers (~1217 tok)
- `encounterUtils.ts` — Checks if an observation is a vital sign (~865 tok)
- `envValidation.ts` — Environment variable validation (~719 tok)
- `errorHandling.ts` — Standard error types for the EMR application (~1599 tok)
- `imagingTests.ts` — Default imaging tests catalog (~2353 tok)
- `labTests.ts` — Default lab tests catalog (~3581 tok)
- `logger.ts` — Centralized logging utility for the EMR application (~1372 tok)
- `medications.ts` — Get all medications from the catalog (~4559 tok)
- `noteTemplates.ts` — Default clinical note templates following common medical documentation standards (~2367 tok)
- `permissions.ts` — Roles and Permissions System (~3629 tok)
- `permissionUtils.ts` — Permission Management Utilities (~3862 tok)
- `queueUtils.test.ts` — Declares request (~5519 tok)
- `queueUtils.ts` — Queue Management Utilities (~11398 tok)
- `scheduleUtils.ts` — Create a Schedule resource for a practitioner (~2569 tok)
- `sessionTimeout.ts` — Session Timeout Management (~1545 tok)
- `settings.ts` — Extension URLs for workflow configuration (~2220 tok)
- `terminologyService.ts` — Terminology Service (~5252 tok)
- `triageUtils.test.ts` — Declares color0 (~1970 tok)
- `triageUtils.ts` — Triage Level Utilities (~2714 tok)
- `validation.ts` — Common validation utilities for form inputs (~2798 tok)
