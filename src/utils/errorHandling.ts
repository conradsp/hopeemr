import { notifications } from '@mantine/notifications';
import { OperationOutcome } from '@medplum/fhirtypes';

/**
 * Standard error types for the EMR application
 */
export enum ErrorType {
  VALIDATION = 'validation',
  NETWORK = 'network',
  PERMISSION = 'permission',
  NOT_FOUND = 'not_found',
  SERVER = 'server',
  UNKNOWN = 'unknown',
}

/**
 * Custom error class with additional context
 */
export class EMRError extends Error {
  type: ErrorType;
  originalError?: Error;
  context?: Record<string, any>;

  constructor(
    message: string,
    type: ErrorType = ErrorType.UNKNOWN,
    originalError?: Error,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = 'EMRError';
    this.type = type;
    this.originalError = originalError;
    this.context = context;
  }
}

/**
 * Parse FHIR OperationOutcome to extract error message
 */
function parseOperationOutcome(outcome: OperationOutcome): string {
  if (outcome.issue && outcome.issue.length > 0) {
    const messages = outcome.issue
      .map((issue) => issue.diagnostics || issue.details?.text)
      .filter(Boolean)
      .join('; ');
    return messages || 'An error occurred';
  }
  return 'An error occurred';
}

/**
 * Classify error and extract meaningful message
 */
export function classifyError(error: any): { type: ErrorType; message: string; details?: string } {
  // Network errors
  if (error.message?.includes('fetch') || error.message?.includes('network')) {
    return {
      type: ErrorType.NETWORK,
      message: 'Network error. Please check your connection and try again.',
      details: error.message,
    };
  }

  // FHIR OperationOutcome
  if (error.outcome && typeof error.outcome === 'object') {
    const message = parseOperationOutcome(error.outcome);
    return {
      type: ErrorType.SERVER,
      message,
      details: JSON.stringify(error.outcome),
    };
  }

  // HTTP status codes
  if (error.response?.status) {
    const status = error.response.status;
    if (status === 401 || status === 403) {
      return {
        type: ErrorType.PERMISSION,
        message: 'You do not have permission to perform this action.',
        details: error.message,
      };
    }
    if (status === 404) {
      return {
        type: ErrorType.NOT_FOUND,
        message: 'The requested resource was not found.',
        details: error.message,
      };
    }
    if (status >= 500) {
      return {
        type: ErrorType.SERVER,
        message: 'Server error. Please try again later.',
        details: error.message,
      };
    }
  }

  // Validation errors
  if (error.message?.includes('validation') || error.message?.includes('invalid')) {
    return {
      type: ErrorType.VALIDATION,
      message: error.message,
      details: error.message,
    };
  }

  // Default unknown error
  return {
    type: ErrorType.UNKNOWN,
    message: error.message || 'An unexpected error occurred. Please try again.',
    details: error.stack,
  };
}

/**
 * Handle error and show appropriate notification to user
 */
export function handleError(error: any, context?: string): void {
  const classified = classifyError(error);
  
  // Log error for debugging (will be replaced with proper logging)
  if (import.meta.env.DEV) {
    console.error(`[${context || 'Error'}]:`, {
      type: classified.type,
      message: classified.message,
      details: classified.details,
      originalError: error,
    });
  }

  // Show user-friendly notification
  notifications.show({
    title: getErrorTitle(classified.type, context),
    message: classified.message,
    color: 'red',
    autoClose: classified.type === ErrorType.NETWORK ? 5000 : 4000,
  });
}

/**
 * Get appropriate error title based on type and context
 */
function getErrorTitle(type: ErrorType, context?: string): string {
  const action = context ? ` ${context}` : '';
  
  switch (type) {
    case ErrorType.VALIDATION:
      return `Validation Error${action}`;
    case ErrorType.NETWORK:
      return 'Connection Error';
    case ErrorType.PERMISSION:
      return 'Permission Denied';
    case ErrorType.NOT_FOUND:
      return 'Not Found';
    case ErrorType.SERVER:
      return 'Server Error';
    default:
      return `Error${action}`;
  }
}

/**
 * Async error wrapper that handles errors and shows notifications
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context?: string,
  onError?: (error: any) => void
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    handleError(error, context);
    if (onError) {
      onError(error);
    }
    return undefined;
  }
}

/**
 * Validation helper
 */
export function validateRequired(fields: Record<string, any>): string[] {
  const errors: string[] = [];
  for (const [fieldName, value] of Object.entries(fields)) {
    if (!value || (typeof value === 'string' && !value.trim())) {
      errors.push(`${fieldName} is required`);
    }
  }
  return errors;
}

/**
 * Show success notification
 */
export function showSuccess(message: string, title: string = 'Success'): void {
  notifications.show({
    title,
    message,
    color: 'green',
    autoClose: 3000,
  });
}

/**
 * Show info notification
 */
export function showInfo(message: string, title: string = 'Info'): void {
  notifications.show({
    title,
    message,
    color: 'blue',
    autoClose: 4000,
  });
}

/**
 * Show warning notification
 */
export function showWarning(message: string, title: string = 'Warning'): void {
  notifications.show({
    title,
    message,
    color: 'yellow',
    autoClose: 4000,
  });
}

