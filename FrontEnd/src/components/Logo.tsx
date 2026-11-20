/** The site mark: a small graph (K4 minus an edge) drawn in ink, one vertex highlighted. */
export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <g stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round">
        <line x1="7" y1="9" x2="24" y2="6" />
        <line x1="7" y1="9" x2="10" y2="25" />
        <line x1="24" y1="6" x2="10" y2="25" />
        <line x1="24" y1="6" x2="26" y2="22" />
        <line x1="10" y1="25" x2="26" y2="22" />
      </g>
      <circle cx="24" cy="6" r="4.6" fill="var(--mark)" />
      <g fill="var(--surface)" stroke="var(--ink)" strokeWidth="1.8">
        <circle cx="7" cy="9" r="3.2" />
        <circle cx="10" cy="25" r="3.2" />
        <circle cx="26" cy="22" r="3.2" />
        <circle cx="24" cy="6" r="3.2" />
      </g>
    </svg>
  );
}
