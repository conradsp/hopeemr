import { JSX, useState, useEffect } from 'react';
import { Modal, TextInput, Textarea, Button, Group, Stack, Select, NumberInput } from '@mantine/core';
import { useMedplum } from '@medplum/react';
import { ActivityDefinition } from '@medplum/fhirtypes';
import { useTranslation } from 'react-i18next';
import { saveLabTest, LabTestDefinition, LabTestResultField } from '../../utils/labTests';
import { getPriceFromResource } from '../../utils/billing';
import { showSuccess, handleError } from '../../utils/errorHandling';
import styles from './EditLabTestModal.module.css';

interface EditLabTestModalProps {
  opened: boolean;
  onClose: (saved: boolean) => void;
  test: ActivityDefinition | null;
}

const CATEGORIES = [
  'Chemistry',
  'Hematology',
  'Microbiology',
  'Immunology',
  'Coagulation',
  'Toxicology',
  'Other',
];

const SPECIMEN_TYPES = [
  'Whole Blood',
  'Serum',
  'Plasma',
  'Urine',
  'Throat Swab',
  'Nasopharyngeal Swab',
  'Sputum',
  'Stool',
  'Other',
];

export function EditLabTestModal({ opened, onClose, test }: EditLabTestModalProps): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const [loading, setLoading] = useState(false);
  
  const [code, setCode] = useState('');
  const [display, setDisplay] = useState('');
  const [loincCode, setLoincCode] = useState('');
  const [category, setCategory] = useState<string | null>('Chemistry');
  const [specimenType, setSpecimenType] = useState<string | null>('Serum');
  const [description, setDescription] = useState('');
  const [resultFields, setResultFields] = useState<LabTestResultField[]>([]);
  const [price, setPrice] = useState(0);

  useEffect(() => {
    if (test) {
      // Load existing test data
      setCode(test.identifier?.[0]?.value || '');
      setDisplay(test.title || '');
      setLoincCode(test.code?.coding?.[0]?.code || '');
      setCategory(test.extension?.find(e => e.url === 'category')?.valueString || 'Chemistry');
      setSpecimenType(test.extension?.find(e => e.url === 'specimenType')?.valueString || 'Serum');
      setDescription(test.description || '');
      setPrice(getPriceFromResource(test) || 0);
      
      // Load result fields from extension (if present)
      const resultFieldsExt = test.extension?.find(e => e.url === 'resultFields');
      if (resultFieldsExt?.valueString) {
        try {
          setResultFields(JSON.parse(resultFieldsExt.valueString));
        } catch {
          setResultFields([]);
        }
      } else {
        setResultFields([]);
      }
    } else {
      // Reset for new test
      setCode('');
      setDisplay('');
      setLoincCode('');
      setCategory('Chemistry');
      setSpecimenType('Serum');
      setDescription('');
      setResultFields([]);
      setPrice(0);
    }
  }, [test, opened]);

  // Handlers for result fields
  const handleFieldChange = (idx: number, field: Partial<LabTestResultField>): void => {
    setResultFields(fields => fields.map((f, i) => i === idx ? { ...f, ...field } : f));
  };
  const handleAddField = (): void => {
    setResultFields(fields => [...fields, { name: '', label: '', type: 'string' }]);
  };
  const handleRemoveField = (idx: number): void => {
    setResultFields(fields => fields.filter((_, i) => i !== idx));
  };
  const handleSave = async (): Promise<void> => {
    if (!display.trim()) {
      handleError(new Error(t('admin.labTests.validation.nameRequired')), t('modal.validationError'));
      return;
    }

    if (!code.trim()) {
      handleError(new Error(t('admin.labTests.validation.codeRequired')), t('modal.validationError'));
      return;
    }

    setLoading(true);
    try {
      const testDef: LabTestDefinition = {
        code: code.trim(),
        display: display.trim(),
        loincCode: loincCode.trim() || undefined,
        category: category || 'Chemistry',
        specimenType: specimenType || undefined,
        description: description.trim() || undefined,
        resultFields: resultFields.length > 0 ? resultFields : undefined,
        price,
      };

      await saveLabTest(medplum, testDef);
      
      showSuccess(test ? t('admin.labTests.updateSuccess') : t('admin.labTests.createSuccess'));
      onClose(true);
    } catch (error) {
      handleError(error, t('message.error.save'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={() => onClose(false)}
      title={test ? t('admin.labTests.edit') : t('admin.labTests.add')}
      size="lg"
    >
      <Stack gap="md">
        <TextInput
          label={t('admin.labTests.testCode')}
          placeholder={t('admin.labTests.testCodePlaceholder')}
          value={code}
          onChange={(e) => setCode(e.currentTarget.value)}
          required
          disabled={!!test}
          description={test ? t('admin.labTests.codeDisabled') : t('admin.labTests.codeDescription')}
        />

        <TextInput
          label={t('admin.labTests.testName')}
          placeholder={t('admin.labTests.testNamePlaceholder')}
          value={display}
          onChange={(e) => setDisplay(e.currentTarget.value)}
          required
        />

        <TextInput
          label={t('admin.labTests.loincCode')}
          placeholder={t('admin.labTests.loincCodePlaceholder')}
          value={loincCode}
          onChange={(e) => setLoincCode(e.currentTarget.value)}
          description={t('admin.labTests.loincDescription')}
        />

        <Select
          label={t('admin.labTests.category')}
          placeholder={t('admin.labTests.selectCategory')}
          data={CATEGORIES.map(cat => ({ value: cat, label: t(`admin.labTests.categories.${cat.toLowerCase()}`) }))}
          value={category}
          onChange={setCategory}
          required
        />

        <Select
          label={t('admin.labTests.specimenType')}
          placeholder={t('admin.labTests.selectSpecimen')}
          data={SPECIMEN_TYPES.map(type => ({ value: type, label: t(`admin.labTests.specimenTypes.${type.toLowerCase().replace(/\s+/g, '')}`) }))}
          value={specimenType}
          onChange={setSpecimenType}
        />

        <Textarea
          label={t('common.description')}
          placeholder={t('admin.labTests.descriptionPlaceholder')}
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          rows={3}
        />

        <NumberInput
          label={t('common.price')}
          value={price}
          onChange={(value) => setPrice(Number(value) || 0)}
          min={0}
          decimalScale={2}
          prefix="$"
          placeholder="0.00"
        />

        {/* Result Fields Section */}
        <Stack gap="xs">
          <Group justify="space-between">
            <div className={styles.fieldLabel}>{t('admin.labTests.resultFields')}</div>
            <Button size="xs" variant="light" onClick={handleAddField}>{t('admin.labTests.addField')}</Button>
          </Group>
          {resultFields.length === 0 && (
            <div className={styles.fieldHint}>{t('admin.labTests.noResultFields')}</div>
          )}
          {resultFields.map((field, idx) => (
            <Group key={idx} gap="xs" align="flex-end">
              <TextInput
                label={t('common.name')}
                value={field.name}
                onChange={e => handleFieldChange(idx, { name: e.currentTarget.value })}
                placeholder={t('admin.labTests.fieldNamePlaceholder')}
                required
                className={styles.fieldName}
              />
              <TextInput
                label={t('admin.labTests.label')}
                value={field.label}
                onChange={e => handleFieldChange(idx, { label: e.currentTarget.value })}
                placeholder={t('admin.labTests.labelPlaceholder')}
                required
                className={styles.fieldLabelInput}
              />
              <Select
                label={t('common.type')}
                data={[
                  { value: 'string', label: t('admin.labTests.types.string') }, 
                  { value: 'number', label: t('admin.labTests.types.number') }, 
                  { value: 'boolean', label: t('admin.labTests.types.boolean') }, 
                  { value: 'select', label: t('admin.labTests.types.select') }
                ]}
                value={field.type}
                onChange={val => handleFieldChange(idx, { type: val as LabTestResultField['type'] })}
                className={styles.fieldType}
              />
              <TextInput
                label={t('admin.labTests.unit')}
                value={field.unit || ''}
                onChange={e => handleFieldChange(idx, { unit: e.currentTarget.value })}
                placeholder={t('admin.labTests.unitPlaceholder')}
                className={styles.fieldUnit}
              />
              {field.type === 'select' && (
                <TextInput
                  label={t('admin.labTests.options')}
                  value={field.options?.join(',') || ''}
                  onChange={e => handleFieldChange(idx, { options: e.currentTarget.value.split(',').map(s => s.trim()).filter(Boolean) })}
                  placeholder={t('admin.labTests.optionsPlaceholder')}
                  className={styles.fieldOptions}
                />
              )}
              <Button size="xs" color="red" variant="subtle" onClick={() => handleRemoveField(idx)}>
                {t('common.delete')}
              </Button>
            </Group>
          ))}
        </Stack>

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={() => onClose(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} loading={loading}>
            {test ? t('common.update') : t('common.create')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

