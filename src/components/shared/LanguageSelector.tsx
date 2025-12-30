import { JSX } from 'react';
import { Select } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import styles from './LanguageSelector.module.css';

export function LanguageSelector(): JSX.Element {
  const { i18n } = useTranslation();
  return (
    <Select
      data={[
        { value: 'en', label: 'English' },
        { value: 'es', label: 'Español' },
      ]}
      value={i18n.language}
      onChange={(lang) => lang && i18n.changeLanguage(lang)}
      size="xs"
      className={styles.selector}
    />
  );
}
