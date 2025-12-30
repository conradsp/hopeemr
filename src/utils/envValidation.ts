/**
 * Environment variable validation
 * Ensures required configuration is present before app starts
 */

interface EnvConfig {
  VITE_MEDPLUM_BASE_URL: string;
  VITE_MEDPLUM_CLIENT_ID: string;
  VITE_GOOGLE_CLIENT_ID?: string;
}

class EnvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvValidationError';
  }
}

/**
 * Validate and return typed environment configuration
 */
export function validateEnv(): EnvConfig {
  const errors: string[] = [];

  // Required variables
  const baseUrl = import.meta.env.VITE_MEDPLUM_BASE_URL;
  const clientId = import.meta.env.VITE_MEDPLUM_CLIENT_ID;

  if (!baseUrl || typeof baseUrl !== 'string' || baseUrl.trim() === '') {
    errors.push('VITE_MEDPLUM_BASE_URL is required and must be a valid URL');
  } else if (!isValidUrl(baseUrl)) {
    errors.push('VITE_MEDPLUM_BASE_URL must be a valid HTTP/HTTPS URL');
  }

  if (!clientId || typeof clientId !== 'string' || clientId.trim() === '') {
    errors.push('VITE_MEDPLUM_CLIENT_ID is required');
  }

  if (errors.length > 0) {
    const errorMessage = [
      '❌ Environment Configuration Error:',
      '',
      ...errors.map(e => `  • ${e}`),
      '',
      '📝 Please check your .env file and ensure all required variables are set.',
      '   Required variables:',
      '   - VITE_MEDPLUM_BASE_URL (e.g., http://localhost:8103/)',
      '   - VITE_MEDPLUM_CLIENT_ID (from your Medplum project)',
      '',
      '   Optional variables:',
      '   - VITE_GOOGLE_CLIENT_ID (for Google OAuth)',
      '',
    ].join('\n');

    throw new EnvValidationError(errorMessage);
  }

  return {
    VITE_MEDPLUM_BASE_URL: baseUrl,
    VITE_MEDPLUM_CLIENT_ID: clientId,
    VITE_GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID,
  };
}

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Get validated environment config (cached)
 */
let cachedConfig: EnvConfig | null = null;

export function getEnvConfig(): EnvConfig {
  if (!cachedConfig) {
    cachedConfig = validateEnv();
  }
  return cachedConfig;
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return import.meta.env.DEV === true;
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return import.meta.env.PROD === true;
}

