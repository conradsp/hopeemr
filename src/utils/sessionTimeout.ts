/**
 * Session Timeout Management
 * Handles automatic logout after idle time and absolute session timeout
 */

import { MedplumClient } from '@medplum/core';
import { clearAllData } from '../offline';
import { logger } from './logger';

// Configuration
const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const ABSOLUTE_TIMEOUT = 8 * 60 * 60 * 1000; // 8 hours
const WARNING_TIME = 5 * 60 * 1000; // 5 minutes before timeout

interface SessionTimeoutConfig {
  idleTimeout?: number;
  absoluteTimeout?: number;
  warningTime?: number;
  onWarning?: () => void;
  onTimeout?: () => void;
}

export class SessionTimeoutManager {
  private idleTimer: NodeJS.Timeout | null = null;
  private absoluteTimer: NodeJS.Timeout | null = null;
  private warningTimer: NodeJS.Timeout | null = null;
  private sessionStartTime: number;
  private lastActivityTime: number;
  
  private config: Required<SessionTimeoutConfig>;
  private medplum: MedplumClient;

  constructor(medplum: MedplumClient, config: SessionTimeoutConfig = {}) {
    this.medplum = medplum;
    this.config = {
      idleTimeout: config.idleTimeout || IDLE_TIMEOUT,
      absoluteTimeout: config.absoluteTimeout || ABSOLUTE_TIMEOUT,
      warningTime: config.warningTime || WARNING_TIME,
      onWarning: config.onWarning || this.defaultWarning,
      onTimeout: config.onTimeout || this.defaultTimeout,
    };

    this.sessionStartTime = Date.now();
    this.lastActivityTime = Date.now();

    this.setupListeners();
    this.startTimers();

    logger.debug('Session timeout manager initialized', {
      idleTimeout: this.config.idleTimeout / 1000 / 60,
      absoluteTimeout: this.config.absoluteTimeout / 1000 / 60 / 60,
    });
  }

  private setupListeners(): void {
    // Events that indicate user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    events.forEach(event => {
      document.addEventListener(event, this.handleActivity, true);
    });
  }

  private handleActivity = (): void => {
    this.lastActivityTime = Date.now();
    this.resetIdleTimer();
  };

  private startTimers(): void {
    // Idle timeout
    this.resetIdleTimer();

    // Absolute timeout
    this.absoluteTimer = setTimeout(() => {
      logger.warn('Absolute session timeout reached');
      this.handleTimeout('absolute');
    }, this.config.absoluteTimeout);

    // Warning timer (before absolute timeout)
    this.warningTimer = setTimeout(() => {
      logger.debug('Session timeout warning triggered');
      this.config.onWarning();
    }, this.config.absoluteTimeout - this.config.warningTime);
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }

    this.idleTimer = setTimeout(() => {
      const idleTime = Date.now() - this.lastActivityTime;
      logger.warn('Idle timeout reached', { idleTime: idleTime / 1000 / 60 });
      this.handleTimeout('idle');
    }, this.config.idleTimeout);
  }

  private handleTimeout(type: 'idle' | 'absolute'): void {
    logger.debug('Session timeout triggered', { type });
    this.config.onTimeout();
    this.logout();
  }

  private defaultWarning = (): void => {
    // Default warning implementation
    const remaining = Math.floor(this.config.warningTime / 1000 / 60);
    alert(`Your session will expire in ${remaining} minutes due to inactivity. Please save your work.`);
  };

  private defaultTimeout = (): void => {
    // Default timeout implementation
    alert('Your session has expired due to inactivity. You will be logged out.');
  };

  private async logout(): Promise<void> {
    try {
      // Clear offline cache before signing out (security: remove PHI)
      await clearAllData();
      await this.medplum.signOut();
      window.location.href = '/signin?reason=timeout';
    } catch (error) {
      logger.error('Error during timeout logout', error);
      // Force redirect even if logout fails
      window.location.href = '/signin?reason=timeout';
    }
  }

  /**
   * Extend the session (reset timers)
   */
  public extendSession(): void {
    logger.debug('Session extended by user');
    this.lastActivityTime = Date.now();
    this.resetIdleTimer();
  }

  /**
   * Get remaining time until idle timeout
   */
  public getRemainingIdleTime(): number {
    const elapsed = Date.now() - this.lastActivityTime;
    return Math.max(0, this.config.idleTimeout - elapsed);
  }

  /**
   * Get remaining time until absolute timeout
   */
  public getRemainingAbsoluteTime(): number {
    const elapsed = Date.now() - this.sessionStartTime;
    return Math.max(0, this.config.absoluteTimeout - elapsed);
  }

  /**
   * Cleanup timers and listeners
   */
  public destroy(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.absoluteTimer) clearTimeout(this.absoluteTimer);
    if (this.warningTimer) clearTimeout(this.warningTimer);

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.removeEventListener(event, this.handleActivity, true);
    });

    logger.debug('Session timeout manager destroyed');
  }
}

/**
 * Create and initialize session timeout manager
 */
export function initializeSessionTimeout(
  medplum: MedplumClient,
  config?: SessionTimeoutConfig
): SessionTimeoutManager {
  return new SessionTimeoutManager(medplum, config);
}


