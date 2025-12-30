import { Button, Center, Group, PasswordInput, Stack, Title, Text } from '@mantine/core';
import { badRequest, normalizeOperationOutcome } from '@medplum/core';
import type { OperationOutcome } from '@medplum/fhirtypes';
import {
  Document,
  Form,
  Logo,
  OperationOutcomeAlert,
  getErrorsForInput,
  getIssuesForExpression,
  useMedplum,
} from '@medplum/react';
import { JSX, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import styles from './SetPasswordPage.module.css';

export function SetPasswordPage(): JSX.Element {
  const { id, secret } = useParams<{ id: string; secret: string }>();
  const medplum = useMedplum();
  const navigate = useNavigate();
  const [outcome, setOutcome] = useState<OperationOutcome>();
  const [success, setSuccess] = useState(false);
  const issues = getIssuesForExpression(outcome, undefined);

  // Debug: Log the URL parameters
  console.log('SetPasswordPage - URL params:', { id, secret });
  console.log('SetPasswordPage - Current pathname:', window.location.pathname);

  // Validate that we have both id and secret
  if (!id || !secret) {
    return (
      <div className={styles.container}>
        <Document width={450}>
          <Center style={{ flexDirection: 'column' }}>
            <Logo size={32} />
            <Title order={2} mt="md" c="red">
              Invalid Link
            </Title>
            <Text size="sm" c="dimmed" mt="xs" mb="lg">
              This password reset link is invalid or incomplete. Please check your email and use the full link provided.
            </Text>
            <Text size="xs" c="dimmed" mb="lg">
              Debug info: id={id || 'missing'}, secret={secret || 'missing'}
            </Text>
            <Button onClick={() => navigate('/signin')} fullWidth>
              Go to Sign In
            </Button>
          </Center>
        </Document>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Document width={450}>
        <OperationOutcomeAlert issues={issues} />
        <Form
          onSubmit={(formData: Record<string, string>) => {
            if (formData.password !== formData.confirmPassword) {
              setOutcome(badRequest('Passwords do not match', 'confirmPassword'));
              return;
            }
            setOutcome(undefined);
            const body = {
              id,
              secret,
              password: formData.password,
            };
            medplum
              .post('auth/setpassword', body)
              .then(() => setSuccess(true))
              .catch((err) => setOutcome(normalizeOperationOutcome(err)));
          }}
        >
          <Center style={{ flexDirection: 'column' }}>
            <Logo size={32} />
            <Title order={2} mt="md">
              Set Your Password
            </Title>
            <Text size="sm" c="dimmed" mt="xs">
              Welcome! Please create a password for your account.
            </Text>
          </Center>
          {!success && (
            <Stack mt="xl">
              <PasswordInput
                name="password"
                label="New password"
                placeholder="Enter your password"
                required={true}
                error={getErrorsForInput(outcome, 'password')}
                description="Must be at least 8 characters"
              />
              <PasswordInput
                name="confirmPassword"
                label="Confirm new password"
                placeholder="Re-enter your password"
                required={true}
                error={getErrorsForInput(outcome, 'confirmPassword')}
              />
              <Group justify="flex-end" mt="xl">
                <Button type="submit" size="md">
                  Set Password
                </Button>
              </Group>
            </Stack>
          )}
          {success && (
            <div data-testid="success" className={styles.success}>
              <Text size="lg" fw={500} c="green" mb="md">
                ✓ Password set successfully!
              </Text>
              <Text size="sm" c="dimmed" mb="lg">
                Your account is now ready. You can sign in with your email and password.
              </Text>
              <Button onClick={() => navigate('/signin')} fullWidth>
                Go to Sign In
              </Button>
            </div>
          )}
        </Form>
      </Document>
    </div>
  );
}
