import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="180" height="180">
        <circle cx="20" cy="20" r="18" fill="#1b3a6b" />
        <path
          fill="#ffffff"
          d="M20 9.5l2.35 7.23h7.6l-6.15 4.47 2.35 7.23L20 23.96l-6.15 4.47 2.35-7.23-6.15-4.47h7.6z"
        />
        <circle cx="30.5" cy="30.5" r="3.25" fill="#c8102e" />
      </svg>
    ),
    { width: 180, height: 180 },
  );
}
