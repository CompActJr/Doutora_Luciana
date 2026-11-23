import type { SVGProps } from "react";

const paths = {
  responses: "M4 4h16v12H9l-5 4V4Zm4 4h8M8 12h5",
  knowledge: "M4 4h6a3 3 0 0 1 3 3v13a4 4 0 0 0-4-2H4V4Zm9 3a3 3 0 0 1 3-3h4v14h-3a4 4 0 0 0-4 2",
  assistant: "M5 21a7 7 0 0 1 14 0M17 8a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  settings: "M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  chevron: "m9 5 7 7-7 7",
  back: "M19 12H5m7-7-7 7 7 7",
  filter: "M4 7h16M7 12h10m-7 5h4",
  eye: "M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  sparkle: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z",
  simulator: "m8 4 12 8-12 8V4Z",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m13-17a4 4 0 0 1 0 8m5 9v-2a4 4 0 0 0-3-3M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  plus: "M12 5v14M5 12h14",
  search: "m16 16 4 4M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  copy: "M8 8h12v12H8V8ZM4 16V4h12",
  check: "m5 12 4 4L19 6",
  lock: "M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5V10Zm7 5v2",
  arrow: "M5 12h14m-5-5 5 5-5 5",
  history: "M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5m4-1v5l3 2",
  plug: "M9 3v5m6-5v5M6 8h12v3a6 6 0 0 1-12 0V8Zm6 9v4",
  logout: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10",
  calendar: "M4 5h16v16H4V5Zm3-3v6m10-6v6M4 10h16M8 14h2m4 0h2m-8 3h2",
} as const;

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: keyof typeof paths }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]} /></svg>;
}
