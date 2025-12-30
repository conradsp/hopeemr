import { useState, useEffect, JSX } from 'react';
import { Menu, Group, Autocomplete, Button, Text, ActionIcon, Image } from '@mantine/core';
import { IconSearch, IconUserPlus, IconUsers, IconUser, IconLogout, IconShieldCheck, IconSettings, IconFileText, IconCalendar, IconCalendarTime, IconCalendarStats, IconFlask, IconPhoto, IconBuilding, IconStethoscope, IconPill, IconPackage, IconBuildingHospital, IconBed, IconCash, IconClipboardList, IconUserCheck } from '@tabler/icons-react';
import { useMedplum } from '@medplum/react';
import { Patient } from '@medplum/fhirtypes';
import { useNavigate } from 'react-router';
import { NewProviderModal } from '../admin/NewProviderModal';
import { getEMRSettings } from '../../utils/settings';
import { LanguageSelector } from './LanguageSelector';
import { SyncStatusBadgeCompact } from './SyncStatusBadge';
import { clearAllData } from '../../offline';
import { useTranslation } from 'react-i18next';
import { useFeatureFlags } from '../../hooks/usePermissions';
import styles from './Header.module.css';

interface HeaderProps {
  onPatientSelect: (patient: Patient) => void;
}

export function Header({ onPatientSelect }: HeaderProps): JSX.Element {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<{ value: string; resource: Patient }[]>([]);
  const [newProviderModalOpen, setNewProviderModalOpen] = useState(false);
  const [emrName, setEmrName] = useState('Medplum EMR');
  const [emrLogo, setEmrLogo] = useState<string | null>(null);
  const medplum = useMedplum();
  const navigate = useNavigate();
  const profile = medplum.getProfile();
  const { t } = useTranslation();
  const flags = useFeatureFlags();


  // Load EMR settings on mount and when settings change
  useEffect(() => {
    const loadSettings = async (): Promise<void> => {
      const settings = await getEMRSettings(medplum);
      if (settings) {
        setEmrName(settings.name || 'Medplum EMR');
        setEmrLogo(settings.logo || null);
      }
    };
    loadSettings().catch(() => {});

    const handleSettingsChange = (): void => {
      loadSettings().catch(() => {});
    };
    window.addEventListener('emr-settings-changed', handleSettingsChange);

    // Cleanup
    return () => {
      window.removeEventListener('emr-settings-changed', handleSettingsChange);
    };
  }, [medplum]);

  const handleSearch = async (query: string): Promise<void> => {
    setSearch(query);
    if (query.length < 2) {
      setResults([]);
      return;
    }
    
    try {
      // Search for patients using standard FHIR search parameters
      const res = await medplum.search('Patient', {
        name: query,
        _sort: '-_lastUpdated',
        _count: 10
      });
      
      const mappedResults = res.entry?.map(e => ({
        value:
          e.resource?.name?.[0]?.text ||
          [
            e.resource?.name?.[0]?.given?.[0],
            e.resource?.name?.[0]?.family
          ].filter(Boolean).join(' ') ||
          e.resource?.id || '',
        resource: e.resource as Patient
      })) || [];
      
      setResults(mappedResults);
    } catch (_error) {
      setResults([]);
    }
  };

  const handleSelect = (value: string): void => {
    const found = results.find(r => r.value === value);
    if (found) {
      setSearch('');
      setResults([]);
      onPatientSelect(found.resource);
      void navigate(`/patient/${found.resource.id}`);
    }
  };

  const userName = profile?.resourceType === 'Practitioner' 
    ? profile.name?.[0]?.text || profile.name?.[0]?.family || 'User'
    : 'User';

  return (
    <>
      <NewProviderModal opened={newProviderModalOpen} onClose={() => setNewProviderModalOpen(false)} />
      
      <Group justify="space-between" p="md" className={styles.headerContainer}>
        {/* Left side - Logo */}
        <Group gap="md" className={styles.logoGroup} onClick={() => navigate('/')}>
          {emrLogo && emrLogo.length > 0 ? (
            <Image 
              src={emrLogo} 
              alt="EMR Logo"
              h={40}
              w="auto"
              fit="contain"
            />
          ) : (
            <ActionIcon 
              variant="subtle" 
              size="lg"
            >
              <Text size="xl" fw={700} c="blue">M</Text>
            </ActionIcon>
          )}
          <Text 
            size="lg" 
            fw={700} 
            c="blue"
          >
            {emrName}
          </Text>
        </Group>

        {/* Center/Right - Search and Actions */}
        <Group gap="md">
          <Autocomplete
            leftSection={<IconSearch size={16} />}
            placeholder={t('header.searchPlaceholder')}
            value={search}
            onChange={handleSearch}
            data={results.map(r => r.value)}
            onOptionSubmit={handleSelect}
            className={styles.searchInput}
          />

          {/* Scheduling Menu - Only shown if user has scheduling permissions */}
          {flags.canViewScheduling && (
            <Menu>
              <Menu.Target>
                <Button 
                  variant="light" 
                  leftSection={<IconCalendar size={16} />}
                  color="grape"
                >
                  {t('header.scheduling')}
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{t('header.appointments')}</Menu.Label>
                <Menu.Item
                  leftSection={<IconCalendarTime size={16} />}
                  onClick={() => navigate('/scheduling/book')}
                >
                  {t('header.bookAppointment')}
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconCalendarStats size={16} />}
                  onClick={() => navigate('/scheduling/calendar')}
                >
                  {t('header.providerCalendar')}
                </Menu.Item>
                {flags.canManageSchedules && (
                  <>
                    <Menu.Divider />
                    <Menu.Item
                      leftSection={<IconCalendar size={16} />}
                      onClick={() => navigate('/scheduling/manage')}
                    >
                      {t('header.manageSchedules')}
                    </Menu.Item>
                  </>
                )}
              </Menu.Dropdown>
            </Menu>
          )}

          {/* Billing Menu - Only shown if user has billing permissions */}
          {flags.canViewBilling && (
            <Button
              variant="light"
              leftSection={<IconCash size={16} />}
              color="teal"
              onClick={() => navigate('/billing')}
            >
              {t('billing.billing')}
            </Button>
          )}

          {/* Queue Menu - Only shown if user has queue permissions */}
          {flags.canViewQueue && (
            <Menu>
              <Menu.Target>
                <Button
                  variant="light"
                  leftSection={<IconClipboardList size={16} />}
                  color="indigo"
                >
                  {t('queue.queue', 'Queue')}
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{t('queue.patientQueue', 'Patient Queue')}</Menu.Label>
                <Menu.Item
                  leftSection={<IconUser size={16} />}
                  onClick={() => navigate('/my-queue')}
                >
                  {t('queue.myQueue', 'My Queue')}
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconClipboardList size={16} />}
                  onClick={() => navigate('/queue')}
                >
                  {t('queue.allPatientsQueue', 'All Patients Queue')}
                </Menu.Item>
                {flags.canCheckInPatients && (
                  <>
                    <Menu.Divider />
                    <Menu.Label>{t('header.checkIn', 'Patient Check-In')}</Menu.Label>
                    <Menu.Item
                      leftSection={<IconUserCheck size={16} />}
                      onClick={() => navigate('/check-in')}
                    >
                      {t('queue.checkInPatient', 'Check In Patient')}
                    </Menu.Item>
                  </>
                )}
              </Menu.Dropdown>
            </Menu>
          )}

          {/* Admin Menu - Only shown for users with admin permissions */}
          {flags.canViewAdmin && (
            <Menu>
              <Menu.Target>
                <Button 
                  variant="light" 
                  leftSection={<IconShieldCheck size={16} />}
                  color="blue"
                >
                  {t('header.admin')}
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{t('header.administration')}</Menu.Label>
                {flags.canManageUsers && (
                  <Menu.Item
                    leftSection={<IconUsers size={16} />}
                    onClick={() => navigate('/admin/users')}
                  >
                    {t('header.manageUsers')}
                  </Menu.Item>
                )}
                {flags.canManageSettings && (
                  <Menu.Item
                    leftSection={<IconSettings size={16} />}
                    onClick={() => navigate('/admin/settings')}
                  >
                    {t('header.settings')}
                  </Menu.Item>
                )}
                
                {/* Clinical Configuration */}
                {(flags.canManageNoteTemplates || flags.canManageDiagnosisCodes) && (
                  <>
                    <Menu.Divider />
                    <Menu.Label>{t('header.clinicalConfig')}</Menu.Label>
                  </>
                )}
                {flags.canManageNoteTemplates && (
                  <Menu.Item
                    leftSection={<IconFileText size={16} />}
                    onClick={() => navigate('/admin/note-templates')}
                  >
                    {t('header.noteTemplates')}
                  </Menu.Item>
                )}
                {flags.canManageDiagnosisCodes && (
                  <Menu.Item
                    leftSection={<IconStethoscope size={16} />}
                    onClick={() => navigate('/admin/diagnosis-config')}
                  >
                    {t('header.diagnosisConfig', 'Diagnosis Configuration')}
                  </Menu.Item>
                )}

                {/* Scheduling Configuration */}
                {flags.canManageAppointmentTypes && (
                  <>
                    <Menu.Divider />
                    <Menu.Label>{t('header.schedulingConfig')}</Menu.Label>
                    <Menu.Item
                      leftSection={<IconCalendarTime size={16} />}
                      onClick={() => navigate('/admin/appointment-types')}
                    >
                      {t('header.appointmentTypes')}
                    </Menu.Item>
                  </>
                )}
                
                {/* Lab & Imaging Configuration */}
                {(flags.canManageLabTests || flags.canManageImagingTests) && (
                  <>
                    <Menu.Divider />
                    <Menu.Label>{t('header.diagnosticConfig')}</Menu.Label>
                  </>
                )}
                {flags.canManageLabTests && (
                  <Menu.Item
                    leftSection={<IconFlask size={16} />}
                    onClick={() => navigate('/admin/lab-tests')}
                  >
                    {t('header.labTests')}
                  </Menu.Item>
                )}
                {flags.canManageImagingTests && (
                  <Menu.Item
                    leftSection={<IconPhoto size={16} />}
                    onClick={() => navigate('/admin/imaging-tests')}
                  >
                    {t('header.imagingTests')}
                  </Menu.Item>
                )}
                <Menu.Item
                  leftSection={<IconBuilding size={16} />}
                  onClick={() => navigate('/admin/diagnostic-providers')}
                >
                  {t('header.diagnosticProviders')}
                </Menu.Item>
                
                {/* Pharmacy Configuration */}
                {(flags.canManageMedications || flags.canManageInventory) && (
                  <>
                    <Menu.Divider />
                    <Menu.Label>{t('header.pharmacyConfig')}</Menu.Label>
                  </>
                )}
                {flags.canManageMedications && (
                  <Menu.Item
                    leftSection={<IconPill size={16} />}
                    onClick={() => navigate('/admin/medications')}
                  >
                    {t('header.medicationCatalog')}
                  </Menu.Item>
                )}
                {flags.canManageInventory && (
                  <Menu.Item
                    leftSection={<IconPackage size={16} />}
                    onClick={() => navigate('/admin/inventory')}
                  >
                    {t('header.inventory')}
                  </Menu.Item>
                )}
                
                {/* Bed Management */}
                {(flags.canManageDepartments || flags.canManageBeds) && (
                  <>
                    <Menu.Divider />
                    <Menu.Label>{t('header.bedManagement')}</Menu.Label>
                  </>
                )}
                {flags.canManageDepartments && (
                  <Menu.Item
                    leftSection={<IconBuildingHospital size={16} />}
                    onClick={() => navigate('/admin/departments')}
                  >
                    {t('header.departments')}
                  </Menu.Item>
                )}
                {flags.canManageBeds && (
                  <Menu.Item
                    leftSection={<IconBed size={16} />}
                    onClick={() => navigate('/admin/beds')}
                  >
                    {t('header.beds')}
                  </Menu.Item>
                )}
              </Menu.Dropdown>
            </Menu>
          )}

          {/* Sync Status */}
          <SyncStatusBadgeCompact />

          {/* Language Selector */}
          <LanguageSelector />

          {/* User Profile Menu */}
          {profile ? (
            <Menu>
              <Menu.Target>
                <Button 
                  variant="subtle"
                  leftSection={<IconUser size={16} />}
                >
                  {userName}
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{t('header.account')}</Menu.Label>
                <Menu.Item
                  leftSection={<IconUser size={16} />}
                  onClick={() => navigate('/profile')}
                >
                  {t('header.profile')}
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconLogout size={16} />}
                  onClick={async () => {
                    // Clear offline cache before signing out (security: remove PHI)
                    await clearAllData();
                    await medplum.signOut();
                    navigate('/signin');
                  }}
                  color="red"
                >
                  {t('header.signOut')}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          ) : (
            <Button
              variant="light"
              leftSection={<IconUser size={16} />}
              onClick={() => navigate('/signin')}
            >
              {t('header.signIn')}
            </Button>
          )}
        </Group>
      </Group>
    </>
  );
}
