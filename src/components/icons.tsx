import type { SVGProps } from "react";

const PATHS = {
  documents: "M7 3h7l5 5v13H7V3Zm7 0v5h5M10 13h6M10 17h6",
  clients: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.5A6 6 0 0 1 21 20",
  products: "m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 9 8-4.5M12 12v9M12 12 4 7.5",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-2.5a7.6 7.6 0 0 0 0-1l2-1.5-2-3.4-2.3.9a7.5 7.5 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.5 7.5 0 0 0-1.7 1l-2.3-.9-2 3.4 2 1.5a7.6 7.6 0 0 0 0 1l-2 1.5 2 3.4 2.3-.9c.5.4 1.1.7 1.7 1l.4 2.5h4l.4-2.5c.6-.3 1.2-.6 1.7-1l2.3.9 2-3.4-2-1.5Z",
  plus: "M12 5v14M5 12h14",
  check: "m5 12.5 4.5 4.5L19 7",
  back: "m15 5-7 7 7 7",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 5 5",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  download: "M12 4v11m-4-4 4 4 4-4M5 20h14",
  print: "M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7v-7Z",
  copy: "M9 9h11v11H9V9Zm-4 6H4V4h11v1",
  close: "m6 6 12 12M18 6 6 18",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6M9 12h6",
  invoice: "M7 3h7l5 5v13H7V3Zm7 0v5h5M10 13h6M10 17h4",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v10H6V11Z",
  edit: "m4 20 1-4L16 5l3 3L8 19l-4 1Z",
  warn: "M12 4 22 20H2L12 4Zm0 6v5m0 2.5v.01",
  chevron: "m9 6 6 6-6 6",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, ...props }: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
