import { Icon } from '../ui/Icon.jsx';

const FEATURES = [
  ['scale', 'Six OIML R 76 tests', 'Live MPE and pass/fail as readings are typed.'],
  ['shield', 'Tamper-evident reports', 'SHA-256 fingerprint and QR verification on every page.'],
  ['inbox', 'Technician → inspector workflow', 'E-signatures, remarks and revision history.'],
];

/** Two-panel frame for the signed-out screens: sign-in, first-run setup, account activation. */
export function AuthShell({ children }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 p-12 text-white lg:flex lg:flex-col">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '22px 22px' }}
          aria-hidden
        />
        <div className="relative flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
            <Icon name="scale" className="h-5 w-5" />
          </span>
          <span className="text-sm font-semibold uppercase tracking-wider text-brand-200">Legal Metrology</span>
        </div>
        <div className="relative my-auto max-w-lg">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">Test records for non-automatic weighing instruments.</h1>
          <p className="mt-4 text-brand-200">
            Record observations, evaluate compliance against OIML R 76 automatically and issue verifiable test reports.
          </p>
          <ul className="mt-10 space-y-5">
            {FEATURES.map(([icon, title, text]) => (
              <li key={title} className="flex gap-4">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon name={icon} className="h-[18px] w-[18px]" />
                </span>
                <span>
                  <span className="block font-medium">{title}</span>
                  <span className="block text-sm text-brand-200">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-brand-300">Authorised laboratory personnel only. All sign-ins are logged.</p>
      </section>

      <section className="flex items-center justify-center bg-slate-50 px-4 py-10">
        <div className="w-full max-w-md">{children}</div>
      </section>
    </div>
  );
}

export function AuthCard({ eyebrow, title, subtitle, children, onSubmit }) {
  return (
    <form onSubmit={onSubmit} noValidate className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{eyebrow ?? <span className="lg:hidden">Legal Metrology · OIML R 76</span>}</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      <div className="mt-6 space-y-4">{children}</div>
    </form>
  );
}
