import { Paper, Title, Container, Image } from '@mantine/core';
import { Logo, SignInForm, useMedplumContext } from '@medplum/react';
import { JSX, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import styles from './SignInPage.module.css';

export function SignInPage(): JSX.Element {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { medplum } = useMedplumContext();
  const [clinicName, setClinicName] = useState<string>('EMR');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  
  useEffect(() => {
    // Try to load branding settings (without authentication)
    const loadSettings = async () => {
      try {
        // Try to search for the settings organization
        // Note: This will only work if the Organization is publicly readable
        // Otherwise, we'll use defaults until the user logs in
        const result = await medplum.search('Organization', {
          identifier: 'emr-settings',
          _count: '1',
        });

        if (result.entry && result.entry.length > 0) {
          const org = result.entry[0].resource as any;
          if (org.name) {
            setClinicName(org.name);
          }
          // Logo is stored in extension
          const logoExt = org.extension?.find((ext: any) => ext.url === 'logo');
          if (logoExt?.valueString) {
            setLogoUrl(logoExt.valueString);
          }
        }
      } catch (error) {
        // If loading fails (unauthenticated or not found), just use defaults
        // Using default branding
      }
    };
    
    loadSettings();
  }, [medplum]);
  
  return (
    <Container size="xs" className={styles.container}>
      <Paper shadow="xl" p="xl" radius="md" withBorder>
        <div className={styles.logoContainer}>
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={t('auth.signIn.logoAlt', '{{clinicName}} Logo', { clinicName })}
              h={32}
              w="auto"
              fit="contain"
              className={styles.logo}
            />
          ) : (
            <Logo size={32} />
          )}
          <Title order={2} mt="md">{t('auth.signIn.title', 'Sign in to {{clinicName}}', { clinicName })}</Title>
        </div>
        <SignInForm
          onSuccess={() => {
            navigate('/');
          }}
          onForgotPassword={() => navigate('/resetpassword')}
        />
      </Paper>
    </Container>
  );
}

