import { Modal, Button, Group, Text } from '@mantine/core';
import { JSX } from 'react';
import { useTranslation } from 'react-i18next';

interface ConfirmDialogProps {
  opened: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Dialog title - defaults to i18n 'common.confirm' */
  title?: string;
  /** Dialog message - defaults to i18n 'common.confirmDelete' */
  message?: string;
  /** Confirm button label - defaults to i18n 'common.delete' */
  confirmLabel?: string;
  /** Cancel button label - defaults to i18n 'common.cancel' */
  cancelLabel?: string;
  /** Confirm button color - defaults to 'red' */
  confirmColor?: string;
  /** Whether to center the modal vertically */
  centered?: boolean;
  /** Whether confirm action is loading */
  loading?: boolean;
}

/**
 * Reusable confirmation dialog component
 * Supports i18n defaults for common delete confirmation use case
 */
export function ConfirmDialog({
  opened,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  confirmColor = 'red',
  centered = false,
  loading = false,
}: ConfirmDialogProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      title={title || t('common.confirm')}
      size="md"
      centered={centered}
    >
      <Text mb="lg">{message || t('common.confirmDelete')}</Text>
      <Group justify="flex-end">
        <Button variant="default" onClick={onCancel} disabled={loading}>
          {cancelLabel || t('common.cancel')}
        </Button>
        <Button color={confirmColor} onClick={onConfirm} loading={loading}>
          {confirmLabel || t('common.delete')}
        </Button>
      </Group>
    </Modal>
  );
}
