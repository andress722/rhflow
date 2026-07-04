import { api } from './api';

export async function trackEvent(
  eventName: string,
  category: string,
  properties: Record<string, any> = {}
) {
  try {
    // Fire-and-forget telemetry post
    api.post('/telemetry/events', {
      eventName,
      category,
      properties: {
        ...properties,
        url: typeof window !== 'undefined' ? window.location.href : '',
        referrer: typeof window !== 'undefined' ? document.referrer : '',
      },
    }).catch(() => {
      // Catch and ignore failures silently so telemetry never blocks execution
    });
  } catch (e) {
    // Silently capture errors
  }
}

export function trackPageView(path: string, category = 'PAGE_VIEW') {
  trackEvent('PAGE_VIEW', category, { path });
}

export function trackCriticalAction(actionType: string, category: string, extraProperties: Record<string, any> = {}) {
  trackEvent('CRITICAL_ACTION', category, {
    actionType,
    ...extraProperties,
  });
}
