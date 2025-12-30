import { Paper, Title, Container } from '@mantine/core';
import { Logo, RegisterForm } from '@medplum/react';
import { JSX } from 'react';
import { useNavigate } from 'react-router';
import styles from './RegisterPage.module.css';

export function RegisterPage(): JSX.Element {
  const navigate = useNavigate();
  
  return (
    <Container size="xs" className={styles.container}>
      <Paper shadow="xl" p="xl" radius="md" withBorder>
        <div className={styles.logoContainer}>
          <Logo size={32} />
          <Title order={2} mt="md">Register for EMR</Title>
        </div>
        <RegisterForm
          type="project"
          onSuccess={() => {
            navigate('/');
          }}
        >
          <div className={styles.messageContainer}>
            <p>Create an account to get started</p>
          </div>
        </RegisterForm>
      </Paper>
    </Container>
  );
}

