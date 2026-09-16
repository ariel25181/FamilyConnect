const webpush = require('web-push');

const FIREBASE_DB_URL = 'https://familyconnect-b1c23-default-rtdb.firebaseio.com';

webpush.setVapidDetails(
  'mailto:ariel@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const body = JSON.parse(event.body);

    // ---------- PUSH DE LLAMADA: va solo al destinatario, no a todos ----------
    if (body.type === 'call') {
      const { callId, toId, senderId, senderName } = body;

      const subRes = await fetch(FIREBASE_DB_URL + '/subscriptions/' + toId + '.json');
      const sub = await subRes.json();
      if (!sub) return { statusCode: 200, body: JSON.stringify({ sent: 0, reason: 'no_subscription' }) };

      const payload = JSON.stringify({
        type: 'call',
        callId,
        senderId,
        senderName
      });

      try {
        await webpush.sendNotification(sub, payload);
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await fetch(FIREBASE_DB_URL + '/subscriptions/' + toId + '.json', { method: 'DELETE' });
          return { statusCode: 200, body: JSON.stringify({ sent: 0, reason: 'subscription_expired' }) };
        }
        return { statusCode: 200, body: JSON.stringify({ sent: 0, reason: 'push_send_failed', detail: String(err.statusCode || err.message || err) }) };
      }

      return { statusCode: 200, body: JSON.stringify({ sent: 1 }) };
    }

    // ---------- PUSH DE MENSAJE NORMAL: broadcast a todos menos el que envió ----------
    const { senderId, senderName, text } = body;

    const res = await fetch(FIREBASE_DB_URL + '/subscriptions.json');
    const subscriptions = await res.json() || {};

    const payload = JSON.stringify({
      title: 'Familia - ' + (senderName || 'Nuevo mensaje'),
      body: text || '',
      url: './'
    });

    const sendJobs = Object.entries(subscriptions)
      .filter(function (entry) { return entry[0] !== senderId; })
      .map(function (entry) {
        const memberId = entry[0];
        const sub = entry[1];
        return webpush.sendNotification(sub, payload).catch(async function (err) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await fetch(FIREBASE_DB_URL + '/subscriptions/' + memberId + '.json', { method: 'DELETE' });
          }
        });
      });

    await Promise.all(sendJobs);

    return { statusCode: 200, body: JSON.stringify({ sent: sendJobs.length }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
