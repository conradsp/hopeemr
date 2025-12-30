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
import { useNavigate } from 'react-router';
import styles from './ResetPasswordPage.module.css';

export function ResetPasswordPage(): JSX.Element {
  const navigate = useNavigate();
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
              Reset Password
            </Title>
            <Text size="sm" c="dimmed" mt="xs">
              Enter your email to receive a password reset link
            </Text>
          </Center>

          <Stack gap="xl" mt="xl">
            <OperationOutcomeAlert issues={getIssuesForExpression(outcome, undefined)} />
            
            {!success && (
              <>
                <TextInput
                  name="email"
                  type="email"
                  label="Email Address"
                  placeholder="your@email.com"
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
                    ← Back to Sign In
                  </Anchor>
                  <Button type="submit" size="md">
                    Send Reset Link
                  </Button>
                </Group>
              </>
            )}
            
            {success && (
              <div data-testid="success" className={styles.success}>
                <Text size="md" c="green" fw={500} mb="md">
                  ✓ Reset link sent!
                </Text>
                <Text size="sm" c="dimmed" mb="lg">
                  If an account exists with that email, you will receive a password reset link shortly.
                  Check your inbox and spam folder.
                </Text>
                <Button onClick={() => navigate('/signin')} fullWidth>
                  Back to Sign In
                </Button>
              </div>
            )}
          </Stack>
        </Form>
      </Document>
    </div>
  );
}
