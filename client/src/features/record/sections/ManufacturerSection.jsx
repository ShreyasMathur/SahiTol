import { Card } from '../../../components/ui/Card.jsx';
import { TextField } from '../../../components/ui/FormField.jsx';

export function ManufacturerSection({ bind, disabled }) {
  const f = (field) => ({ ...bind('manufacturer', field), disabled });
  return (
    <Card title="Manufacturer details" description="Applicant / manufacturer of the instrument under test.">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Manufacturer name" required className="sm:col-span-2" {...f('name')} />
        <TextField label="Address" required className="sm:col-span-2" {...f('address')} />
        <TextField label="Country" required {...f('country')} />
        <TextField label="Email" type="email" {...f('email')} />
        <TextField label="Phone" type="tel" {...f('phone')} />
      </div>
    </Card>
  );
}
