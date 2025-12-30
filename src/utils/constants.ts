/**
 * Application-wide constants
 * Centralized location for magic numbers, strings, and configuration
 */

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
} as const;

// Search
export const SEARCH = {
  MIN_SEARCH_LENGTH: 2,
  SEARCH_DEBOUNCE_MS: 300,
  MAX_RESULTS: 100,
} as const;

// Timeouts
export const TIMEOUTS = {
  API_REQUEST: 30000, // 30 seconds
  DEBOUNCE: 300, // 300ms
  TOAST_DURATION: 5000, // 5 seconds
} as const;

// Date/Time
export const DATE_TIME = {
  DEFAULT_FORMAT: 'MMM dd, yyyy',
  TIME_FORMAT: 'HH:mm',
  DATETIME_FORMAT: 'MMM dd, yyyy HH:mm',
} as const;

// Scheduling
export const SCHEDULING = {
  MIN_APPOINTMENT_DURATION: 5, // minutes
  MAX_APPOINTMENT_DURATION: 480, // 8 hours
  DEFAULT_DURATION: 30,
  SLOT_INTERVAL: 15, // minutes
  BUSINESS_HOURS_START: 8, // 8 AM
  BUSINESS_HOURS_END: 18, // 6 PM
} as const;

// Billing
export const BILLING = {
  CURRENCY: 'USD',
  DECIMAL_PLACES: 2,
  MIN_PAYMENT: 0.01,
  MAX_PAYMENT: 999999.99,
} as const;

// Vitals - Normal Ranges
export const VITAL_RANGES = {
  HEART_RATE: { min: 60, max: 100, unit: 'bpm' },
  BLOOD_PRESSURE_SYSTOLIC: { min: 90, max: 140, unit: 'mmHg' },
  BLOOD_PRESSURE_DIASTOLIC: { min: 60, max: 90, unit: 'mmHg' },
  TEMPERATURE: { min: 97.0, max: 99.5, unit: '°F' },
  RESPIRATORY_RATE: { min: 12, max: 20, unit: '/min' },
  OXYGEN_SATURATION: { min: 95, max: 100, unit: '%' },
} as const;

// File Upload
export const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.pdf'],
} as const;

// Validation
export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 8,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 100,
  PHONE_LENGTH: 10,
  ZIP_CODE_LENGTH: 5,
} as const;

// UI
export const UI = {
  SIDEBAR_WIDTH: 280,
  HEADER_HEIGHT: 64,
  MODAL_SIZES: {
    SM: 'sm',
    MD: 'md',
    LG: 'lg',
    XL: 'xl',
  },
} as const;

// Status Colors
export const STATUS_COLORS = {
  active: 'green',
  inactive: 'gray',
  pending: 'yellow',
  completed: 'blue',
  cancelled: 'red',
  draft: 'orange',
} as const;

// FHIR
export const FHIR = {
  DEFAULT_COUNT: 100,
  MAX_COUNT: 1000,
} as const;

// Routes
export const ROUTES = {
  HOME: '/',
  PATIENTS: '/patients',
  PATIENT: (id: string) => `/patient/${id}`,
  ENCOUNTER: (id: string) => `/Encounter/${id}`,
  BILLING: '/billing',
  ADMIN: {
    USERS: '/admin/users',
    SETTINGS: '/admin/settings',
    MEDICATIONS: '/admin/medications',
    LAB_TESTS: '/admin/lab-tests',
    IMAGING_TESTS: '/admin/imaging-tests',
    APPOINTMENT_TYPES: '/admin/appointment-types',
    DEPARTMENTS: '/admin/departments',
    BEDS: '/admin/beds',
  },
  SCHEDULING: {
    BOOK: '/scheduling/book',
    CALENDAR: '/scheduling/calendar',
    MANAGE: '/scheduling/manage',
  },
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  GENERIC: 'An unexpected error occurred. Please try again.',
  NETWORK: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  VALIDATION: 'Please check your input and try again.',
  SERVER: 'Server error. Please try again later.',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  SAVE: 'Saved successfully',
  DELETE: 'Deleted successfully',
  UPDATE: 'Updated successfully',
  CREATE: 'Created successfully',
} as const;

