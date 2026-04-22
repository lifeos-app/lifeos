/**
 * useTCSEnabled — TCS Plugin Gate Hook
 *
 * Returns true if TCS (Teddy's Cleaning Systems) UI should be shown for the
 * current user. TCS is a business-specific plugin; non-TCS users see a clean
 * generic LifeOS experience without cleaning-business widgets.
 *
 * Enabled when:
 *  - User email is in the TCS owner list (auto-enabled for the business owner)
 *  - User explicitly opted in via profile.preferences.tcs_enabled = true
 */

import { useUserStore } from '../stores/useUserStore';
import { isTCSEnabled } from '../lib/feature-gates';

export function useTCSEnabled(): boolean {
  const user = useUserStore(s => s.user);
  const profile = useUserStore(s => s.profile);
  return isTCSEnabled(user?.email, profile?.preferences);
}
