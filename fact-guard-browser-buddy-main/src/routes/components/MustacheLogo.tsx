export function MustacheLogo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="32" cy="32" r="30" fill="var(--primary)" fillOpacity="0.15" />
      <path
        d="M8 34c4-2 8-2 11 0 3 2 6 4 9 4 1.5 0 2.8-.6 4-1.6 1.2 1 2.5 1.6 4 1.6 3 0 6-2 9-4 3-2 7-2 11 0-2 6-9 10-15 9-3-.5-5.5-2-7-3.6-.6.5-1.3.8-2 .8s-1.4-.3-2-.8c-1.5 1.6-4 3.1-7 3.6-6 1-13-3-15-9z"
        fill="currentColor"
      />
    </svg>
  );
}