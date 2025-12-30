/**
 * Centralized logging utility for the EMR application
 * 
 * Usage:
 *   logger.debug('User action', { userId, action });
 *   logger.info('Resource created', { resourceType, id });
 *   logger.warn('Deprecated feature used', { feature });
 *   logger.error('Operation failed', error, { context });
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private isDevelopment: boolean;
  private minLevel: LogLevel;

  constructor() {
    this.isDevelopment = import.meta.env.DEV;
    this.minLevel = this.isDevelopment ? 'debug' : 'warn';
  }

  /**
   * Format log message with timestamp and context
   */
  private format(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  /**
   * Check if log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.minLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  /**
   * Sanitize sensitive data from logs
   */
  private sanitize(context?: LogContext): LogContext | undefined {
    if (!context) return undefined;

    const sensitive = ['password', 'token', 'apiKey', 'secret', 'ssn', 'creditCard'];
    const sanitized = { ...context };

    for (const key of Object.keys(sanitized)) {
      if (sensitive.some(s => key.toLowerCase().includes(s))) {
        sanitized[key] = '***REDACTED***';
      }
    }

    return sanitized;
  }

  /**
   * Debug level logging - development only
   */
  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug') && this.isDevelopment) {
      const sanitized = this.sanitize(context);
      console.debug(this.format('debug', message, sanitized));
    }
  }

  /**
   * Info level logging - general application flow
   */
  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      const sanitized = this.sanitize(context);
      console.info(this.format('info', message, sanitized));
    }
  }

  /**
   * Warning level logging - potentially problematic situations
   */
  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      const sanitized = this.sanitize(context);
      console.warn(this.format('warn', message, sanitized));
    }
  }

  /**
   * Error level logging - errors and exceptions
   */
  error(message: string, error?: any, context?: LogContext): void {
    if (this.shouldLog('error')) {
      const sanitized = this.sanitize(context);
      const errorInfo = error instanceof Error
        ? { message: error.message, stack: error.stack }
        : error;
      
      console.error(
        this.format('error', message, { ...sanitized, error: errorInfo })
      );
    }
  }

  /**
   * Log FHIR resource operation
   */
  fhirOperation(
    operation: 'create' | 'read' | 'update' | 'delete' | 'search',
    resourceType: string,
    resourceId?: string,
    additionalContext?: LogContext
  ): void {
    this.debug(`FHIR ${operation} ${resourceType}`, {
      resourceType,
      resourceId,
      operation,
      ...additionalContext,
    });
  }

  /**
   * Log user action for audit trail
   */
  userAction(action: string, context?: LogContext): void {
    this.info(`User action: ${action}`, context);
  }

  /**
   * Log performance metrics
   */
  performance(operation: string, durationMs: number, context?: LogContext): void {
    if (durationMs > 1000) {
      this.warn(`Slow operation: ${operation} took ${durationMs}ms`, context);
    } else {
      this.debug(`Performance: ${operation} took ${durationMs}ms`, context);
    }
  }
}

// Export singleton instance
export const logger = new Logger();

/**
 * Decorator for timing async functions (future enhancement)
 */
export function logPerformance(operation: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const start = performance.now();
      try {
        const result = await originalMethod.apply(this, args);
        const duration = performance.now() - start;
        logger.performance(operation, duration);
        return result;
      } catch (error) {
        const duration = performance.now() - start;
        logger.error(`${operation} failed after ${duration}ms`, error);
        throw error;
      }
    };

    return descriptor;
  };
}

