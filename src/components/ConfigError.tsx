/**
 * Configuration Error Display Component
 * Displays environment configuration errors in a user-friendly way
 */

import { JSX } from 'react';
import { Container, Paper, Title, Text, Code, Stack } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import i18n from 'i18next';

interface ConfigErrorProps {
  error: Error | unknown;
}

/**
 * Safe translation helper.
 * ConfigError is rendered when env config fails — i18n may not be initialized
 * (or its init may have been the failure). Fall back to English in any failure mode.
 */
function safeT(key: string, fallback: string): string {
  try {
    if (i18n && typeof i18n.t === 'function' && i18n.isInitialized) {
      const value = i18n.t(key, { defaultValue: fallback });
      return typeof value === 'string' ? value : fallback;
    }
  } catch {
    // Swallow — i18n is broken, use fallback.
  }
  return fallback;
}

export function ConfigError({ error }: ConfigErrorProps): JSX.Element {
  const errorMessage =
    error instanceof Error
      ? error.message
      : safeT('errors.unknownConfigError', 'Unknown configuration error');

  return (
    <Container size="md" py={80}>
      <Paper shadow="xl" p="xl" withBorder>
        <Stack gap="lg">
          <Stack gap="sm" align="center">
            <IconAlertTriangle size={64} color="var(--mantine-color-red-6)" />
            <Title order={1} c="red">
              {safeT('errors.configurationError', 'Configuration Error')}
            </Title>
          </Stack>

          <Paper bg="red.0" p="md" withBorder style={{ borderColor: 'var(--mantine-color-red-3)' }}>
            <Code block style={{ whiteSpace: 'pre-wrap', background: 'transparent' }}>
              {errorMessage}
            </Code>
          </Paper>

          <Text c="dimmed" size="sm">
            {safeT(
              'errors.configurationErrorMessage',
              'The application cannot start without proper configuration. Please check your .env file and ensure all required environment variables are set correctly.'
            )}
          </Text>

          <Text size="sm" fw={500}>
            {safeT('errors.requiredEnvVars', 'Required environment variables:')}
          </Text>
          <Code block>
            VITE_MEDPLUM_BASE_URL=https://api.medplum.com{'\n'}
            VITE_MEDPLUM_CLIENT_ID=your-client-id
          </Code>
        </Stack>
      </Paper>
    </Container>
  );
}
