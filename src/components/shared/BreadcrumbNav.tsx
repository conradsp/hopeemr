import { Breadcrumbs, Anchor, Text } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import { JSX } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import styles from './BreadcrumbNav.module.css';

interface BreadcrumbNavProps {
  patient?: { id: string; name: string } | null;
  encounter?: { id: string; type: string } | null;
}

export function BreadcrumbNav({ patient, encounter }: BreadcrumbNavProps): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  // Don't show breadcrumbs on signin/register pages
  if (location.pathname === '/signin' || location.pathname === '/register') {
    return <></>;
  }

  // Build breadcrumb items
  const items: JSX.Element[] = [];

  // Always show Home
  items.push(
    <Anchor
      key="home"
      onClick={() => navigate('/')}
      className={styles.clickableAnchor}
      size="sm"
    >
      {t('nav.home', 'Home')}
    </Anchor>
  );

  // Show patient if available
  if (patient) {
    items.push(
      <Anchor
        key="patient"
        onClick={() => navigate(`/patient/${patient.id}`)}
        className={styles.clickableAnchor}
        size="sm"
      >
        {patient.name}
      </Anchor>
    );
  }

  // Show encounter if available
  if (encounter) {
    items.push(
      <Text key="encounter" size="sm" c="dimmed">
        {encounter.type}
      </Text>
    );
  }

  // Handle admin routes
  if (pathnames[0] === 'admin') {
    if (pathnames[1] === 'users') {
      items.push(
        <Text key="admin-users" size="sm" c="dimmed">
          {t('nav.manageUsers', 'Manage Users')}
        </Text>
      );
    } else if (pathnames[1] === 'settings') {
      items.push(
        <Text key="admin-settings" size="sm" c="dimmed">
          {t('nav.settings', 'Settings')}
        </Text>
      );
    } else if (pathnames[1] === 'note-templates') {
      items.push(
        <Text key="admin-note-templates" size="sm" c="dimmed">
          {t('nav.noteTemplates', 'Note Templates')}
        </Text>
      );
    } else if (pathnames[1] === 'appointment-types') {
      items.push(
        <Text key="admin-appointment-types" size="sm" c="dimmed">
          {t('nav.appointmentTypes', 'Appointment Types')}
        </Text>
      );
    } else if (pathnames[1] === 'lab-tests') {
      items.push(
        <Text key="admin-lab-tests" size="sm" c="dimmed">
          {t('nav.labTestsCatalog', 'Lab Tests Catalog')}
        </Text>
      );
    } else if (pathnames[1] === 'imaging-tests') {
      items.push(
        <Text key="admin-imaging-tests" size="sm" c="dimmed">
          {t('nav.imagingTestsCatalog', 'Imaging Tests Catalog')}
        </Text>
      );
    } else if (pathnames[1] === 'diagnostic-providers') {
      items.push(
        <Text key="admin-diagnostic-providers" size="sm" c="dimmed">
          {t('nav.diagnosticProviders', 'Diagnostic Providers')}
        </Text>
      );
    } else if (pathnames[1] === 'diagnosis-codes') {
      items.push(
        <Text key="admin-diagnosis-codes" size="sm" c="dimmed">
          {t('nav.diagnosisCodes', 'Diagnosis Codes')}
        </Text>
      );
    }
  }

  // Handle scheduling routes
  if (pathnames[0] === 'scheduling') {
    if (pathnames[1] === 'manage') {
      items.push(
        <Text key="scheduling-manage" size="sm" c="dimmed">
          {t('nav.scheduleManagement', 'Schedule Management')}
        </Text>
      );
    } else if (pathnames[1] === 'book') {
      items.push(
        <Text key="scheduling-book" size="sm" c="dimmed">
          {t('nav.bookAppointment', 'Book Appointment')}
        </Text>
      );
    } else if (pathnames[1] === 'calendar') {
      items.push(
        <Text key="scheduling-calendar" size="sm" c="dimmed">
          {t('nav.providerCalendar', 'Provider Calendar')}
        </Text>
      );
    }
  }

  // If we're just on home with no patient selected, don't show breadcrumbs
  if (items.length === 1 && !patient && pathnames[0] !== 'admin' && pathnames[0] !== 'scheduling') {
    return <></>;
  }

  return (
    <Breadcrumbs
      separator={<IconChevronRight size={14} />}
      mb="md"
    >
      {items}
    </Breadcrumbs>
  );
}
