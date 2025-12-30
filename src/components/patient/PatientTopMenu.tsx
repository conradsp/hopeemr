
import { Button } from '@mantine/core';
import { JSX } from 'react';

interface PatientTopMenuProps {
  onMenuSelect: (menu: string) => void;
  selectedMenu: string;
}

export function PatientTopMenu({ onMenuSelect, selectedMenu }: PatientTopMenuProps): JSX.Element {
  return (
    <div className="flex gap-2 px-2 py-1 border-b border-gray-200 bg-gray-50">
      <Button variant={selectedMenu === 'demographics' ? 'filled' : 'light'} onClick={() => onMenuSelect('demographics')}>
        Demographics
      </Button>
      <Button variant={selectedMenu === 'documents' ? 'filled' : 'light'} onClick={() => onMenuSelect('documents')}>
        Documents
      </Button>
      <Button variant={selectedMenu === 'billing' ? 'filled' : 'light'} onClick={() => onMenuSelect('billing')}>
        Billing
      </Button>
      {/* Add more menu options as needed */}
    </div>
  );
}
