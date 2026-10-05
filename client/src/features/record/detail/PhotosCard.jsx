import { useRef, useState } from 'react';
import { api } from '../../../api/client.js';
import { useAsync } from '../../../hooks/useAsync.js';
import { resizeImage } from '../../../lib/images.js';
import { Card } from '../../../components/ui/Card.jsx';
import { ErrorBanner } from '../../../components/ui/Feedback.jsx';

export function PhotosCard({ record, editable }) {
  const { data: photos, error: loadError, reload } = useAsync(() => api.records.attachments(record.id), [record.id]);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);
  const fileRef = useRef(null);

  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await resizeImage(file);
      await api.records.addAttachment(record.id, { name: file.name, caption: caption || file.name.replace(/\.[^.]+$/, ''), dataUrl });
      setCaption('');
      reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remove = async (id) => {
    setError(null);
    try {
      await api.records.deleteAttachment(record.id, id);
      reload();
    } catch (err) {
      setError(err);
    }
  };

  return (
    <Card title="Photographs" description="Instrument, data plate and seals — included in the report.">
      <div className="space-y-4">
        <ErrorBanner error={error ?? loadError} />
        {photos?.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p) => (
              <li key={p.id} className="group relative overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                <button type="button" className="block w-full" onClick={() => setOpen(p)}>
                  <img src={p.dataUrl} alt={p.caption ?? 'Photograph'} className="aspect-[4/3] w-full object-cover" />
                </button>
                <p className="truncate px-2 py-1 text-xs text-slate-600">{p.caption ?? p.name}</p>
                {editable && (
                  <button
                    type="button"
                    onClick={() => remove(p.id)}
                    className="absolute right-1 top-1 rounded bg-white/90 px-2 py-0.5 text-xs text-red-700 opacity-0 shadow transition group-hover:opacity-100 focus:opacity-100"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No photographs attached.</p>
        )}

        {editable && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1 text-sm text-slate-700">
              Caption
              <input className="input" value={caption} placeholder="e.g. Data plate" onChange={(e) => setCaption(e.target.value)} />
            </label>
            <label className={`btn-secondary cursor-pointer ${busy ? 'pointer-events-none opacity-50' : ''}`}>
              {busy ? 'Uploading…' : 'Add photo'}
              <input ref={fileRef} type="file" accept="image/png,image/jpeg" capture="environment" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
            </label>
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4" onClick={() => setOpen(null)} role="dialog" aria-label={open.caption ?? 'Photograph'}>
          <figure className="max-h-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <img src={open.dataUrl} alt={open.caption ?? ''} className="max-h-[80vh] rounded-md" />
            <figcaption className="mt-2 flex items-center justify-between text-sm text-white">
              {open.caption}
              <button className="btn-secondary" onClick={() => setOpen(null)}>Close</button>
            </figcaption>
          </figure>
        </div>
      )}
    </Card>
  );
}
