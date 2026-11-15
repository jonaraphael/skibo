export const Icon = ({ name, size = 20 }: { name: string; size?: number }) => {
  const paths: Record<string, React.ReactNode> = {
    today: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="m8 12 2.5 2.5L16 9" />
      </>
    ),
    plan: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2" />
      </>
    ),
    rewards: (
      <>
        <path d="M3 14h18l-2 6H5z" />
        <circle cx="12" cy="7" r="3" />
      </>
    ),
    menu: (
      <>
        <path d="M5 4h14v17H5zM9 9h6m-6 4h6m-6 4h3" />
      </>
    ),
    record: (
      <>
        <path d="M3 3v18h18M5 17h4v-5h5V8h6V4" />
      </>
    ),
    settings: (
      <>
        <path d="m9 3-.6 2.5-2 .9L4 5.6 2 9l1.9 1.8v2.4L2 15l2 3.4 2.4-.8 2 .9L9 21h4l.6-2.5 2-.9 2.4.8 2-3.4-1.9-1.8v-2.4L20 9l-2-3.4-2.4.8-2-.9L13 3z" />
        <circle cx="11" cy="12" r="3" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    more: (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
      </>
    ),
    leaf: (
      <>
        <path d="M19 3C6 2 2 9 6 16c7 4 14 0 13-13ZM4 21l10-11" />
      </>
    ),
    back: <path d="M19 12H5m5-5-5 5 5 5" />,
    download: (
      <>
        <path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.today}
    </svg>
  );
};
