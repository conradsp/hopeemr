/**
 * Data refresh utilities to replace window.location.reload()
 * Provides targeted state updates without full page reloads
 */

import { MedplumClient } from '@medplum/core';
import { Resource } from '@medplum/fhirtypes';

/**
 * Type for refresh callback functions
 */
export type RefreshCallback = () => void | Promise<void>;

/**
 * Global refresh registry
 * Allows components to register for specific resource type updates
 */
class RefreshManager {
  private callbacks: Map<string, Set<RefreshCallback>> = new Map();
  private globalCallbacks: Set<RefreshCallback> = new Set();

  /**
   * Register a callback for a specific resource type
   */
  register(resourceType: string, callback: RefreshCallback): () => void {
    if (!this.callbacks.has(resourceType)) {
      this.callbacks.set(resourceType, new Set());
    }
    this.callbacks.get(resourceType)!.add(callback);

    // Return unregister function
    return () => {
      this.callbacks.get(resourceType)?.delete(callback);
    };
  }

  /**
   * Register a global callback (called on any refresh)
   */
  registerGlobal(callback: RefreshCallback): () => void {
    this.globalCallbacks.add(callback);
    return () => {
      this.globalCallbacks.delete(callback);
    };
  }

  /**
   * Trigger refresh for a specific resource type
   */
  async refresh(resourceType?: string): Promise<void> {
    // Call global callbacks
    for (const callback of this.globalCallbacks) {
      await Promise.resolve(callback());
    }

    // Call resource-specific callbacks
    if (resourceType && this.callbacks.has(resourceType)) {
      for (const callback of this.callbacks.get(resourceType)!) {
        await Promise.resolve(callback());
      }
    }
  }

  /**
   * Trigger refresh for multiple resource types
   */
  async refreshMultiple(resourceTypes: string[]): Promise<void> {
    for (const resourceType of resourceTypes) {
      await this.refresh(resourceType);
    }
  }

  /**
   * Clear all callbacks (useful for testing)
   */
  clear(): void {
    this.callbacks.clear();
    this.globalCallbacks.clear();
  }
}

// Export singleton instance
export const refreshManager = new RefreshManager();

/**
 * Hook-like function to register refresh callbacks
 * Usage in components:
 *   useEffect(() => {
 *     const unregister = onRefresh('Patient', () => setRefreshKey(prev => prev + 1));
 *     return unregister;
 *   }, []);
 */
export function onRefresh(resourceType: string, callback: RefreshCallback): () => void {
  return refreshManager.register(resourceType, callback);
}

/**
 * Hook-like function to register global refresh callbacks
 */
export function onGlobalRefresh(callback: RefreshCallback): () => void {
  return refreshManager.registerGlobal(callback);
}

/**
 * Trigger a refresh for specific resource type(s)
 * This is what replaces window.location.reload()
 */
export async function triggerRefresh(resourceTypes?: string | string[]): Promise<void> {
  if (!resourceTypes) {
    // Global refresh if no types specified
    await refreshManager.refresh();
  } else if (typeof resourceTypes === 'string') {
    await refreshManager.refresh(resourceTypes);
  } else {
    await refreshManager.refreshMultiple(resourceTypes);
  }
}

/**
 * Higher-order function to wrap mutations with automatic refresh
 */
export function withRefresh<T extends (...args: any[]) => Promise<Resource>>(
  fn: T,
  resourceType: string
): T {
  return (async (...args: Parameters<T>) => {
    const result = await fn(...args);
    await triggerRefresh(resourceType);
    return result;
  }) as T;
}

/**
 * Invalidate Medplum client cache for specific resource(s)
 */
export function invalidateCache(
  medplum: MedplumClient,
  resourceType: string,
  resourceId?: string
): void {
  if (resourceId) {
    // Invalidate specific resource
    medplum.invalidateSearches(resourceType as any);
    // The MedplumClient doesn't expose cache invalidation for specific resources,
    // so we trigger a refresh instead
  } else {
    // Invalidate all resources of this type
    medplum.invalidateSearches(resourceType as any);
  }
}

/**
 * Complete refresh solution that invalidates cache AND triggers UI updates
 */
export async function refreshResource(
  medplum: MedplumClient,
  resourceType: string,
  resourceId?: string
): Promise<void> {
  invalidateCache(medplum, resourceType, resourceId);
  await triggerRefresh(resourceType);
}

/**
 * Batch refresh for multiple resource types
 */
export async function refreshResources(
  medplum: MedplumClient,
  resourceTypes: string[]
): Promise<void> {
  for (const resourceType of resourceTypes) {
    invalidateCache(medplum, resourceType);
  }
  await triggerRefresh(resourceTypes);
}

