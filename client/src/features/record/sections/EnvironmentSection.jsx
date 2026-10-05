import { Card } from '../../../components/ui/Card.jsx';
import { TextField } from '../../../components/ui/FormField.jsx';

export function EnvironmentSection({ bind, disabled }) {
  const f = (field) => ({ ...bind('environment', field), disabled });
  const num = { inputMode: 'decimal', autoComplete: 'off' };

  return (
    <Card title="Laboratory & environmental conditions" description="Record at the start and end of the test sequence.">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Laboratory / test location" {...f('labName')} />
        <TextField label="Test date" type="date" {...f('testDate')} />
        <TextField label="Temperature — start" required unit="°C" {...num} {...f('temperatureStart')} />
        <TextField label="Temperature — end" unit="°C" {...num} {...f('temperatureEnd')} />
        <TextField label="Relative humidity — start" required unit="%RH" {...num} {...f('humidityStart')} />
        <TextField label="Relative humidity — end" unit="%RH" {...num} {...f('humidityEnd')} />
        <TextField label="Barometric pressure" required unit="hPa" {...num} {...f('pressure')} />
      </div>
    </Card>
  );
}
