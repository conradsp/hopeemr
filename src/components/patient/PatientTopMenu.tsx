
import { Button } from '@mantine/core';
import { JSX } from 'react';
import { useTranslation } from 'react-i18next';

interface PatientTopMenuProps {
  onMenuSelect: (menu: string) => void;
  selectedMenu: string;
}

export function PatientTopMenu({ onMenuSelect, selectedMenu }: PatientTopMenuProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="flex gap-2 px-2 py-1 border-b border-gray-200 bg-gray-50">
      <Button variant={selectedMenu === 'demographics' ? 'filled' : 'light'} onClick={() => onMenuSelect('demographics')}>
        {t('patient.demographics', 'Demographics')}
      </Button>
      <Button variant={selectedMenu === 'documents' ? 'filled' : 'light'} onClick={() => onMenuSelect('documents')}>
        {t('patient.documents', 'Documents')}
      </Button>
      <Button variant={selectedMenu === 'billing' ? 'filled' : 'light'} onClick={() => onMenuSelect('billing')}>
        {t('patient.billing', 'Billing')}
      </Button>
      {/* Add more menu options as needed */}
    </div>
  );
}
