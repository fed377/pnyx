import Svg, { Path } from "react-native-svg";

/** Google's official "G" logomark — the one spot of real color in the app;
 * brand guidelines require it unmodified, so it's exempt from the monochrome
 * token system on purpose. */
export function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M23.52 12.27c0-.82-.07-1.6-.2-2.36H12v4.47h6.47c-.28 1.5-1.13 2.77-2.4 3.62v3h3.87c2.27-2.09 3.58-5.17 3.58-8.73z"
      />
      <Path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.96H1.28v3.09C3.25 21.3 7.31 24 12 24z"
      />
      <Path
        fill="#FBBC05"
        d="M5.27 14.28A7.19 7.19 0 0 1 4.9 12c0-.79.14-1.56.37-2.28V6.63H1.28A11.99 11.99 0 0 0 0 12c0 1.94.46 3.77 1.28 5.37z"
      />
      <Path
        fill="#EA4335"
        d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.28 6.63l3.99 3.09C6.22 6.88 8.87 4.77 12 4.77z"
      />
    </Svg>
  );
}
