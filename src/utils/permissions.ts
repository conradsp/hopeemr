/**
 * Roles and Permissions System
 * 
 * This file defines all user roles and their associated permissions
 * in the EMR system. Permissions are granular and composable.
 */

// ============================================================================
// ROLE DEFINITIONS
// ============================================================================

export enum UserRole {
  ADMIN = 'admin',
  PROVIDER = 'provider',
  NURSE = 'nurse',
  PHARMACY = 'pharmacy',
  LAB = 'lab',
  BILLING = 'billing',
  FRONT_DESK = 'front_desk',
  RADIOLOGY = 'radiology',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Administrator',
  [UserRole.PROVIDER]: 'Provider (Doctor/Physician)',
  [UserRole.NURSE]: 'Nurse',
  [UserRole.PHARMACY]: 'Pharmacy Staff',
  [UserRole.LAB]: 'Laboratory Staff',
  [UserRole.BILLING]: 'Billing Staff',
  [UserRole.FRONT_DESK]: 'Front Desk/Receptionist',
  [UserRole.RADIOLOGY]: 'Radiology Staff',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Full system access, can manage users, settings, and all configurations',
  [UserRole.PROVIDER]: 'Can chart, prescribe medications, order tests, create notes, manage encounters',
  [UserRole.NURSE]: 'Can chart vitals, administer medications, view orders, assist with patient care',
  [UserRole.PHARMACY]: 'Can view prescriptions, manage inventory, dispense medications',
  [UserRole.LAB]: 'Can view lab orders, enter results, manage lab operations',
  [UserRole.BILLING]: 'Can view charges, record payments, manage billing operations',
  [UserRole.FRONT_DESK]: 'Can schedule appointments, check in patients, manage patient demographics',
  [UserRole.RADIOLOGY]: 'Can view imaging orders, upload images, enter results',
};

// ============================================================================
// PERMISSION DEFINITIONS
// ============================================================================

export enum Permission {
  // System Administration
  MANAGE_USERS = 'manage_users',
  MANAGE_SETTINGS = 'manage_settings',
  MANAGE_ROLES = 'manage_roles',
  
  // Patient Management
  VIEW_PATIENTS = 'view_patients',
  CREATE_PATIENTS = 'create_patients',
  EDIT_PATIENT_DEMOGRAPHICS = 'edit_patient_demographics',
  VIEW_PATIENT_HISTORY = 'view_patient_history',
  
  // Encounter Management
  CREATE_ENCOUNTERS = 'create_encounters',
  EDIT_ENCOUNTERS = 'edit_encounters',
  VIEW_ENCOUNTERS = 'view_encounters',
  CLOSE_ENCOUNTERS = 'close_encounters',
  
  // Clinical Charting
  CHART_VITALS = 'chart_vitals',
  VIEW_VITALS = 'view_vitals',
  CREATE_CLINICAL_NOTES = 'create_clinical_notes',
  VIEW_CLINICAL_NOTES = 'view_clinical_notes',
  EDIT_CLINICAL_NOTES = 'edit_clinical_notes',
  
  // Medications
  PRESCRIBE_MEDICATIONS = 'prescribe_medications',
  ADMINISTER_MEDICATIONS = 'administer_medications',
  VIEW_MEDICATIONS = 'view_medications',
  MANAGE_MEDICATION_CATALOG = 'manage_medication_catalog',
  MANAGE_INVENTORY = 'manage_inventory',
  VIEW_INVENTORY = 'view_inventory',
  
  // Orders (Labs & Imaging)
  ORDER_LABS = 'order_labs',
  ORDER_IMAGING = 'order_imaging',
  VIEW_ORDERS = 'view_orders',
  ENTER_LAB_RESULTS = 'enter_lab_results',
  ENTER_IMAGING_RESULTS = 'enter_imaging_results',
  MANAGE_LAB_TESTS = 'manage_lab_tests',
  MANAGE_IMAGING_TESTS = 'manage_imaging_tests',
  
  // Diagnoses
  ADD_DIAGNOSES = 'add_diagnoses',
  VIEW_DIAGNOSES = 'view_diagnoses',
  MANAGE_DIAGNOSIS_CODES = 'manage_diagnosis_codes',
  
  // Scheduling
  SCHEDULE_APPOINTMENTS = 'schedule_appointments',
  VIEW_APPOINTMENTS = 'view_appointments',
  MANAGE_SCHEDULES = 'manage_schedules',
  MANAGE_APPOINTMENT_TYPES = 'manage_appointment_types',
  
  // Billing
  VIEW_BILLING = 'view_billing',
  RECORD_PAYMENTS = 'record_payments',
  VIEW_CHARGES = 'view_charges',
  ADJUST_CHARGES = 'adjust_charges',
  
  // Bed Management
  ASSIGN_BEDS = 'assign_beds',
  RELEASE_BEDS = 'release_beds',
  VIEW_BEDS = 'view_beds',
  MANAGE_BEDS = 'manage_beds',
  MANAGE_DEPARTMENTS = 'manage_departments',
  
  // Templates & Configuration
  MANAGE_NOTE_TEMPLATES = 'manage_note_templates',
  MANAGE_DIAGNOSTIC_PROVIDERS = 'manage_diagnostic_providers',

  // Queue Management (Security Agent requirement: granular permissions)
  VIEW_QUEUE = 'view_queue',
  VIEW_QUEUE_PHI = 'view_queue_phi', // See full patient names & details
  VIEW_QUEUE_CHIEF_COMPLAINTS = 'view_queue_chief_complaints', // See medical details
  CREATE_QUEUE_ENTRIES = 'create_queue_entries',
  CLAIM_QUEUE_PATIENTS = 'claim_queue_patients',
  UPDATE_TRIAGE = 'update_triage',
  DELETE_QUEUE_ENTRY = 'delete_queue_entry',
  REASSIGN_QUEUE_PATIENT = 'reassign_queue_patient',
  MANAGE_QUEUE = 'manage_queue',
  VIEW_QUEUE_METRICS = 'view_queue_metrics',
}

// ============================================================================
// ROLE-PERMISSION MAPPING
// ============================================================================

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    // Admins have ALL permissions
    ...Object.values(Permission),
  ],
  
  [UserRole.PROVIDER]: [
    // Patient Management
    Permission.VIEW_PATIENTS,
    Permission.CREATE_PATIENTS,
    Permission.EDIT_PATIENT_DEMOGRAPHICS,
    Permission.VIEW_PATIENT_HISTORY,

    // Encounter Management
    Permission.CREATE_ENCOUNTERS,
    Permission.EDIT_ENCOUNTERS,
    Permission.VIEW_ENCOUNTERS,
    Permission.CLOSE_ENCOUNTERS,

    // Clinical Charting
    Permission.CHART_VITALS,
    Permission.VIEW_VITALS,
    Permission.CREATE_CLINICAL_NOTES,
    Permission.VIEW_CLINICAL_NOTES,
    Permission.EDIT_CLINICAL_NOTES,

    // Medications
    Permission.PRESCRIBE_MEDICATIONS,
    Permission.ADMINISTER_MEDICATIONS,
    Permission.VIEW_MEDICATIONS,
    Permission.VIEW_INVENTORY,

    // Orders
    Permission.ORDER_LABS,
    Permission.ORDER_IMAGING,
    Permission.VIEW_ORDERS,

    // Diagnoses
    Permission.ADD_DIAGNOSES,
    Permission.VIEW_DIAGNOSES,

    // Scheduling
    Permission.SCHEDULE_APPOINTMENTS,
    Permission.VIEW_APPOINTMENTS,

    // Billing (View Only)
    Permission.VIEW_BILLING,
    Permission.VIEW_CHARGES,

    // Bed Management
    Permission.ASSIGN_BEDS,
    Permission.RELEASE_BEDS,
    Permission.VIEW_BEDS,

    // Queue Management
    Permission.VIEW_QUEUE,
    Permission.VIEW_QUEUE_PHI,
    Permission.VIEW_QUEUE_CHIEF_COMPLAINTS,
    Permission.CLAIM_QUEUE_PATIENTS,
    Permission.UPDATE_TRIAGE,
    Permission.VIEW_QUEUE_METRICS,
  ],
  
  [UserRole.NURSE]: [
    // Patient Management
    Permission.VIEW_PATIENTS,
    Permission.VIEW_PATIENT_HISTORY,

    // Encounter Management
    Permission.VIEW_ENCOUNTERS,

    // Clinical Charting
    Permission.CHART_VITALS,
    Permission.VIEW_VITALS,
    Permission.VIEW_CLINICAL_NOTES,

    // Medications (Administer only, cannot prescribe)
    Permission.ADMINISTER_MEDICATIONS,
    Permission.VIEW_MEDICATIONS,
    Permission.VIEW_INVENTORY,

    // Orders (View only)
    Permission.VIEW_ORDERS,

    // Diagnoses (View only)
    Permission.VIEW_DIAGNOSES,

    // Scheduling
    Permission.VIEW_APPOINTMENTS,

    // Bed Management
    Permission.VIEW_BEDS,
    Permission.ASSIGN_BEDS,
    Permission.RELEASE_BEDS,

    // Queue Management (Nurses handle triage)
    Permission.VIEW_QUEUE,
    Permission.VIEW_QUEUE_PHI,
    Permission.VIEW_QUEUE_CHIEF_COMPLAINTS,
    Permission.CLAIM_QUEUE_PATIENTS,
    Permission.UPDATE_TRIAGE,
    Permission.REASSIGN_QUEUE_PATIENT,
  ],
  
  [UserRole.PHARMACY]: [
    // Patient Management (Limited)
    Permission.VIEW_PATIENTS,
    
    // Medications
    Permission.VIEW_MEDICATIONS,
    Permission.ADMINISTER_MEDICATIONS, // For dispensing
    Permission.MANAGE_MEDICATION_CATALOG,
    Permission.MANAGE_INVENTORY,
    Permission.VIEW_INVENTORY,
    
    // View prescriptions through orders
    Permission.VIEW_ORDERS,
  ],
  
  [UserRole.LAB]: [
    // Patient Management (Limited)
    Permission.VIEW_PATIENTS,
    
    // Orders - Lab specific
    Permission.VIEW_ORDERS,
    Permission.ENTER_LAB_RESULTS,
    
    // Lab Management
    Permission.MANAGE_LAB_TESTS,
  ],
  
  [UserRole.BILLING]: [
    // Patient Management (For billing lookup)
    Permission.VIEW_PATIENTS,
    
    // Billing - Full access
    Permission.VIEW_BILLING,
    Permission.RECORD_PAYMENTS,
    Permission.VIEW_CHARGES,
    Permission.ADJUST_CHARGES,
    
    // View encounters for billing context
    Permission.VIEW_ENCOUNTERS,
  ],
  
  [UserRole.FRONT_DESK]: [
    // Patient Management
    Permission.VIEW_PATIENTS,
    Permission.CREATE_PATIENTS,
    Permission.EDIT_PATIENT_DEMOGRAPHICS,

    // Scheduling - Full access
    Permission.SCHEDULE_APPOINTMENTS,
    Permission.VIEW_APPOINTMENTS,

    // Encounters (Check-in/Check-out)
    Permission.CREATE_ENCOUNTERS,
    Permission.VIEW_ENCOUNTERS,

    // Billing (Basic)
    Permission.VIEW_BILLING,
    Permission.RECORD_PAYMENTS,

    // Queue Management (Check-in, no clinical details)
    // Security Agent: Front desk can see PHI for check-in but NOT chief complaints
    Permission.VIEW_QUEUE,
    Permission.VIEW_QUEUE_PHI,
    Permission.CREATE_QUEUE_ENTRIES,
    Permission.DELETE_QUEUE_ENTRY,
  ],
  
  [UserRole.RADIOLOGY]: [
    // Patient Management (Limited)
    Permission.VIEW_PATIENTS,
    
    // Orders - Imaging specific
    Permission.VIEW_ORDERS,
    Permission.ENTER_IMAGING_RESULTS,
    
    // Imaging Management
    Permission.MANAGE_IMAGING_TESTS,
  ],
};

// ============================================================================
// PERMISSION GROUPS (for UI organization)
// ============================================================================

export const PERMISSION_GROUPS = {
  system: {
    label: 'System Administration',
    permissions: [
      Permission.MANAGE_USERS,
      Permission.MANAGE_SETTINGS,
      Permission.MANAGE_ROLES,
    ],
  },
  patients: {
    label: 'Patient Management',
    permissions: [
      Permission.VIEW_PATIENTS,
      Permission.CREATE_PATIENTS,
      Permission.EDIT_PATIENT_DEMOGRAPHICS,
      Permission.VIEW_PATIENT_HISTORY,
    ],
  },
  encounters: {
    label: 'Encounter Management',
    permissions: [
      Permission.CREATE_ENCOUNTERS,
      Permission.EDIT_ENCOUNTERS,
      Permission.VIEW_ENCOUNTERS,
      Permission.CLOSE_ENCOUNTERS,
    ],
  },
  charting: {
    label: 'Clinical Charting',
    permissions: [
      Permission.CHART_VITALS,
      Permission.VIEW_VITALS,
      Permission.CREATE_CLINICAL_NOTES,
      Permission.VIEW_CLINICAL_NOTES,
      Permission.EDIT_CLINICAL_NOTES,
    ],
  },
  medications: {
    label: 'Medications',
    permissions: [
      Permission.PRESCRIBE_MEDICATIONS,
      Permission.ADMINISTER_MEDICATIONS,
      Permission.VIEW_MEDICATIONS,
      Permission.MANAGE_MEDICATION_CATALOG,
      Permission.MANAGE_INVENTORY,
      Permission.VIEW_INVENTORY,
    ],
  },
  orders: {
    label: 'Orders (Labs & Imaging)',
    permissions: [
      Permission.ORDER_LABS,
      Permission.ORDER_IMAGING,
      Permission.VIEW_ORDERS,
      Permission.ENTER_LAB_RESULTS,
      Permission.ENTER_IMAGING_RESULTS,
      Permission.MANAGE_LAB_TESTS,
      Permission.MANAGE_IMAGING_TESTS,
    ],
  },
  diagnoses: {
    label: 'Diagnoses',
    permissions: [
      Permission.ADD_DIAGNOSES,
      Permission.VIEW_DIAGNOSES,
      Permission.MANAGE_DIAGNOSIS_CODES,
    ],
  },
  scheduling: {
    label: 'Scheduling',
    permissions: [
      Permission.SCHEDULE_APPOINTMENTS,
      Permission.VIEW_APPOINTMENTS,
      Permission.MANAGE_SCHEDULES,
      Permission.MANAGE_APPOINTMENT_TYPES,
    ],
  },
  billing: {
    label: 'Billing',
    permissions: [
      Permission.VIEW_BILLING,
      Permission.RECORD_PAYMENTS,
      Permission.VIEW_CHARGES,
      Permission.ADJUST_CHARGES,
    ],
  },
  beds: {
    label: 'Bed Management',
    permissions: [
      Permission.ASSIGN_BEDS,
      Permission.RELEASE_BEDS,
      Permission.VIEW_BEDS,
      Permission.MANAGE_BEDS,
      Permission.MANAGE_DEPARTMENTS,
    ],
  },
  configuration: {
    label: 'Templates & Configuration',
    permissions: [
      Permission.MANAGE_NOTE_TEMPLATES,
      Permission.MANAGE_DIAGNOSTIC_PROVIDERS,
    ],
  },
  queue: {
    label: 'Queue Management',
    permissions: [
      Permission.VIEW_QUEUE,
      Permission.VIEW_QUEUE_PHI,
      Permission.VIEW_QUEUE_CHIEF_COMPLAINTS,
      Permission.CREATE_QUEUE_ENTRIES,
      Permission.CLAIM_QUEUE_PATIENTS,
      Permission.UPDATE_TRIAGE,
      Permission.DELETE_QUEUE_ENTRY,
      Permission.REASSIGN_QUEUE_PATIENT,
      Permission.MANAGE_QUEUE,
      Permission.VIEW_QUEUE_METRICS,
    ],
  },
};
