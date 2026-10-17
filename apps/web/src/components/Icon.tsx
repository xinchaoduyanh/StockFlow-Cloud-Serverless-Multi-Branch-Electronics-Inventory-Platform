const ICON_PATHS = {
  package: "M12 3l8 4.2v9.6L12 21l-8-4.2V7.2L12 3z M4 7.2l8 4.3 8-4.3 M12 11.5V21",
  transfer: "M4 8h14 M14 4l4 4-4 4 M20 16H6 M10 12l-4 4 4 4",
  upload: "M12 16V4 M7.5 8.5L12 4l4.5 4.5 M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3",
  alert: "M12 4l9 16H3L12 4z M12 10v4 M12 17.2v.1",
  alertCircle: "M12 21a9 9 0 100-18 9 9 0 000 18z M12 7.5v5 M12 16v.1",
  checkCircle: "M12 21a9 9 0 100-18 9 9 0 000 18z M8 12.3l2.8 2.8L16 9.5",
  chart: "M4 20h16 M7 20v-7 M12 20V6 M17 20v-4",
  trash: "M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 11v6 M14 11v6",
  reconcile:
    "M9 4h6v3H9z M7 5.5H6a1 1 0 00-1 1V20a1 1 0 001 1h12a1 1 0 001-1V6.5a1 1 0 00-1-1h-1 M9 14l2.2 2.2L15.5 12",
  users:
    "M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7z M2.5 20v-1a5 5 0 015-5h3a5 5 0 015 5v1 M16 4.3a3.5 3.5 0 010 6.4 M18.5 14.3A5 5 0 0121.5 19v1",
  store:
    "M4 9l1.5-5h13L20 9 M4 9a2.7 2.7 0 005.3 0 2.7 2.7 0 005.4 0A2.7 2.7 0 0020 9 M5 12v8h14v-8 M10 20v-5h4v5",
  logout: "M10 4H6a2 2 0 00-2 2v12a2 2 0 002 2h4 M15 8l4 4-4 4 M19 12H9",
  close: "M6 6l12 12 M18 6L6 18",
  menu: "M4 7h16 M4 12h16 M4 17h16",
  lock: "M6 11h12v9H6z M8.5 11V8a3.5 3.5 0 017 0v3 M12 15v2",
  plus: "M12 5v14 M5 12h14",
  cloudUpload:
    "M7 18a4.5 4.5 0 01-.6-8.96A6 6 0 0117.8 8.6 4 4 0 0117 18 M12 17v-6 M9.5 13.2L12 10.7l2.5 2.5",
  file: "M7 3h7l5 5v12a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z M14 3v5h5 M9 13h6 M9 17h6",
  check: "M5 12.5l4.5 4.5L19 7.5",
  list: "M9 7h11 M9 12h11 M9 17h11 M4.5 7h.01 M4.5 12h.01 M4.5 17h.01",
  chevronLeft: "M14.5 6l-6 6 6 6",
  chevronRight: "M9.5 6l6 6-6 6",
  chevronDown: "M6 9.5l6 6 6-6",
  mail: "M4 6h16v12H4z M4 7l8 6 8-6",
  eye: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z M12 14.8a2.8 2.8 0 100-5.6 2.8 2.8 0 000 5.6z",
  eyeOff:
    "M3.5 3.5l17 17 M10 6a9 9 0 012-.5C18 5.5 21.5 12 21.5 12a17 17 0 01-2.6 3.4 M6.2 7.4A16.6 16.6 0 002.5 12S6 18.5 12 18.5a9 9 0 003.4-.7 M9.9 9.9a2.8 2.8 0 003.2 3.2",
  moon: "M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z",
  sun: "M12 16a4 4 0 100-8 4 4 0 000 8z M12 2.5v2 M12 19.5v2 M2.5 12h2 M19.5 12h2 M5.3 5.3l1.4 1.4 M17.3 17.3l1.4 1.4 M18.7 5.3l-1.4 1.4 M6.7 17.3l-1.4 1.4",
  pencil: "M4 20l1-4L16.5 4.5a2 2 0 013 3L8 19l-4 1z M14.5 6.5l3 3",
  bell: "M6 17v-6a6 6 0 1112 0v6l1.5 2h-15L6 17z M10 21h4",
  inbox: "M4 13l2.5-8h11L20 13 M4 13v6h16v-6 M4 13h4.5a3.5 3.5 0 007 0H20",
  search: "M11 18a7 7 0 100-14 7 7 0 000 14z M20 20l-4-4",
  refresh: "M4 12a8 8 0 0113.7-5.6L20 8 M20 4v4h-4 M20 12a8 8 0 01-13.7 5.6L4 16 M4 20v-4h4",
  download: "M12 4v12 M7.5 11.5L12 16l4.5-4.5 M4 19h16",
  lifebuoy:
    "M12 21a9 9 0 100-18 9 9 0 000 18z M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z M5.6 5.6l3 3 M15.4 15.4l3 3 M18.4 5.6l-3 3 M8.6 15.4l-3 3",
} as const;

export type IconName = keyof typeof ICON_PATHS;

type IconProps = {
  name: IconName;
  className?: string;
  strokeWidth?: number;
};

/** One stroke weight and one drawing grid (24px) for every icon in the app. */
export function Icon({ name, className = "h-5 w-5", strokeWidth = 1.75 }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      viewBox="0 0 24 24"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}
