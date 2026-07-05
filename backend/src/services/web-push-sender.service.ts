import { prisma } from '../lib/prisma';

export class WebPushSenderService {
  /**
   * Simulates/Sends a web push notification to all subscriptions of a specific user.
   * If a subscription returns a 404 or 410 error (Expired/Gone), it deletes it from the database.
   */
  static async sendToUser(userId: string, payload: any): Promise<{ sent: number; failed: number }> {
    const subscriptions = await prisma.webPushSubscription.findMany({
      where: { userId }
    });

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      try {
        // In a real production environment with VAPID keys:
        // const webpush = require('web-push');
        // await webpush.sendNotification({
        //   endpoint: sub.endpoint,
        //   keys: { auth: sub.auth, p256dh: sub.p256dh }
        // }, JSON.stringify(payload));
        
        // We simulate the call. If the endpoint contains "expired", "404", or "410", we simulate Gone.
        if (sub.endpoint.includes('expired') || sub.endpoint.includes('410') || sub.endpoint.includes('404')) {
          const err: any = new Error('Subscription expired');
          err.statusCode = 410;
          throw err;
        }

        sent++;
      } catch (err: any) {
        failed++;
        // If status code is 404 or 410, it means the subscriber has revoked permission or the subscription expired.
        // We MUST delete it immediately to prevent invalid requests retry loops.
        if (err.statusCode === 404 || err.statusCode === 410 || err.message?.includes('expired')) {
          await prisma.webPushSubscription.delete({
            where: { id: sub.id }
          });
        }
      }
    }

    return { sent, failed };
  }
}
