import { Modal, Button, Group, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { JSX } from 'react';

interface ConfirmationModalProps {
  opened: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationModal({
  opened,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmationModalProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <Modal opened={opened} onClose={onCancel} title={title || t('common.confirm')} centered>
      <Text mb="md">{message || t('common.confirmDelete')}</Text>
      <Group justify="flex-end">
        <Button variant="default" onClick={onCancel}>
          {cancelLabel || t('common.cancel')}
        </Button>
        <Button color="red" onClick={onConfirm}>
          {confirmLabel || t('common.delete')}
        </Button>
      </Group>
    </Modal>
  );
}
