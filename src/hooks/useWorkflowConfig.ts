import { useState, useEffect, useCallback } from 'react';
import { useMedplum } from '@medplum/react';
import type { WorkflowConfiguration } from '../types/queue.types';
import { DEFAULT_WORKFLOW_CONFIG } from '../types/queue.types';
import { getWorkflowConfiguration, saveWorkflowConfiguration } from '../utils/settings';
import { logger } from '../utils/logger';

export interface UseWorkflowConfigReturn {
  config: WorkflowConfiguration;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
  saveConfig: (config: WorkflowConfiguration) => Promise<void>;
  saving: boolean;
}

/**
 * Hook to access and manage workflow configuration
 *
 * @example
 * const { config, loading, saveConfig } = useWorkflowConfig();
 *
 * if (config.workflowEmphasis === 'queue-primary') {
 *   // Show queue-first UI
 * }
 */
export function useWorkflowConfig(): UseWorkflowConfigReturn {
  const medplum = useMedplum();
  const [config, setConfig] = useState<WorkflowConfiguration>(DEFAULT_WORKFLOW_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loadedConfig = await getWorkflowConfiguration(medplum);
      setConfig(loadedConfig);
    } catch (err) {
      logger.error('Failed to load workflow config', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [medplum]);

  const saveConfig = useCallback(async (newConfig: WorkflowConfiguration) => {
    setSaving(true);
    try {
      await saveWorkflowConfiguration(medplum, newConfig);
      setConfig(newConfig);

      // Notify other components that settings have changed
      window.dispatchEvent(new Event('emr-workflow-settings-changed'));
    } catch (err) {
      logger.error('Failed to save workflow config', err);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [medplum]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Listen for settings changes from other components
  useEffect(() => {
    const handleSettingsChange = () => {
      loadConfig();
    };

    window.addEventListener('emr-workflow-settings-changed', handleSettingsChange);
    return () => {
      window.removeEventListener('emr-workflow-settings-changed', handleSettingsChange);
    };
  }, [loadConfig]);

  return {
    config,
    loading,
    error,
    refetch: loadConfig,
    saveConfig,
    saving,
  };
}

/**
 * Check if scheduling should be emphasized in the UI
 */
export function shouldShowScheduling(config: WorkflowConfiguration): boolean {
  return config.workflowEmphasis === 'scheduled-primary' || config.workflowEmphasis === 'hybrid';
}

/**
 * Check if queue should be emphasized in the UI
 */
export function shouldShowQueue(config: WorkflowConfiguration): boolean {
  return config.workflowEmphasis === 'queue-primary' || config.workflowEmphasis === 'hybrid';
}

/**
 * Check if both systems should be shown
 */
export function isHybridMode(config: WorkflowConfiguration): boolean {
  return config.workflowEmphasis === 'hybrid';
}

/**
 * Get the primary workflow label based on configuration
 */
export function getPrimaryWorkflowLabel(config: WorkflowConfiguration): string {
  switch (config.workflowEmphasis) {
    case 'scheduled-primary':
      return 'Scheduling';
    case 'queue-primary':
      return 'Queue';
    case 'hybrid':
    default:
      return 'Work Queue';
  }
}
