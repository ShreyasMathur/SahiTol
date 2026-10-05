import { useCallback, useMemo, useState } from 'react';
import { validateRecord, TARE_DEVICES, VERIFICATION_TYPES } from '@nawi/shared';

export const FORM_SECTIONS = ['manufacturer', 'model', 'instrument', 'environment'];

export const EMPTY_RECORD = {
  manufacturer: { name: '', address: '', country: 'India', email: '', phone: '' },
  model: { modelName: '', serialNumber: '', yearOfManufacture: '', approvalCertificateNo: '', softwareVersion: '' },
  instrument: {
    instrumentType: '',
    accuracyClass: '',
    unit: 'kg',
    maxCapacity: '',
    minCapacity: '',
    e: '',
    d: '',
    tareDevice: TARE_DEVICES.NONE,
    maxTare: '',
    verificationType: VERIFICATION_TYPES.INITIAL,
  },
  environment: {
    labName: '',
    testDate: new Date().toISOString().slice(0, 10),
    temperatureStart: '',
    temperatureEnd: '',
    humidityStart: '',
    humidityEnd: '',
    pressure: '',
  },
};

function withDefaults(record = {}) {
  return Object.fromEntries(FORM_SECTIONS.map((s) => [s, { ...EMPTY_RECORD[s], ...record[s] }]));
}

/**
 * Form state for the record data-entry sections. Validation is the shared
 * engine, so the browser and API always agree on what is acceptable.
 * Errors are hidden until a field is blurred or `revealAll()` is called.
 */
export function useRecordForm(initial) {
  const [values, setValues] = useState(() => withDefaults(initial));
  const [touched, setTouched] = useState({});
  const [revealed, setRevealed] = useState(false);

  const validation = useMemo(() => validateRecord(values), [values]);

  const setField = useCallback((section, field, value) => {
    setValues((v) => ({ ...v, [section]: { ...v[section], [field]: value } }));
  }, []);

  const bind = (section, field) => {
    const key = `${section}.${field}`;
    const result = validation.sections[section];
    const show = revealed || touched[key];
    return {
      name: key,
      value: values[section][field] ?? '',
      onChange: (evt) => setField(section, field, evt.target.value),
      onBlur: () => setTouched((t) => (t[key] ? t : { ...t, [key]: true })),
      error: show ? result?.errors[field] : undefined,
      warning: result?.warnings[field],
    };
  };

  const reset = useCallback((record) => {
    setValues(withDefaults(record));
    setTouched({});
    setRevealed(false);
  }, []);

  return { values, validation, bind, setField, reset, revealAll: () => setRevealed(true) };
}
