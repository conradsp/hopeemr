import { Anchor, Button, Group, Stack, TextInput, Title, Text, Center } from '@mantine/core';
import { normalizeOperationOutcome } from '@medplum/core';
import type { OperationOutcome } from '@medplum/fhirtypes';
import {
  Document,
  Form,
  getErrorsForInput,
  getIssuesForExpression,
  Logo,
  OperationOutcomeAlert,
  useMedplum,
} from '@medplum/react';
import { JSX, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import styles from './ResetPasswordPage.module.css';

export function ResetPasswordPage(): JSX.Element {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const medplum = useMedplum();
  const [outcome, setOutcome] = useState<OperationOutcome>();
  const [success, setSuccess] = useState(false);

  return (
    <div className={styles.container}>
      <Document width={450}>
        <Form
          onSubmit={async (formData: Record<string, string>) => {
            setOutcome(undefined);
            medplum
              .post('auth/resetpassword', formData)
              .then(() => setSuccess(true))
              .catch((err) => setOutcome(normalizeOperationOutcome(err)));
          }}
        >
          <Center style={{ flexDirection: 'column' }}>
            <Logo size={32} />
            <Title order={2} mt="md">
              {t('auth.resetPassword.title', 'Reset Password')}
            </Title>
            <Text size="sm" c="dimmed" mt="xs">
              {t('auth.resetPassword.subtitle', 'Enter your email to receive a password reset link')}
            </Text>
          </Center>

          <Stack gap="xl" mt="xl">
            <OperationOutcomeAlert issues={getIssuesForExpression(outcome, undefined)} />
            
            {!success && (
              <>
                <TextInput
                  name="email"
                  type="email"
                  label={t('auth.resetPassword.emailLabel', 'Email Address')}
                  placeholder={t('auth.resetPassword.emailPlaceholder', 'your@email.com')}
                  required={true}
                  autoFocus={true}
                  error={getErrorsForInput(outcome, 'email')}
                />
                <Group justify="space-between" mt="xl" wrap="nowrap">
                  <Anchor
                    component="button"
                    type="button"
                    c="dimmed"
                    onClick={() => navigate('/signin')}
                    size="sm"
                  >
                    {t('auth.resetPassword.backToSignIn', '← Back to Sign In')}
                  </Anchor>
                  <Button type="submit" size="md">
                    {t('auth.resetPassword.sendResetLink', 'Send Reset Link')}
                  </Button>
                </Group>
              </>
            )}
            
            {success && (
              <div data-testid="success" className={styles.success}>
                <Text size="md" c="green" fw={500} mb="md">
                  {t('auth.resetPassword.successTitle', '✓ Reset link sent!')}
                </Text>
                <Text size="sm" c="dimmed" mb="lg">
                  {t(
                    'auth.resetPassword.successMessage',
                    'If an account exists with that email, you will receive a password reset link shortly. Check your inbox and spam folder.'
                  )}
                </Text>
                <Button onClick={() => navigate('/signin')} fullWidth>
                  {t('auth.resetPassword.backToSignInButton', 'Back to Sign In')}
                </Button>
              </div>
            )}
          </Stack>
        </Form>
      </Document>
    </div>
  );
}
