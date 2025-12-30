import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { handleError, showSuccess } from '../utils/errorHandling';

interface UseModalFormOptions<T> {
  initialData: T;
  onSave: (data: T) => Promise<void>;
  onSuccess?: () => void;
  successMessage?: string;
}

interface UseModalFormReturn<T> {
  formData: T;
  setFormData: (data: T | ((prev: T) => T)) => void;
  updateField: <K extends keyof T>(field: K, value: T[K]) => void;
  reset: () => void;
  loading: boolean;
  handleSave: () => Promise<boolean>;
}

/**
 * Custom hook to manage modal form state and submission
 * Standardizes pattern across all modal components
 * 
 * @example
 * const { formData, updateField, loading, handleSave } = useModalForm({
 *   initialData: { name: '', email: '' },
 *   onSave: async (data) => await api.save(data),
 *   onSuccess: () => onClose(true),
 * });
 */
export function useModalForm<T extends Record<string, any>>({
  initialData,
  onSave,
  onSuccess,
  successMessage,
}: UseModalFormOptions<T>): UseModalFormReturn<T> {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<T>(initialData);

  const handleSave = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    try {
      await onSave(formData);
      showSuccess(successMessage || t('common.saveSuccess'));
      onSuccess?.();
      return true;
    } catch (error) {
      handleError(error, 'saving');
      return false;
    } finally {
      setLoading(false);
    }
  }, [formData, onSave, onSuccess, successMessage, t]);

  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const reset = useCallback(() => {
    setFormData(initialData);
  }, [initialData]);

  return {
    formData,
    setFormData,
    updateField,
    reset,
    loading,
    handleSave,
  };
}

