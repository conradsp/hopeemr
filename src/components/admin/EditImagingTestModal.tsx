import { JSX, useState, useEffect } from 'react';
import { Modal, TextInput, Textarea, Button, Group, Stack, Select, NumberInput } from '@mantine/core';
import { useMedplum } from '@medplum/react';
import { ActivityDefinition } from '@medplum/fhirtypes';
import { useTranslation } from 'react-i18next';
import { saveImagingTest, ImagingTestDefinition } from '../../utils/imagingTests';
import { getPriceFromResource } from '../../utils/billing';
import { showSuccess, handleError } from '../../utils/errorHandling';

interface EditImagingTestModalProps {
  opened: boolean;
  onClose: (saved: boolean) => void;
  test: ActivityDefinition | null;
}

const CATEGORIES = [
  'X-Ray',
  'CT',
  'MRI',
  'Ultrasound',
  'Nuclear Medicine',
  'Mammography',
  'Fluoroscopy',
  'Other',
];

const MODALITIES = [
  { value: 'DX', label: 'Digital Radiography' },
  { value: 'CT', label: 'Computed Tomography' },
  { value: 'MR', label: 'Magnetic Resonance' },
  { value: 'US', label: 'Ultrasound' },
  { value: 'NM', label: 'Nuclear Medicine' },
  { value: 'MG', label: 'Mammography' },
  { value: 'DXA', label: 'Dual X-Ray Absorptiometry' },
  { value: 'PT', label: 'PET' },
  { value: 'RF', label: 'Fluoroscopy' },
];

const BODY_PARTS = [
  'Head',
  'Brain',
  'Chest',
  'Abdomen',
  'Pelvis',
  'Spine',
  'Cervical Spine',
  'Thoracic Spine',
  'Lumbar Spine',
  'Shoulder',
  'Elbow',
  'Wrist',
  'Hand',
  'Hip',
  'Knee',
  'Ankle',
  'Foot',
  'Breast',
  'Heart',
  'Other',
];

export function EditImagingTestModal({ opened, onClose, test }: EditImagingTestModalProps): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const [loading, setLoading] = useState(false);
  
  const [code, setCode] = useState('');
  const [display, setDisplay] = useState('');
  const [loincCode, setLoincCode] = useState('');
  const [category, setCategory] = useState<string | null>('X-Ray');
  const [bodyPart, setBodyPart] = useState<string | null>('Chest');
  const [modality, setModality] = useState<string | null>('DX');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState(0);

  useEffect(() => {
    if (test) {
      // Load existing test data
      setCode(test.identifier?.[0]?.value || '');
      setDisplay(test.title || '');
      setLoincCode(test.code?.coding?.[0]?.code || '');
      setCategory(test.extension?.find(e => e.url === 'category')?.valueString || 'X-Ray');
      setBodyPart(test.extension?.find(e => e.url === 'bodyPart')?.valueString || 'Chest');
      setModality(test.extension?.find(e => e.url === 'modality')?.valueString || 'DX');
      setDescription(test.description || '');
      setPrice(getPriceFromResource(test) || 0);
    } else {
      // Reset for new test
      setCode('');
      setDisplay('');
      setLoincCode('');
      setCategory('X-Ray');
      setBodyPart('Chest');
      setModality('DX');
      setDescription('');
      setPrice(0);
    }
  }, [test, opened]);

  const handleSave = async () => {
    if (!display.trim()) {
      handleError(new Error(t('admin.imagingTests.validation.nameRequired')), t('modal.validationError'));
      return;
    }

    if (!code.trim()) {
      handleError(new Error(t('admin.imagingTests.validation.codeRequired')), t('modal.validationError'));
      return;
    }

    setLoading(true);
    try {
      const testDef: ImagingTestDefinition = {
        code: code.trim(),
        display: display.trim(),
        loincCode: loincCode.trim() || undefined,
        category: category || 'X-Ray',
        bodyPart: bodyPart || undefined,
        modality: modality || undefined,
        description: description.trim() || undefined,
        price,
      };

      await saveImagingTest(medplum, testDef);
      
      showSuccess(test ? t('admin.imagingTests.updateSuccess') : t('admin.imagingTests.createSuccess'));
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
      title={test ? t('admin.imagingTests.edit') : t('admin.imagingTests.add')}
      size="lg"
    >
      <Stack gap="md">
        <TextInput
          label={t('admin.imagingTests.testCode')}
          placeholder={t('admin.imagingTests.testCodePlaceholder')}
          value={code}
          onChange={(e) => setCode(e.currentTarget.value)}
          required
          disabled={!!test}
          description={test ? t('admin.imagingTests.codeDisabled') : t('admin.imagingTests.codeDescription')}
        />

        <TextInput
          label={t('admin.imagingTests.testName')}
          placeholder={t('admin.imagingTests.testNamePlaceholder')}
          value={display}
          onChange={(e) => setDisplay(e.currentTarget.value)}
          required
        />

        <TextInput
          label={t('admin.imagingTests.loincCode')}
          placeholder={t('admin.imagingTests.loincCodePlaceholder')}
          value={loincCode}
          onChange={(e) => setLoincCode(e.currentTarget.value)}
          description={t('admin.imagingTests.loincDescription')}
        />

        <Select
          label={t('admin.imagingTests.category')}
          placeholder={t('admin.imagingTests.selectCategory')}
          data={CATEGORIES.map(cat => ({ value: cat, label: t(`admin.imagingTests.categories.${cat.toLowerCase().replace(/[\s-]/g, '')}`) }))}
          value={category}
          onChange={setCategory}
          required
        />

        <Select
          label={t('admin.imagingTests.bodyPart')}
          placeholder={t('admin.imagingTests.selectBodyPart')}
          data={BODY_PARTS.map(part => ({ value: part, label: t(`admin.imagingTests.bodyParts.${part.toLowerCase().replace(/\s+/g, '')}`) }))}
          value={bodyPart}
          onChange={setBodyPart}
        />

        <Select
          label={t('admin.imagingTests.modality')}
          placeholder={t('admin.imagingTests.selectModality')}
          data={MODALITIES.map(m => ({ value: m.value, label: t(`admin.imagingTests.modalities.${m.value.toLowerCase()}`) }))}
          value={modality}
          onChange={setModality}
        />

        <Textarea
          label={t('common.description')}
          placeholder={t('admin.imagingTests.descriptionPlaceholder')}
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

