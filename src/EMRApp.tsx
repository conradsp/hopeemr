import { Route, Routes, Navigate, useLocation, useNavigate } from 'react-router';
import { useState, useEffect, JSX } from 'react';
import { Header } from './components/shared/Header';
import { OfflineBanner } from './components/shared/OfflineBanner';
import { EncounterPageWrapper } from './components/encounter/EncounterPageWrapper';
import { SignInPage } from './pages/auth/SignInPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { SetPasswordPage } from './pages/auth/SetPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { PatientPage } from './pages/patient/PatientPage';
import { HomePage } from './pages/HomePage';
import { ManageUsersPage } from './pages/admin/ManageUsersPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { NoteTemplatesPage } from './pages/admin/NoteTemplatesPage';
import { AppointmentTypesPage } from './pages/admin/AppointmentTypesPage';
import { LabTestsPage } from './pages/admin/LabTestsPage';
import { ImagingTestsPage } from './pages/admin/ImagingTestsPage';
import { DiagnosticProvidersPage } from './pages/admin/DiagnosticProvidersPage';
import { DiagnosisConfigPage } from './pages/admin/DiagnosisConfigPage';
import { MedicationCatalogPage } from './pages/admin/MedicationCatalogPage';
import { InventoryPage } from './pages/admin/InventoryPage';
import { DepartmentsPage } from './pages/admin/DepartmentsPage';
import { BedsPage } from './pages/admin/BedsPage';
import { ScheduleManagementPage } from './pages/scheduling/ScheduleManagementPage';
import { BookAppointmentPage } from './pages/scheduling/BookAppointmentPage';
import { ProviderCalendarPage } from './pages/scheduling/ProviderCalendarPage';
import { BillingPage } from './pages/billing/BillingPage';
import { QueueDashboardPage } from './pages/queue/QueueDashboardPage';
import { CheckInPage } from './pages/queue/CheckInPage';
import { ProviderWorkQueuePage } from './pages/queue/ProviderWorkQueuePage';
import { RequireAdmin } from './components/auth/RequireAdmin';
import { Container } from '@mantine/core';
import { Patient } from '@medplum/fhirtypes';
import { useMedplum, Loading } from '@medplum/react';
import { useMembership } from './hooks/usePermissions';
import { initializeSessionTimeout } from './utils/sessionTimeout';
import { notifications } from '@mantine/notifications';
import { logger } from './utils/logger';
import styles from './EMRApp.module.css';

export function EMRApp(): JSX.Element {
  const medplum = useMedplum();
  const navigate = useNavigate();
  const [, setPatient] = useState<Patient | null>(null);
  const location = useLocation();
  const membership = useMembership();

  // Check if user is authenticated (computed before hooks that depend on it)
  const profile = medplum.getProfile();
  const isAuthenticated = !!profile;
  const isLoading = medplum.isLoading();

  // Allow access to setpassword without authentication
  const isSetPasswordRoute = location.pathname.startsWith('/setpassword/');
  const isResetPasswordRoute = location.pathname === '/resetpassword';

  // SECURITY: Initialize session timeout for authenticated users
  // This hook must be called before any early returns to maintain consistent hook order
  useEffect(() => {
    if (isAuthenticated && !isSetPasswordRoute && !isLoading) {
      logger.debug('Initializing session timeout manager');

      const sessionManager = initializeSessionTimeout(medplum, {
        idleTimeout: 30 * 60 * 1000, // 30 minutes
        absoluteTimeout: 8 * 60 * 60 * 1000, // 8 hours
        onWarning: () => {
          notifications.show({
            title: 'Session Timeout Warning',
            message: 'Your session will expire in 5 minutes due to inactivity. Please save your work.',
            color: 'yellow',
            autoClose: false,
          });
        },
        onTimeout: () => {
          notifications.show({
            title: 'Session Expired',
            message: 'Your session has expired. You will be redirected to the sign-in page.',
            color: 'red',
          });
          // Logout happens in the session manager
          navigate('/signin?reason=timeout');
        },
      });

      // Cleanup on unmount
      return () => {
        logger.debug('Destroying session timeout manager');
        sessionManager.destroy();
      };
    }
  }, [isAuthenticated, isSetPasswordRoute, isLoading, medplum, navigate]);

  // Show loading while checking authentication
  if (isLoading) {
    return <Loading />;
  }

  // If not authenticated and not on auth pages, redirect to sign in
  if (!isAuthenticated && location.pathname !== '/signin' && location.pathname !== '/register' && !isSetPasswordRoute && !isResetPasswordRoute) {
    return <Navigate to="/signin" replace />;
  }

  // Show auth pages when on those routes (except setpassword which is handled in Routes)
  if (location.pathname === '/signin') {
    return <SignInPage />;
  }

  if (location.pathname === '/register') {
    return <RegisterPage />;
  }

  if (isResetPasswordRoute) {
    return <ResetPasswordPage />;
  }

  // Main authenticated app (and setpassword route)
  return (
    <div className={styles.appContainer}>
      {!isSetPasswordRoute && <Header onPatientSelect={p => { setPatient(p); }} />}
      <OfflineBanner />
      <Routes>
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/resetpassword" element={<ResetPasswordPage />} />
        <Route path="/setpassword/:id/:secret" element={<SetPasswordPage />} />
        <Route path="/patient/:id" element={<PatientPage />} />
        <Route path="/Encounter/:id" element={<EncounterPageWrapper />} />
        <Route
          path="/admin/users"
          element={
            <RequireAdmin membership={membership!}>
              <Container fluid size="100%" className={styles.pageContainer} m={0}>
                <ManageUsersPage />
              </Container>
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <RequireAdmin membership={membership!}>
              <Container fluid size="100%" className={styles.pageContainer} m={0}>
                <SettingsPage />
              </Container>
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/note-templates"
          element={
            <RequireAdmin membership={membership!}>
              <Container fluid size="100%" className={styles.pageContainer} m={0}>
                <NoteTemplatesPage />
              </Container>
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/appointment-types"
          element={
            <RequireAdmin membership={membership!}>
              <Container fluid size="100%" className={styles.pageContainer} m={0}>
                <AppointmentTypesPage />
              </Container>
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/lab-tests"
          element={
            <RequireAdmin membership={membership!}>
              <Container fluid size="100%" className={styles.pageContainer} m={0}>
                <LabTestsPage />
              </Container>
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/imaging-tests"
          element={
            <RequireAdmin membership={membership!}>
              <Container fluid size="100%" className={styles.pageContainer} m={0}>
                <ImagingTestsPage />
              </Container>
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/diagnostic-providers"
          element={
            <RequireAdmin membership={membership!}>
              <Container fluid size="100%" className={styles.pageContainer} m={0}>
                <DiagnosticProvidersPage />
              </Container>
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/diagnosis-config"
          element={
            <RequireAdmin membership={membership!}>
              <Container fluid size="100%" className={styles.pageContainer} m={0}>
                <DiagnosisConfigPage />
              </Container>
            </RequireAdmin>
          }
        />
        {/* Redirect old routes to new unified page */}
        <Route path="/admin/diagnosis-codes" element={<Navigate to="/admin/diagnosis-config" replace />} />
        <Route path="/admin/coding-systems" element={<Navigate to="/admin/diagnosis-config" replace />} />
        <Route
          path="/admin/medications"
          element={
            <RequireAdmin membership={membership!}>
              <Container fluid size="100%" className={styles.pageContainer} m={0}>
                <MedicationCatalogPage />
              </Container>
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/inventory"
          element={
            <RequireAdmin membership={membership!}>
              <Container fluid size="100%" className={styles.pageContainer} m={0}>
                <InventoryPage />
              </Container>
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/departments"
          element={
            <RequireAdmin membership={membership!}>
              <Container fluid size="100%" className={styles.pageContainer} m={0}>
                <DepartmentsPage />
              </Container>
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/beds"
          element={
            <RequireAdmin membership={membership!}>
              <Container fluid size="100%" className={styles.pageContainer} m={0}>
                <BedsPage />
              </Container>
            </RequireAdmin>
          }
        />
        <Route
          path="/scheduling/manage"
          element={
            <Container fluid size="100%" className={styles.pageContainer} m={0}>
              <ScheduleManagementPage />
            </Container>
          }
        />
        <Route
          path="/scheduling/book"
          element={
            <Container fluid size="100%" className={styles.pageContainer} m={0}>
              <BookAppointmentPage />
            </Container>
          }
        />
        <Route
          path="/scheduling/calendar"
          element={
            <Container fluid size="100%" className={styles.pageContainer} m={0}>
              <ProviderCalendarPage />
            </Container>
          }
        />
        <Route
          path="/billing"
          element={
            <Container fluid size="100%" className={styles.pageContainer} m={0}>
              <BillingPage />
            </Container>
          }
        />
        <Route
          path="/my-queue"
          element={
            <Container fluid size="100%" className={styles.pageContainer} m={0}>
              <ProviderWorkQueuePage />
            </Container>
          }
        />
        <Route
          path="/queue"
          element={
            <Container fluid size="100%" className={styles.pageContainer} m={0}>
              <QueueDashboardPage />
            </Container>
          }
        />
        <Route
          path="/check-in"
          element={
            <Container fluid size="100%" className={styles.pageContainer} m={0}>
              <CheckInPage />
            </Container>
          }
        />
        <Route
          path="/*"
          element={
            <Container fluid size="100%" className={styles.pageContainer} m={0}>
              <HomePage />
            </Container>
          }
        />
      </Routes>
    </div>
  );
}
