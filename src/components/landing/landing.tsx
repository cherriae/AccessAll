/**
 * The landing page exists only on web (`landing.web.tsx`). Phones get the
 * onboarding walkthrough instead, so this native stub renders nothing.
 */
export interface LandingProps {
  /** Leave the landing page for a screen of the app. */
  onEnter: (path: string) => void;
}

export function Landing(_props: LandingProps) {
  return null;
}
