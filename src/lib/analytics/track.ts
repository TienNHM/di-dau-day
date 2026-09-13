/**
 * Analytics seam.
 *
 * GitHub Pages rules out Vercel Analytics, and MVP should not pay for anything, so
 * this is a no-op until a provider is configured. Keeping the seam means every event
 * call site is already written and named — adding Umami or Plausible later is a
 * script tag plus the branch below, not a hunt through the codebase.
 *
 * Deliberately no personal data: event names and a slug, nothing that identifies a
 * visitor. There is no consent banner precisely because there is nothing to consent to.
 */

export type AnalyticsEvent =
  | 'intent_select'
  | 'wizard_answer'
  | 'spin_start'
  | 'result_view'
  | 'directions_click'
  | 'share_click'
  /** Kept apart from share_click: posting a story and sending a link are different acts. */
  | 'share_story_click'
  | 'reroll_click'
  | 'contribute_submit'
  /** The dish flow is a different question from the wizard, so it counts separately. */
  | 'dish_spin_start'
  | 'dish_place_click';

type Props = Record<string, string | number | boolean | undefined>;

type UmamiWindow = Window & {
  umami?: { track: (event: string, data?: Props) => void };
};

export function track(event: AnalyticsEvent, props: Props = {}): void {
  if (typeof window === 'undefined') return;

  const umami = (window as UmamiWindow).umami;
  if (umami) {
    umami.track(event, props);
    return;
  }

  if (process.env.NODE_ENV === 'development') {
    console.debug('[analytics]', event, props);
  }
}
