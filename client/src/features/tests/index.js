import { TEST_TYPES } from '@nawi/shared';
import { ZeroSettingForm } from './forms/ZeroSettingForm.jsx';
import { WeighingForm } from './forms/WeighingForm.jsx';
import { EccentricityForm } from './forms/EccentricityForm.jsx';
import { RepeatabilityForm } from './forms/RepeatabilityForm.jsx';
import { DiscriminationForm } from './forms/DiscriminationForm.jsx';
import { TareForm } from './forms/TareForm.jsx';

/** Observation form component for each test type. */
export const TEST_FORMS = {
  [TEST_TYPES.ZERO_SETTING]: ZeroSettingForm,
  [TEST_TYPES.WEIGHING]: WeighingForm,
  [TEST_TYPES.ECCENTRICITY]: EccentricityForm,
  [TEST_TYPES.REPEATABILITY]: RepeatabilityForm,
  [TEST_TYPES.DISCRIMINATION]: DiscriminationForm,
  [TEST_TYPES.TARE]: TareForm,
};
