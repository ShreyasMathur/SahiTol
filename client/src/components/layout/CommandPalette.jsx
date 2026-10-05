import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Icon } from '../ui/Icon.jsx';
import { ComplianceBadge, StatusBadge } from '../ui/StatusBadge.jsx';

/**
 * Ctrl/⌘+K quick switcher: jump to any page, or find a record by reference,
 * manufacturer, model or serial number.
 */
export function CommandPalette({ open, onClose, pages }) {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [query, setQuery] = useState('');
  const [records, setRecords] = useState([]);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setRecords([]);
    setActive(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open || !query.trim()) {
      setRecords([]);
      return undefined;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(() => {
      api.records
        .list({ q: query.trim(), pageSize: 6 })
        .then((r) => !cancelled && setRecords(r.items))
        .catch(() => !cancelled && setRecords([]))
        .finally(() => !cancelled && setSearching(false));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, query]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const nav = pages
      .filter((p) => !p.permission || can(p.permission))
      .filter((p) => !q || p.label.toLowerCase().includes(q))
      .map((p) => ({ key: `nav:${p.to}`, kind: 'page', to: p.to, label: p.label, icon: p.icon }));
    const recs = records.map((r) => ({ key: r.id, kind: 'record', to: `/records/${r.id}`, record: r }));
    return [...recs, ...nav];
  }, [pages, can, query, records]);

  useEffect(() => setActive(0), [items.length]);

  if (!open) return null;

  const go = (item) => {
    onClose();
    navigate(item.to);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && items[active]) {
      e.preventDefault();
      go(items[active]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fade-in fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 px-4 pt-[12vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick search"
        className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-slate-200"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-slate-200 px-4">
          <Icon name="search" className="h-5 w-5 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search records or jump to a page…"
            className="h-12 w-full border-0 bg-transparent text-sm focus:ring-0"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={items[active] ? `palette-${items[active].key}` : undefined}
          />
          <span className="kbd">Esc</span>
        </div>
        <ul id="palette-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {items.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-slate-500">{searching ? 'Searching…' : 'No matches'}</li>
          )}
          {items.map((item, i) => (
            <li
              key={item.key}
              id={`palette-${item.key}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(item)}
              className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm ${i === active ? 'bg-brand-50 text-brand-900' : 'text-slate-700'}`}
            >
              {item.kind === 'record' ? (
                <>
                  <Icon name="file" className="h-4 w-4 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <p className="num font-medium">{item.record.referenceNo}</p>
                    <p className="truncate text-xs text-slate-500">
                      {[item.record.manufacturer?.name, item.record.model?.modelName, item.record.model?.serialNumber].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <StatusBadge status={item.record.status} />
                  <ComplianceBadge value={item.record.compliance} />
                </>
              ) : (
                <>
                  <Icon name={item.icon} className="h-4 w-4 text-slate-400" />
                  <span className="flex-1">{item.label}</span>
                  <span className="text-xs text-slate-400">Page</span>
                </>
              )}
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-4 border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
          <span><span className="kbd">↑</span> <span className="kbd">↓</span> to move</span>
          <span><span className="kbd">Enter</span> to open</span>
        </div>
      </div>
    </div>
  );
}
