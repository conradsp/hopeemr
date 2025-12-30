import { MantineProvider, createTheme } from '@mantine/core';
import '@mantine/core/styles.css';
import { Notifications } from '@mantine/notifications';
import '@mantine/notifications/styles.css';
import { MedplumClient } from '@medplum/core';
import { MedplumProvider } from '@medplum/react';
import '@medplum/react/styles.css';
import './App.css';
import './styles/global.css';
import './styles/variables.css';
import './styles/utilities.css';
import './styles/common.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { EMRApp } from './EMRApp';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';
import { getEnvConfig } from './utils/envValidation';
import { logger } from './utils/logger';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ConfigError } from './components/ConfigError';
import { OfflineProvider } from './offline';

// SECURITY: Enforce HTTPS in production
if (import.meta.env.PROD && window.location.protocol === 'http:') {
  logger.warn('Redirecting from HTTP to HTTPS');
  window.location.href = window.location.href.replace('http:', 'https:');
}

// Validate environment variables before starting the app
let envConfig;
try {
  envConfig = getEnvConfig();
  logger.info('Environment configuration validated', {
    baseUrl: envConfig.VITE_MEDPLUM_BASE_URL,
    hasClientId: !!envConfig.VITE_MEDPLUM_CLIENT_ID,
    hasGoogleClientId: !!envConfig.VITE_GOOGLE_CLIENT_ID,
  });
} catch (error) {
  // Log error for developers
  logger.error('Environment configuration validation failed', {
    error: error instanceof Error ? error.message : String(error),
  });
  console.error(error instanceof Error ? error.message : error);

  // Render error component instead of using innerHTML
  const container = document.getElementById('root') as HTMLDivElement;
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <MantineProvider>
        <ConfigError error={error} />
      </MantineProvider>
    </StrictMode>
  );
  throw error;
}

const medplum = new MedplumClient({
  baseUrl: envConfig.VITE_MEDPLUM_BASE_URL,
  clientId: envConfig.VITE_MEDPLUM_CLIENT_ID,
  onUnauthenticated: () => {
    if (window.location.pathname !== '/signin' && window.location.pathname !== '/register') {
      logger.info('User unauthenticated, redirecting to sign in');
      window.location.href = '/signin';
    }
  },
});

const theme = createTheme({
  headings: {
    sizes: {
      h1: {
        fontSize: '1.125rem',
        fontWeight: '500',
        lineHeight: '2.0',
      },
    },
  },
  fontSizes: {
    xs: '0.6875rem',
    sm: '0.875rem',
    md: '0.875rem',
    lg: '1.0rem',
    xl: '1.125rem',
  },
});

const container = document.getElementById('root') as HTMLDivElement;
const root = createRoot(container);
root.render(
  <StrictMode>
    <MantineProvider theme={theme}>
      <ErrorBoundary>
        <I18nextProvider i18n={i18n}>
          <BrowserRouter>
            <MedplumProvider medplum={medplum}>
              <OfflineProvider>
                <Notifications />
                <EMRApp />
              </OfflineProvider>
            </MedplumProvider>
          </BrowserRouter>
        </I18nextProvider>
      </ErrorBoundary>
    </MantineProvider>
  </StrictMode>
);

