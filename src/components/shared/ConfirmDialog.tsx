import { Modal, Button, Group, Text } from '@mantine/core';
import { JSX } from 'react';

interface ConfirmDialogProps {
  opened: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmColor?: string;
}

export function ConfirmDialog({
  opened,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  confirmColor = 'red',
}: ConfirmDialogProps): JSX.Element {
  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      title={title}
      size="md"
    >
      <Text mb="lg">{message}</Text>
      <Group justify="flex-end">
        <Button variant="default" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button color={confirmColor} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </Group>
    </Modal>
  );
}
