/**
 * Analytics tracking helper.
 * Controlled by the following environment variables:
 * - NEXT_PUBLIC_ANALYTICS_ENABLED: 'true' to enable tracking
 * - NEXT_PUBLIC_ANALYTICS_PROVIDER: 'console' | 'plausible' | 'umami'
 * - NEXT_PUBLIC_ANALYTICS_SITE_ID: Identification key
 */

const isEnabled = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true';
const provider = process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER || 'console';
const siteId = process.env.NEXT_PUBLIC_ANALYTICS_SITE_ID || '';

export function trackEvent(name: string, properties?: Record<string, any>) {
  if (!isEnabled) {
    return;
  }

  try {
    // 1. Console provider stub
    if (provider === 'console') {
      // eslint-disable-next-line no-console
      console.log(`[Analytics Event: ${name}]`, { siteId, ...properties });
      return;
    }

    // 2. Plausible analytics integration
    if (provider === 'plausible') {
      const windowAny = window as any;
      if (windowAny.plausible) {
        windowAny.plausible(name, { props: properties });
      } else {
        // eslint-disable-next-line no-console
        console.warn(`[Plausible Event: ${name}] script not loaded`, properties);
      }
      return;
    }

    // 3. Umami analytics integration
    if (provider === 'umami') {
      const windowAny = window as any;
      if (windowAny.umami && typeof windowAny.umami.track === 'function') {
        windowAny.umami.track(name, properties);
      } else {
        // eslint-disable-next-line no-console
        console.warn(`[Umami Event: ${name}] script not loaded`, properties);
      }
      return;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Analytics tracking error:', err);
  }
}
