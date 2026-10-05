/** Small outline icon set (24px grid, 1.75 stroke) so the app has no icon dependency. */
const PATHS = {
  dashboard: 'M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z',
  plus: 'M12 5v14M5 12h14',
  inbox: 'M4 13h4l1.5 3h5L16 13h4M5.5 5h13L21 13v6H3v-6l2.5-8Z',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z',
  scale: 'M12 3v18M8 21h8M4 7h16M4 7l-3 7a3.5 3.5 0 0 0 6 0L4 7Zm16 0-3 7a3.5 3.5 0 0 0 6 0l-3-7Z',
  users: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm11.5 9v-1a4 4 0 0 0-3-3.87M15.5 4.13a3 3 0 0 1 0 5.74',
  search: 'm20 20-4.2-4.2M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z',
  logout: 'M15 16l4-4-4-4M19 12H9M12 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  check: 'm5 12.5 4.5 4.5L19 7',
  x: 'M6 6l12 12M18 6 6 18',
  alert: 'M12 9v4m0 3.5v.01M10.3 4.2 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z',
  info: 'M12 11v5m0-8.5v.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  download: 'M12 4v11m0 0-4-4m4 4 4-4M5 19h14',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  clock: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  chevronRight: 'm9 6 6 6-6 6',
  arrowUp: 'M12 19V5m0 0-6 6m6-6 6 6',
  arrowDown: 'M12 5v14m0 0-6-6m6 6 6-6',
  sort: 'M8 5v14m0 0-3-3m3 3 3-3M16 19V5m0 0-3 3m3-3 3 3',
  file: 'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5Zm0 0v5h5',
  shield: 'M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Zm-3.5 9 2.5 2.5 4.5-5',
  user: 'M20 21v-1a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  edit: 'M4 20h4L19 9l-4-4L4 16v4Zm9-13 4 4',
};

export function Icon({ name, className = 'h-5 w-5', title }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      <path d={PATHS[name]} />
    </svg>
  );
}
