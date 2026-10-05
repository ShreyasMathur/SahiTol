import { Card } from '../../../components/ui/Card.jsx';
import { TextField } from '../../../components/ui/FormField.jsx';

export function ModelSection({ bind, disabled }) {
  const f = (field) => ({ ...bind('model', field), disabled });
  return (
    <Card title="Model information">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Model name / designation" required {...f('modelName')} />
        <TextField label="Serial number" required {...f('serialNumber')} />
        <TextField label="Year of manufacture" inputMode="numeric" placeholder="YYYY" {...f('yearOfManufacture')} />
        <TextField label="Model approval certificate no." {...f('approvalCertificateNo')} />
        <TextField label="Software version" hint="For software-controlled instruments" {...f('softwareVersion')} />
      </div>
    </Card>
  );
}
