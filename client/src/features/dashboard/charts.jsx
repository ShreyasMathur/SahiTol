import { useState } from 'react';
import { Link } from 'react-router-dom';

/** Outcome series in fixed order; colours are the app's reserved status colours, always with a legend. */
export const OUTCOME_SERIES = [
  { key: 'PASS', label: 'Pass', color: '#16a34a' },
  { key: 'FAIL', label: 'Fail', color: '#dc2626' },
  { key: 'PENDING', label: 'Pending', color: '#94a3b8' },
];

export function Legend({ series }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

const monthLabel = (ym) => new Date(`${ym}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short' });
const monthLong = (ym) => new Date(`${ym}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

/** Stacked column chart of instruments tested per month, split by outcome. */
export function MonthlyChart({ months }) {
  const [hover, setHover] = useState(null);
  const W = 560;
  const H = 200;
  const pad = { top: 12, right: 8, bottom: 26, left: 28 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const totals = months.map((m) => OUTCOME_SERIES.reduce((s, x) => s + m[x.key], 0));
  const max = Math.max(4, ...totals);
  const step = max <= 5 ? 1 : Math.ceil(max / 4);
  const ticks = [];
  for (let v = 0; v <= max; v += step) ticks.push(v);
  const top = ticks[ticks.length - 1];
  const y = (v) => pad.top + innerH - (v / top) * innerH;
  const band = innerW / months.length;
  const barW = Math.min(36, band * 0.55);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Instruments tested per month by outcome">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? '#cbd5e1' : '#eef2f7'} />
            <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-slate-400 text-[10px]">
              {t}
            </text>
          </g>
        ))}
        {months.map((m, i) => {
          const cx = pad.left + band * i + band / 2;
          let acc = 0;
          const segs = OUTCOME_SERIES.filter((s) => m[s.key] > 0);
          return (
            <g key={m.month} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={cx - band / 2} y={pad.top} width={band} height={innerH} fill={hover === i ? '#f1f5f9' : 'transparent'} />
              {segs.map((s, k) => {
                const y0 = y(acc);
                acc += m[s.key];
                const y1 = y(acc);
                const isTop = k === segs.length - 1;
                const h = Math.max(0, y0 - y1 - (isTop ? 0 : 2));
                // Rounded data-end only on the top segment; flat against the baseline.
                return isTop && y0 - y1 > 5 ? (
                  <path
                    key={s.key}
                    d={`M${cx - barW / 2},${y0} V${y1 + 4} Q${cx - barW / 2},${y1} ${cx - barW / 2 + 4},${y1} H${cx + barW / 2 - 4} Q${cx + barW / 2},${y1} ${cx + barW / 2},${y1 + 4} V${y0} Z`}
                    fill={s.color}
                  />
                ) : (
                  <rect key={s.key} x={cx - barW / 2} y={y0 - h} width={barW} height={h} fill={s.color} />
                );
              })}
              <text x={cx} y={H - 8} textAnchor="middle" className="fill-slate-500 text-[11px]">
                {monthLabel(m.month)}
              </text>
              {totals[i] > 0 && (
                <text x={cx} y={y(totals[i]) - 5} textAnchor="middle" className="num fill-slate-600 text-[10px] font-medium">
                  {totals[i]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-44 -translate-x-1/2 rounded-md border border-slate-200 bg-white p-2.5 text-xs shadow-lg"
          style={{ left: `${((pad.left + band * hover + band / 2) / W) * 100}%` }}
        >
          <p className="mb-1 font-medium text-slate-900">{monthLong(months[hover].month)}</p>
          {OUTCOME_SERIES.map((s) => (
            <p key={s.key} className="flex items-center gap-1.5 text-slate-600">
              <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
              <span className="flex-1">{s.label}</span>
              <span className="num text-slate-900">{months[hover][s.key]}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/** Horizontal part-to-whole bar of the record pipeline; each segment links to the filtered repository. */
export function PipelineBar({ segments }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const [hover, setHover] = useState(null);
  if (!total) return <p className="text-sm text-slate-500">No records yet.</p>;
  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-slate-100">
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <Link
              key={s.key}
              to={s.to}
              title={`${s.label}: ${s.value}`}
              onMouseEnter={() => setHover(s.key)}
              onMouseLeave={() => setHover(null)}
              className="h-full transition-opacity"
              style={{ width: `${(s.value / total) * 100}%`, background: s.color, opacity: hover && hover !== s.key ? 0.45 : 1 }}
            />
          ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        {segments.map((s) => (
          <li key={s.key}>
            <Link to={s.to} className="flex items-center gap-2 rounded px-1 hover:bg-slate-50" onMouseEnter={() => setHover(s.key)} onMouseLeave={() => setHover(null)}>
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
              <span className="flex-1 text-slate-600">{s.label}</span>
              <span className="num font-medium text-slate-900">{s.value}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
