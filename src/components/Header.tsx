import { useState, useEffect, JSX } from 'react';
import { Menu, Group, Autocomplete, Button, Text, ActionIcon, Image } from '@mantine/core';
import { IconSearch, IconUserPlus, IconUsers, IconUser, IconLogout, IconShieldCheck, IconSettings } from '@tabler/icons-react';
import { useMedplum } from '@medplum/react';
import { Patient } from '@medplum/fhirtypes';
import { useNavigate } from 'react-router';
import { NewProviderModal } from './admin/NewProviderModal';
import { isUserAdmin } from '../utils/permissionUtils';
import { getEMRSettings } from '../utils/settings';
import { useCurrentUser, useMembership } from '../hooks/usePermissions';
import { clearAllData } from '../offline';
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
  const currentUser = useCurrentUser();
  const membership = useMembership();
  const isAdmin = isUserAdmin(currentUser, membership);

  // Load EMR settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      const settings = await getEMRSettings(medplum);
      if (settings) {
        setEmrName(settings.name || 'Medplum EMR');
        setEmrLogo(settings.logo || null);
      }
    };
    loadSettings();
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
    } catch (error) {
      setResults([]);
    }
  };

  const handleSelect = (value: string): void => {
    const found = results.find(r => r.value === value);
    if (found) {
      setSearch('');
      setResults([]);
      onPatientSelect(found.resource);
      navigate(`/patient/${found.resource.id}`);
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
          {emrLogo ? (
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
            placeholder="Search patients..."
            value={search}
            onChange={handleSearch}
            data={results.map(r => r.value)}
            onOptionSubmit={handleSelect}
            className={styles.searchInput}
          />

          {/* Admin Menu - Only shown for admins */}
          {isAdmin && (
            <Menu>
              <Menu.Target>
                <Button 
                  variant="light" 
                  leftSection={<IconShieldCheck size={16} />}
                  color="blue"
                >
                  Admin
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Administration</Menu.Label>
                <Menu.Item
                  leftSection={<IconUserPlus size={16} />}
                  onClick={() => setNewProviderModalOpen(true)}
                >
                  Add User/Provider
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconUsers size={16} />}
                  onClick={() => navigate('/admin/users')}
                >
                  Manage Users
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconSettings size={16} />}
                  onClick={() => navigate('/admin/settings')}
                >
                  Settings
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}

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
                <Menu.Label>Account</Menu.Label>
                <Menu.Item
                  leftSection={<IconUser size={16} />}
                  onClick={() => navigate('/profile')}
                >
                  Profile
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
                  Sign Out
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          ) : (
            <Button
              variant="light"
              leftSection={<IconUser size={16} />}
              onClick={() => navigate('/signin')}
            >
              Sign In
            </Button>
          )}
        </Group>
      </Group>
    </>
  );
}
