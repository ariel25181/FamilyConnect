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
    const { senderId, senderName, text } = JSON.parse(event.body);

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
