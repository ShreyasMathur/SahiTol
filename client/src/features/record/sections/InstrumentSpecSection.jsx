import { ACCURACY_CLASSES, ACCURACY_CLASS_LABELS, TARE_DEVICES, UNIT_FACTORS, VERIFICATION_TYPES } from '@nawi/shared';
import { Card } from '../../../components/ui/Card.jsx';
import { SelectField, TextField } from '../../../components/ui/FormField.jsx';

const CLASS_OPTIONS = ACCURACY_CLASSES.map((c) => ({ value: c, label: ACCURACY_CLASS_LABELS[c] }));
const UNIT_OPTIONS = Object.keys(UNIT_FACTORS).map((u) => ({ value: u, label: u }));
const VERIFICATION_OPTIONS = [
  { value: VERIFICATION_TYPES.INITIAL, label: 'Initial verification' },
  { value: VERIFICATION_TYPES.IN_SERVICE, label: 'In-service inspection' },
];
const TARE_OPTIONS = [
  { value: TARE_DEVICES.NONE, label: 'None' },
  { value: TARE_DEVICES.SUBTRACTIVE, label: 'Subtractive tare' },
  { value: TARE_DEVICES.ADDITIVE, label: 'Additive tare' },
];

export function InstrumentSpecSection({ bind, values, disabled }) {
  const f = (field) => ({ ...bind('instrument', field), disabled });
  const unit = values.instrument.unit;
  const num = { inputMode: 'decimal', autoComplete: 'off', unit };
  const hasTare = values.instrument.tareDevice && values.instrument.tareDevice !== TARE_DEVICES.NONE;

  return (
    <Card
      title="Instrument specification"
      description="Metrological characteristics of a single-range NAWI (OIML R 76-1, 3.1–3.4)."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <TextField label="Instrument type" placeholder="e.g. Electronic platform scale" className="sm:col-span-2" {...f('instrumentType')} />
        <SelectField label="Verification type" options={VERIFICATION_OPTIONS} {...f('verificationType')} />
        <SelectField label="Accuracy class" required placeholder="Select class…" options={CLASS_OPTIONS} {...f('accuracyClass')} />
        <SelectField label="Unit of measurement" required options={UNIT_OPTIONS} {...f('unit')} />
        <div className="hidden lg:block" />
        <TextField label="Maximum capacity (Max)" required {...num} {...f('maxCapacity')} />
        <TextField label="Minimum capacity (Min)" required {...num} {...f('minCapacity')} />
        <div className="hidden lg:block" />
        <TextField label="Verification scale interval (e)" required {...num} {...f('e')} />
        <TextField
          label="Actual scale interval (d)"
          hint="Leave blank if d = e"
          placeholder={values.instrument.e || ''}
          {...num}
          {...f('d')}
        />
        <div className="hidden lg:block" />
        <SelectField label="Tare device" options={TARE_OPTIONS} {...f('tareDevice')} />
        {hasTare && <TextField label="Maximum tare effect (T)" hint="Leave blank if T = Max" {...num} {...f('maxTare')} />}
      </div>
    </Card>
  );
}
