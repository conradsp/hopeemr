import { useState, useEffect, DependencyList, useCallback } from 'react';

export interface UseAsyncReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Custom hook to handle async operations with proper cleanup
 * Prevents race conditions and memory leaks from unmounted components
 * 
 * @example
 * const { data, loading, error, refetch } = useAsync(
 *   async () => await medplum.searchResources('Patient', { _count: 100 }),
 *   []
 * );
 */
export function useAsync<T>(
  asyncFn: () => Promise<T>,
  deps: DependencyList = []
): UseAsyncReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(() => {
    let cancelled = false;
    
    const load = async (): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const result = await asyncFn();
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    
    load();
    return () => { 
      cancelled = true; 
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return execute();
  }, [execute]);

  return { 
    data, 
    loading, 
    error, 
    refetch: execute 
  };
}

/**
 * Hook for async operations triggered by user actions (not on mount)
 * Useful for form submissions, button clicks, etc.
 * 
 * @example
 * const { execute, loading, error } = useAsyncCallback(
 *   async (patientId: string) => await medplum.readResource('Patient', patientId)
 * );
 */
export function useAsyncCallback<T, Args extends any[]>(
  asyncFn: (...args: Args) => Promise<T>
): {
  execute: (...args: Args) => Promise<T | null>;
  loading: boolean;
  error: Error | null;
  data: T | null;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async (...args: Args): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await asyncFn(...args);
      setData(result);
      return result;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [asyncFn]);

  return { execute, loading, error, data };
}

