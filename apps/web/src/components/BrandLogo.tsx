type BrandMarkProps = {
  className?: string;
};

/** A "D" stamped on an IC package: pins in ink, body in the accent colour. */
export function BrandMark({ className = "h-9 w-9" }: BrandMarkProps) {
  return (
    <svg className={className} viewBox="0 0 48 48" role="img" aria-label="DuyAnhShop">
      <g fill="var(--color-text-primary)">
        <rect x="3" y="12" width="9" height="4" rx="1.2" />
        <rect x="3" y="22" width="9" height="4" rx="1.2" />
        <rect x="3" y="32" width="9" height="4" rx="1.2" />
        <rect x="36" y="12" width="9" height="4" rx="1.2" />
        <rect x="36" y="22" width="9" height="4" rx="1.2" />
        <rect x="36" y="32" width="9" height="4" rx="1.2" />
      </g>
      <rect x="9" y="5" width="30" height="38" rx="7" fill="var(--color-accent-solid)" />
      <circle cx="15.5" cy="11.5" r="1.9" fill="var(--color-accent-contrast)" />
      <path
        fill="var(--color-accent-contrast)"
        fillRule="evenodd"
        d="M17.5 16.5h6.2a7.5 7.5 0 0 1 0 15h-6.2zm4.4 4.2v6.6h1.8a3.3 3.3 0 0 0 0-6.6z"
      />
    </svg>
  );
}

type BrandLogoProps = {
  markClassName?: string;
  /** Second line under the wordmark, e.g. the product or screen name. */
  caption?: string;
};

export function BrandLogo({ markClassName, caption }: BrandLogoProps) {
  return (
    <div className="flex items-center gap-3">
      <BrandMark className={markClassName} />
      <div className="grid leading-none">
        <span className="font-display text-[1.15rem] font-bold tracking-tight text-[var(--color-text-primary)]">
          DuyAnh<span className="text-[var(--color-accent-solid)]">Shop</span>
        </span>
        {caption ? (
          <span className="mt-1 font-mono text-[10px] tracking-wide text-[var(--color-text-muted)]">
            {caption}
          </span>
        ) : null}
      </div>
    </div>
  );
}
