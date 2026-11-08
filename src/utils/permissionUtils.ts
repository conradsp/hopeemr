/**
 * Permission Management Utilities
 * 
 * This file provides utilities for checking user permissions and roles.
 */

import type { ProjectMembership } from '@medplum/fhirtypes';
import { UserRole, Permission, ROLE_PERMISSIONS } from './permissions';
import { isPolicyRole } from '../security/rolePolicies';

/** The parts of a ProjectMembership that determine a user's roles. */
export type MembershipRoles = Pick<ProjectMembership, 'admin' | 'access'>;

// ============================================================================
// ROLE MANAGEMENT
// ============================================================================

/**
 * Get user roles from the current ProjectMembership.
 * Admin comes from membership.admin; other roles from the role AccessPolicies in
 * membership.access (policy.display carries the role code, see security/rolePolicies.ts).
 * This drives the UI only; the server enforces the policies themselves.
 * @param membership - The user's ProjectMembership
 * @returns Array of user roles
 */
export function getUserRoles(membership: MembershipRoles | null | undefined): UserRole[] {
  if (!membership) {
    return [];
  }
  const roles: UserRole[] = (membership.access ?? [])
    .map((entry) => entry.policy?.display)
    .filter(isPolicyRole);
  if (membership.admin === true) {
    roles.unshift(UserRole.ADMIN);
  }
  return Array.from(new Set(roles));
}

/**
 * Check if user has a specific role
 * @param role - The role to check
 * @param membership - The user's ProjectMembership
 * @returns True if user has the role
 */
export function hasRole(role: UserRole, membership: MembershipRoles | null | undefined): boolean {
  if (membership?.admin === true) {
    return true;
  }
  return getUserRoles(membership).includes(role);
}

/**
 * Check if user has any of the specified roles
 * @param roles - Array of roles to check
 * @param membership - The user's ProjectMembership
 * @returns True if user has any of the roles
 */
export function hasAnyRole(roles: UserRole[], membership: MembershipRoles | null | undefined): boolean {
  if (membership?.admin === true) {
    return true;
  }
  const userRoles = getUserRoles(membership);
  return roles.some(role => userRoles.includes(role));
}

/**
 * Check if user is an admin
 * @param membership - The user's ProjectMembership
 * @returns True if user is an admin
 */
export function isUserAdmin(membership: MembershipRoles | null | undefined): boolean {
  return membership?.admin === true;
}

// ============================================================================
// PERMISSION CHECKING
// ============================================================================

/**
 * Get all permissions for a user based on their roles
 * @param membership - The user's ProjectMembership
 * @returns Array of permissions
 */
export function getUserPermissions(membership: MembershipRoles | null | undefined): Permission[] {
  if (membership?.admin === true) {
    return Object.values(Permission);
  }
  const permissions = new Set<Permission>();
  getUserRoles(membership).forEach(role => {
    (ROLE_PERMISSIONS[role] || []).forEach(permission => permissions.add(permission));
  });
  return Array.from(permissions);
}

/**
 * Check if user has a specific permission
 * @param permission - The permission to check
 * @param membership - The user's ProjectMembership
 * @returns True if user has the permission
 */
export function hasPermission(permission: Permission, membership: MembershipRoles | null | undefined): boolean {
  return getUserPermissions(membership).includes(permission);
}

/**
 * Check if user has all of the specified permissions
 * @param permissions - Array of permissions to check
 * @param membership - The user's ProjectMembership
 * @returns True if user has all of the permissions
 */
export function hasAllPermissions(permissions: Permission[], membership: MembershipRoles | null | undefined): boolean {
  const granted = getUserPermissions(membership);
  return permissions.every(permission => granted.includes(permission));
}

/**
 * Check if user has any of the specified permissions
 * @param permissions - Array of permissions to check
 * @param membership - The user's ProjectMembership
 * @returns True if user has any of the permissions
 */
export function hasAnyPermission(permissions: Permission[], membership: MembershipRoles | null | undefined): boolean {
  const granted = getUserPermissions(membership);
  return permissions.some(permission => granted.includes(permission));
}

// ============================================================================
// NAVIGATION HELPERS
// ============================================================================

/**
 * Check if user can access admin routes
 * @param membership - The user's ProjectMembership
 * @returns True if user can access admin routes
 */
export function canAccessAdmin(membership: MembershipRoles | null | undefined): boolean {
  return hasAnyPermission([
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
 * @param membership - The user's ProjectMembership
 * @returns True if user can access billing
 */
export function canAccessBilling(membership: MembershipRoles | null | undefined): boolean {
  return hasPermission(Permission.VIEW_BILLING, membership);
}

/**
 * Check if user can access scheduling
 * @param membership - The user's ProjectMembership
 * @returns True if user can access scheduling
 */
export function canAccessScheduling(membership: MembershipRoles | null | undefined): boolean {
  return hasAnyPermission([
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
export function getFeatureFlags(membership: MembershipRoles | null | undefined): FeatureFlags {
  return {
    // Navigation
    canViewPatients: hasPermission(Permission.VIEW_PATIENTS, membership),
    canViewBilling: canAccessBilling(membership),
    canViewScheduling: canAccessScheduling(membership),
    canViewAdmin: canAccessAdmin(membership),
    
    // Patient Actions
    canCreatePatients: hasPermission(Permission.CREATE_PATIENTS, membership),
    canEditPatientDemographics: hasPermission(Permission.EDIT_PATIENT_DEMOGRAPHICS, membership),
    canCreateEncounters: hasPermission(Permission.CREATE_ENCOUNTERS, membership),
    
    // Encounter Actions
    canChartVitals: hasPermission(Permission.CHART_VITALS, membership),
    canCreateNotes: hasPermission(Permission.CREATE_CLINICAL_NOTES, membership),
    canPrescribeMedications: hasPermission(Permission.PRESCRIBE_MEDICATIONS, membership),
    canAdministerMedications: hasPermission(Permission.ADMINISTER_MEDICATIONS, membership),
    canOrderLabs: hasPermission(Permission.ORDER_LABS, membership),
    canOrderImaging: hasPermission(Permission.ORDER_IMAGING, membership),
    canAddDiagnoses: hasPermission(Permission.ADD_DIAGNOSES, membership),
    canAssignBeds: hasPermission(Permission.ASSIGN_BEDS, membership),
    
    // Admin Actions
    canManageUsers: hasPermission(Permission.MANAGE_USERS, membership),
    canManageSettings: hasPermission(Permission.MANAGE_SETTINGS, membership),
    canManageMedications: hasPermission(Permission.MANAGE_MEDICATION_CATALOG, membership),
    canManageInventory: hasPermission(Permission.MANAGE_INVENTORY, membership),
    canManageLabTests: hasPermission(Permission.MANAGE_LAB_TESTS, membership),
    canManageImagingTests: hasPermission(Permission.MANAGE_IMAGING_TESTS, membership),
    canManageBeds: hasPermission(Permission.MANAGE_BEDS, membership),
    canManageDepartments: hasPermission(Permission.MANAGE_DEPARTMENTS, membership),
    canManageNoteTemplates: hasPermission(Permission.MANAGE_NOTE_TEMPLATES, membership),
    canManageAppointmentTypes: hasPermission(Permission.MANAGE_APPOINTMENT_TYPES, membership),
    canManageSchedules: hasPermission(Permission.MANAGE_SCHEDULES, membership),
    canManageDiagnosisCodes: hasPermission(Permission.MANAGE_DIAGNOSIS_CODES, membership),
    
    // Billing Actions
    canRecordPayments: hasPermission(Permission.RECORD_PAYMENTS, membership),
    canAdjustCharges: hasPermission(Permission.ADJUST_CHARGES, membership),

    // Queue Management
    canViewQueue: hasPermission(Permission.VIEW_QUEUE, membership),
    canCheckInPatients: hasPermission(Permission.CREATE_QUEUE_ENTRIES, membership),
    canClaimPatients: hasPermission(Permission.CLAIM_QUEUE_PATIENTS, membership),
    canUpdateTriage: hasPermission(Permission.UPDATE_TRIAGE, membership),
  };
}

