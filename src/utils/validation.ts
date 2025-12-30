/**
 * Common validation utilities for form inputs
 */

export const validators = {
  /**
   * Check if value is not empty
   */
  required: (value: string | number | null | undefined): boolean => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    return true;
  },

  /**
   * Validate email format
   */
  email: (value: string): boolean => {
    if (!value) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  },

  /**
   * Validate phone number (US format)
   */
  phone: (value: string): boolean => {
    if (!value) return false;
    const cleaned = value.replace(/\D/g, '');
    return cleaned.length === 10 || cleaned.length === 11;
  },

  /**
   * Check if number is positive
   */
  positive: (value: number): boolean => {
    return value > 0;
  },

  /**
   * Check if number is non-negative
   */
  nonNegative: (value: number): boolean => {
    return value >= 0;
  },

  /**
   * Check if number is within range
   */
  range: (value: number, min: number, max: number): boolean => {
    return value >= min && value <= max;
  },

  /**
   * Validate minimum length
   */
  minLength: (value: string, length: number): boolean => {
    if (!value) return false;
    return value.trim().length >= length;
  },

  /**
   * Validate maximum length
   */
  maxLength: (value: string, length: number): boolean => {
    if (!value) return true; // Empty values are valid for maxLength
    return value.trim().length <= length;
  },

  /**
   * Validate URL format
   */
  url: (value: string): boolean => {
    if (!value) return false;
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Validate date is not in the past
   */
  notPast: (date: Date | string): boolean => {
    if (!date) return false;
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dateObj >= today;
  },

  /**
   * Validate date is not in the future
   */
  notFuture: (date: Date | string): boolean => {
    if (!date) return false;
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj <= new Date();
  },

  /**
   * Validate date is valid
   */
  validDate: (date: Date | string): boolean => {
    if (!date) return false;
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return !isNaN(dateObj.getTime());
  },

  /**
   * Validate alphanumeric characters only
   */
  alphanumeric: (value: string): boolean => {
    if (!value) return false;
    return /^[a-zA-Z0-9]+$/.test(value);
  },

  /**
   * Validate numeric characters only
   */
  numeric: (value: string): boolean => {
    if (!value) return false;
    return /^[0-9]+$/.test(value);
  },

  /**
   * Validate alphabetic characters only
   */
  alpha: (value: string): boolean => {
    if (!value) return false;
    return /^[a-zA-Z]+$/.test(value);
  },

  /**
   * Validate postal code (US ZIP code)
   */
  zipCode: (value: string): boolean => {
    if (!value) return false;
    return /^\d{5}(-\d{4})?$/.test(value);
  },

  /**
   * Validate SSN format
   */
  ssn: (value: string): boolean => {
    if (!value) return false;
    const cleaned = value.replace(/\D/g, '');
    return cleaned.length === 9;
  },

  /**
   * Validate date of birth (not future, reasonable age)
   */
  dateOfBirth: (date: Date | string): boolean => {
    if (!date) return false;
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const maxAge = new Date(now.getFullYear() - 150, now.getMonth(), now.getDate());
    return dateObj <= now && dateObj >= maxAge;
  },

  /**
   * Validate minimum value
   */
  minValue: (value: number, min: number): boolean => {
    return value >= min;
  },

  /**
   * Validate maximum value
   */
  maxValue: (value: number, max: number): boolean => {
    return value <= max;
  },

  /**
   * Validate integer (no decimals)
   */
  integer: (value: number): boolean => {
    return Number.isInteger(value);
  },

  /**
   * Validate pattern match
   */
  pattern: (value: string, pattern: RegExp): boolean => {
    if (!value) return false;
    return pattern.test(value);
  },

  /**
   * Validate MRN (Medical Record Number) format
   */
  mrn: (value: string): boolean => {
    if (!value) return false;
    // MRN should be alphanumeric, typically 6-12 characters
    return /^[a-zA-Z0-9]{6,12}$/.test(value);
  },

  /**
   * Validate ICD-10 code format
   */
  icd10: (value: string): boolean => {
    if (!value) return false;
    // ICD-10 format: Letter followed by 2 digits, optional dot and more digits
    return /^[A-Z]\d{2}(\.\d{1,4})?$/.test(value);
  },

  /**
   * Validate CPT code format
   */
  cpt: (value: string): boolean => {
    if (!value) return false;
    // CPT codes are 5 digits
    return /^\d{5}$/.test(value);
  },
};

/**
 * Validate multiple fields and return error messages
 */
export function validateFields(
  fields: Record<string, any>,
  rules: Record<string, (value: any) => boolean | string>
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const [field, validator] of Object.entries(rules)) {
    const value = fields[field];
    const result = validator(value);

    if (result === false) {
      errors[field] = `${field} is invalid`;
    } else if (typeof result === 'string') {
      errors[field] = result;
    }
  }

  return errors;
}

/**
 * Common validation error messages
 */
export const validationMessages = {
  required: (field: string) => `${field} is required`,
  email: 'Please enter a valid email address',
  phone: 'Please enter a valid 10-digit phone number',
  positive: 'Value must be greater than zero',
  nonNegative: 'Value must be zero or greater',
  range: (min: number, max: number) => `Value must be between ${min} and ${max}`,
  minLength: (length: number) => `Must be at least ${length} characters`,
  maxLength: (length: number) => `Must be no more than ${length} characters`,
  minValue: (value: number) => `Must be at least ${value}`,
  maxValue: (value: number) => `Must be no more than ${value}`,
  url: 'Please enter a valid URL',
  notPast: 'Date cannot be in the past',
  notFuture: 'Date cannot be in the future',
  validDate: 'Please enter a valid date',
  alphanumeric: 'Only letters and numbers are allowed',
  numeric: 'Only numbers are allowed',
  alpha: 'Only letters are allowed',
  zipCode: 'Please enter a valid ZIP code (e.g., 12345 or 12345-6789)',
  ssn: 'Please enter a valid SSN (9 digits)',
  dateOfBirth: 'Please enter a valid date of birth',
  integer: 'Value must be a whole number',
  mrn: 'Medical Record Number must be 6-12 alphanumeric characters',
  icd10: 'Please enter a valid ICD-10 code (e.g., A00.1)',
  cpt: 'Please enter a valid CPT code (5 digits)',
};

/**
 * Validate form data and return array of error messages
 * @param data - Form data to validate
 * @param rules - Validation rules for each field
 * @returns Array of error messages, empty if valid
 */
export function validateForm<T extends Record<string, any>>(
  data: T,
  rules: Partial<Record<keyof T, (value: any) => boolean | string>>
): string[] {
  const errors: string[] = [];

  for (const [field, validator] of Object.entries(rules)) {
    const value = data[field as keyof T];
    if (!validator) continue;
    const result = validator(value);

    if (result === false) {
      errors.push(`${String(field)} is invalid`);
    } else if (typeof result === 'string') {
      errors.push(result);
    }
  }

  return errors;
}

/**
 * Create a validation rule builder for easier validation
 */
export class ValidationRuleBuilder<T> {
  private rules: Array<{ validator: (value: T) => boolean; message: string }> = [];

  required(message?: string): this {
    this.rules.push({
      validator: (value: T) => validators.required(value as any),
      message: message || 'This field is required',
    });
    return this;
  }

  minLength(length: number, message?: string): this {
    this.rules.push({
      validator: (value: T) => validators.minLength(value as string, length),
      message: message || validationMessages.minLength(length),
    });
    return this;
  }

  maxLength(length: number, message?: string): this {
    this.rules.push({
      validator: (value: T) => validators.maxLength(value as string, length),
      message: message || validationMessages.maxLength(length),
    });
    return this;
  }

  email(message?: string): this {
    this.rules.push({
      validator: (value: T) => validators.email(value as string),
      message: message || validationMessages.email,
    });
    return this;
  }

  phone(message?: string): this {
    this.rules.push({
      validator: (value: T) => validators.phone(value as string),
      message: message || validationMessages.phone,
    });
    return this;
  }

  positive(message?: string): this {
    this.rules.push({
      validator: (value: T) => validators.positive(value as number),
      message: message || validationMessages.positive,
    });
    return this;
  }

  custom(validator: (value: T) => boolean, message: string): this {
    this.rules.push({ validator, message });
    return this;
  }

  validate(value: T): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    for (const rule of this.rules) {
      if (!rule.validator(value)) {
        errors.push(rule.message);
      }
    }
    return { valid: errors.length === 0, errors };
  }
}

/**
 * Create a new validation rule builder
 */
export function createValidator<T>(): ValidationRuleBuilder<T> {
  return new ValidationRuleBuilder<T>();
}
