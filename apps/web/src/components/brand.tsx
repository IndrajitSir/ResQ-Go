import Link from 'next/link';

/**
 * The ResQ-Go mark: a rounded tile carrying a pulse/response glyph. Rendered as
 * inline SVG so it inherits currentColor and needs no asset pipeline.
 */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="9" fill="url(#resqgo-mark)" />
      <path
        d="M6 17h4.2l2.1-5.4 3 10.2 2.6-6.4 1.6 3.4h6.5"
        stroke="#fff"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="resqgo-mark" x1="0" y1="0" x2="32" y2="32">
          <stop stopColor="#179f90" />
          <stop offset="1" stopColor="#0a6660" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function BrandLink() {
  return (
    <Link href="/" className="nav-brand">
      <BrandMark />
      <span>ResQ&#8209;Go</span>
    </Link>
  );
}