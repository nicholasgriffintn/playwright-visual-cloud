type LogoProps = { compact?: boolean };

export function Logo({ compact = false }: LogoProps) {
  return (
    <span className="logo" aria-label="Visual Cloud">
      <svg className="logo-mark" viewBox="0 0 42 42" aria-hidden="true">
        <path className="logo-frame" d="M5 14V5h9M28 5h9v9M37 28v9h-9M14 37H5v-9" />
        <rect className="logo-before" x="11" y="11" width="14" height="14" rx="2" />
        <rect className="logo-after" x="17" y="17" width="14" height="14" rx="2" />
        <path className="logo-diff" d="m14 28 14-14" />
      </svg>
      {compact ? null : (
        <span className="logo-type">
          Visual <em>Cloud</em>
        </span>
      )}
    </span>
  );
}
