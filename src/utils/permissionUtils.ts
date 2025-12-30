/**
 * Permission Management Utilities
 * 
 * This file provides utilities for checking user permissions and roles.
 */

import { Practitioner, PractitionerRole } from '@medplum/fhirtypes';
import { UserRole, Permission, ROLE_PERMISSIONS } from './permissions';

// ============================================================================
// FHIR EXTENSIONS
// ============================================================================

const USER_ROLES_EXTENSION_URL = 'http://example.org/fhir/StructureDefinition/user-roles';

// ============================================================================
// ROLE MANAGEMENT
// ============================================================================

/**
 * Get user roles from a Practitioner resource
 * @param practitioner - The Practitioner resource or null
 * @returns Array of user roles
 */
export function getUserRoles(practitioner: Practitioner | null): UserRole[] {
  if (!practitioner) {
    return [];
  }
  const extension = practitioner.extension?.find(
    (ext) => ext.url === USER_ROLES_EXTENSION_URL
  );
  if (!extension?.valueString) {
    return [];
  }
  try {
    const roles = JSON.parse(extension.valueString);
    return Array.isArray(roles) ? roles : [];
  } catch {
    return [];
  }
}

/**
 * Set user roles on a Practitioner resource
 * @param practitioner - The Practitioner resource
 * @param roles - Array of user roles to set
 * @returns The updated Practitioner resource
 */
export function setUserRoles(practitioner: Practitioner, roles: UserRole[]): Practitioner {
  const otherExtensions = practitioner.extension?.filter(
    (ext) => ext.url !== USER_ROLES_EXTENSION_URL
  ) || [];
  
  return {
    ...practitioner,
    extension: [
      ...otherExtensions,
      {
        url: USER_ROLES_EXTENSION_URL,
        valueString: JSON.stringify(roles),
      },
    ],
  };
}

/**
 * Check if user has a specific role
 * @param practitioner - The Practitioner resource or null
 * @param role - The role to check
 * @param membership - The membership object
 * @param membership.admin - Whether the user is an admin
 * @returns True if user has the role
 */
export function hasRole(practitioner: Practitioner | null | undefined, role: UserRole, membership?: { admin?: boolean }): boolean {
  if (membership?.admin === true) {
    return true;
  }
  if (!practitioner) {
    return false;
  }
  const roles = getUserRoles(practitioner);
  return roles.includes(role);
}

/**
 * Check if user has any of the specified roles
 * @param practitioner - The Practitioner resource or null
 * @param roles - Array of roles to check
 * @param membership - The membership object
 * @param membership.admin - Whether the user is an admin
 * @returns True if user has any of the roles
 */
export function hasAnyRole(practitioner: Practitioner | null | undefined, roles: UserRole[], membership?: { admin?: boolean }): boolean {
  if (membership?.admin === true) {
    return true;
  }
  if (!practitioner) {
    return false;
  }
  const userRoles = getUserRoles(practitioner);
  return roles.some(role => userRoles.includes(role));
}

/**
 * Check if user is an admin
 * @param practitioner - The Practitioner resource or null
 * @param membership - The membership object
 * @param membership.admin - Whether the user is an admin
 * @returns True if user is an admin
 */
export function isUserAdmin(practitioner: Practitioner | null | undefined, membership?: { admin?: boolean }): boolean {
  return membership?.admin === true || hasRole(practitioner, UserRole.ADMIN);
}

// ============================================================================
// PERMISSION CHECKING
// ============================================================================

/**
 * Get all permissions for a user based on their roles
 * @param practitioner - The Practitioner resource or null
 * @param membership - The membership object
 * @param membership.admin - Whether the user is an admin
 * @returns Array of permissions
 */
export function getUserPermissions(practitioner: Practitioner | null | undefined, membership?: { admin?: boolean }): Permission[] {
  if (membership?.admin === true) {
    // Return all permissions
    return Object.values(Permission);
  }
  if (!practitioner) {
    return [];
  }
  const roles = getUserRoles(practitioner);
  const permissions = new Set<Permission>();
  roles.forEach(role => {
    const rolePermissions = ROLE_PERMISSIONS[role] || [];
    rolePermissions.forEach(permission => permissions.add(permission));
  });
  return Array.from(permissions);
}

/**
 * Check if user has a specific permission
 * @param practitioner - The Practitioner resource or null
 * @param permission - The permission to check
 * @param membership - The membership object
 * @param membership.admin - Whether the user is an admin
 * @returns True if user has the permission
 */
export function hasPermission(
  practitioner: Practitioner | null | undefined,
  permission: Permission,
  membership?: { admin?: boolean }
): boolean {
  if (membership?.admin === true) {
    return true;
  }
  if (!practitioner) {
    return false;
  }
  if (isUserAdmin(practitioner, membership)) {
    return true;
  }
  const permissions = getUserPermissions(practitioner);
  return permissions.includes(permission);
}

/**
 * Check if user has all of the specified permissions
 * @param practitioner - The Practitioner resource or null
 * @param permissions - Array of permissions to check
 * @param membership - The membership object
 * @param membership.admin - Whether the user is an admin
 * @returns True if user has all of the permissions
 */
export function hasAllPermissions(
  practitioner: Practitioner | null | undefined,
  permissions: Permission[],
  membership?: { admin?: boolean }
): boolean {
  if (membership?.admin === true) {
    return true;
  }
  if (!practitioner) {
    return false;
  }
  return permissions.every(permission => hasPermission(practitioner, permission, membership));
}

/**
 * Check if user has any of the specified permissions
 * @param practitioner - The Practitioner resource or null
 * @param permissions - Array of permissions to check
 * @param membership - The membership object
 * @param membership.admin - Whether the user is an admin
 * @returns True if user has any of the permissions
 */
export function hasAnyPermission(
  practitioner: Practitioner | null | undefined,
  permissions: Permission[],
  membership?: { admin?: boolean }
): boolean {
  if (membership?.admin === true) {
    return true;
  }
  if (!practitioner) {
    return false;
  }
  return permissions.some(permission => hasPermission(practitioner, permission, membership));
}

// ============================================================================
// NAVIGATION HELPERS
// ============================================================================

/**
 * Check if user can access admin routes
 * @param practitioner - The Practitioner resource or null
 * @param membership - The membership object
 * @param membership.admin - Whether the user is an admin
 * @returns True if user can access admin routes
 */
export function canAccessAdmin(practitioner: Practitioner | null | undefined, membership?: { admin?: boolean }): boolean {
  return hasAnyPermission(practitioner, [
    Permission.MANAGE_USERS,
    Permission.MANAGE_SETTINGS,
    Permission.MANAGE_MEDICATION_CATALOG,
    Permission.MANAGE_INVENTORY,
    Permission.MANAGE_LAB_TESTS,
    Permission.MANAGE_IMAGING_TESTS,
    Permission.MANAGE_BEDS,
    Permission.MANAGE_DEPARTMENTS,
    Permission.MANAGE_NOTE_TEMPLATES,
    Permission.MANAGE_APPOINTMENT_TYPES,
    Permission.MANAGE_SCHEDULES,
    Permission.MANAGE_DIAGNOSIS_CODES,
  ], membership);
}

/**
 * Check if user can access billing
 * @param practitioner - The Practitioner resource or null
 * @param membership - The membership object
 * @param membership.admin - Whether the user is an admin
 * @returns True if user can access billing
 */
export function canAccessBilling(practitioner: Practitioner | null | undefined, membership?: { admin?: boolean }): boolean {
  return hasPermission(practitioner, Permission.VIEW_BILLING, membership);
}

/**
 * Check if user can access scheduling
 * @param practitioner - The Practitioner resource or null
 * @param membership - The membership object
 * @param membership.admin - Whether the user is an admin
 * @returns True if user can access scheduling
 */
export function canAccessScheduling(practitioner: Practitioner | null | undefined, membership?: { admin?: boolean }): boolean {
  return hasAnyPermission(practitioner, [
    Permission.SCHEDULE_APPOINTMENTS,
    Permission.VIEW_APPOINTMENTS,
    Permission.MANAGE_SCHEDULES,
  ], membership);
}

// ============================================================================
// FEATURE FLAGS
// ============================================================================

/**
 * Get feature visibility based on user permissions
 */
export interface FeatureFlags {
  // Navigation
  canViewPatients: boolean;
  canViewBilling: boolean;
  canViewScheduling: boolean;
  canViewAdmin: boolean;
  
  // Patient Actions
  canCreatePatients: boolean;
  canEditPatientDemographics: boolean;
  canCreateEncounters: boolean;
  
  // Encounter Actions
  canChartVitals: boolean;
  canCreateNotes: boolean;
  canPrescribeMedications: boolean;
  canAdministerMedications: boolean;
  canOrderLabs: boolean;
  canOrderImaging: boolean;
  canAddDiagnoses: boolean;
  canAssignBeds: boolean;
  
  // Admin Actions
  canManageUsers: boolean;
  canManageSettings: boolean;
  canManageMedications: boolean;
  canManageInventory: boolean;
  canManageLabTests: boolean;
  canManageImagingTests: boolean;
  canManageBeds: boolean;
  canManageDepartments: boolean;
  canManageNoteTemplates: boolean;
  canManageAppointmentTypes: boolean;
  canManageSchedules: boolean;
  canManageDiagnosisCodes: boolean;
  
  // Billing Actions
  canRecordPayments: boolean;
  canAdjustCharges: boolean;

  // Queue Management
  canViewQueue: boolean;
  canCheckInPatients: boolean;
  canClaimPatients: boolean;
  canUpdateTriage: boolean;
}

/**
 * Get all feature flags for a user
 */
export function getFeatureFlags(practitioner: Practitioner | null | undefined, membership?: { admin?: boolean }): FeatureFlags {
  return {
    // Navigation
    canViewPatients: hasPermission(practitioner, Permission.VIEW_PATIENTS, membership),
    canViewBilling: canAccessBilling(practitioner, membership),
    canViewScheduling: canAccessScheduling(practitioner, membership),
    canViewAdmin: canAccessAdmin(practitioner, membership),
    
    // Patient Actions
    canCreatePatients: hasPermission(practitioner, Permission.CREATE_PATIENTS, membership),
    canEditPatientDemographics: hasPermission(practitioner, Permission.EDIT_PATIENT_DEMOGRAPHICS, membership),
    canCreateEncounters: hasPermission(practitioner, Permission.CREATE_ENCOUNTERS, membership),
    
    // Encounter Actions
    canChartVitals: hasPermission(practitioner, Permission.CHART_VITALS, membership),
    canCreateNotes: hasPermission(practitioner, Permission.CREATE_CLINICAL_NOTES, membership),
    canPrescribeMedications: hasPermission(practitioner, Permission.PRESCRIBE_MEDICATIONS, membership),
    canAdministerMedications: hasPermission(practitioner, Permission.ADMINISTER_MEDICATIONS, membership),
    canOrderLabs: hasPermission(practitioner, Permission.ORDER_LABS, membership),
    canOrderImaging: hasPermission(practitioner, Permission.ORDER_IMAGING, membership),
    canAddDiagnoses: hasPermission(practitioner, Permission.ADD_DIAGNOSES, membership),
    canAssignBeds: hasPermission(practitioner, Permission.ASSIGN_BEDS, membership),
    
    // Admin Actions
    canManageUsers: hasPermission(practitioner, Permission.MANAGE_USERS, membership),
    canManageSettings: hasPermission(practitioner, Permission.MANAGE_SETTINGS, membership),
    canManageMedications: hasPermission(practitioner, Permission.MANAGE_MEDICATION_CATALOG, membership),
    canManageInventory: hasPermission(practitioner, Permission.MANAGE_INVENTORY, membership),
    canManageLabTests: hasPermission(practitioner, Permission.MANAGE_LAB_TESTS, membership),
    canManageImagingTests: hasPermission(practitioner, Permission.MANAGE_IMAGING_TESTS, membership),
    canManageBeds: hasPermission(practitioner, Permission.MANAGE_BEDS, membership),
    canManageDepartments: hasPermission(practitioner, Permission.MANAGE_DEPARTMENTS, membership),
    canManageNoteTemplates: hasPermission(practitioner, Permission.MANAGE_NOTE_TEMPLATES, membership),
    canManageAppointmentTypes: hasPermission(practitioner, Permission.MANAGE_APPOINTMENT_TYPES, membership),
    canManageSchedules: hasPermission(practitioner, Permission.MANAGE_SCHEDULES, membership),
    canManageDiagnosisCodes: hasPermission(practitioner, Permission.MANAGE_DIAGNOSIS_CODES, membership),
    
    // Billing Actions
    canRecordPayments: hasPermission(practitioner, Permission.RECORD_PAYMENTS, membership),
    canAdjustCharges: hasPermission(practitioner, Permission.ADJUST_CHARGES, membership),

    // Queue Management
    canViewQueue: hasPermission(practitioner, Permission.VIEW_QUEUE, membership),
    canCheckInPatients: hasPermission(practitioner, Permission.CREATE_QUEUE_ENTRIES, membership),
    canClaimPatients: hasPermission(practitioner, Permission.CLAIM_QUEUE_PATIENTS, membership),
    canUpdateTriage: hasPermission(practitioner, Permission.UPDATE_TRIAGE, membership),
  };
}

