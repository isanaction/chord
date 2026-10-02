import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Stroke({ size = 22, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconBack = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M15 18l-6-6 6-6" />
  </Stroke>
);

export const IconSliders = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
    <circle cx="15" cy="6" r="2" />
    <circle cx="9" cy="12" r="2" />
    <circle cx="17" cy="18" r="2" />
  </Stroke>
);

export const IconPlus = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M12 5v14M5 12h14" />
  </Stroke>
);

export const IconMinus = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M5 12h14" />
  </Stroke>
);

export const IconSearch = (p: IconProps) => (
  <Stroke {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-5-5" />
  </Stroke>
);

export const IconClose = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Stroke>
);

export const IconCheck = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M5 12l5 5 9-10" />
  </Stroke>
);

export const IconAlert = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M12 3l10 18H2z" />
    <path d="M12 10v5M12 18h.01" />
  </Stroke>
);

export const IconEdit = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
    <path d="M13 7l4 4" />
  </Stroke>
);

export const IconExpand = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </Stroke>
);

export const IconSlower = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M11 6l-6 6 6 6M19 6l-6 6 6 6" />
  </Stroke>
);

export const IconFaster = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M13 6l6 6-6 6M5 6l6 6-6 6" />
  </Stroke>
);

export const IconDownload = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M12 3v12M7 10l5 5 5-5M4 21h16" />
  </Stroke>
);

export const IconLock = (p: IconProps) => (
  <Stroke {...p}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Stroke>
);

export const IconMusic = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </Stroke>
);

export const IconTrash = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </Stroke>
);

export function IconPlay({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 4l13 8-13 8z" />
    </svg>
  );
}

export function IconPause({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
    </svg>
  );
}
