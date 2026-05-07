import { Paper, Title, Container } from '@mantine/core';
import { Logo, RegisterForm } from '@medplum/react';
import { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import styles from './RegisterPage.module.css';

export function RegisterPage(): JSX.Element {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <Container size="xs" className={styles.container}>
      <Paper shadow="xl" p="xl" radius="md" withBorder>
        <div className={styles.logoContainer}>
          <Logo size={32} />
          <Title order={2} mt="md">{t('auth.register.title', 'Register for EMR')}</Title>
        </div>
        <RegisterForm
          type="project"
          onSuccess={() => {
            navigate('/');
          }}
        >
          <div className={styles.messageContainer}>
            <p>{t('auth.register.subtitle', 'Create an account to get started')}</p>
          </div>
        </RegisterForm>
      </Paper>
    </Container>
  );
}

