Acá está — copiá todo esto y pegalo en el editor de GitHub al crear el archivo `netlify/functions/send-push.js`:```javascript
// Netlify Function: recibe "mandé un mensaje" desde el celular del que escribió,
// y le manda un push real (vía Web Push, gratis, sin Firebase Cloud Functions) a los demás.

const webpush = require('web-push');

const FIREBASE_DB_URL = 'https://familyconnect-b1c23-default-rtdb.firebaseio.com';

webpush.setVapidDetails(
  'mailto:ariel@example.com', // no necesita ser real, Chrome solo lo pide como contacto
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { senderId, senderName, text } = JSON.parse(event.body);

    // Traemos todas las suscripciones guardadas en Firebase (lectura pública, sin credenciales)
    const res = await fetch(`${FIREBASE_DB_URL}/subscriptions.json`);
    const subscriptions = await res.json() || {};

    const payload = JSON.stringify({
      title: 'Familia — ' + (senderName || 'Nuevo mensaje'),
      body: text || '',
      url: './'
    });

    const sendJobs = Object.entries(subscriptions)
      .filter(([memberId]) => memberId !== senderId) // no notificar al que envió
      .map(([memberId, sub]) =>
        webpush.sendNotification(sub, payload).catch(async (err) => {
          // si la suscripción quedó vieja/inválida (410/404), la borramos de Firebase
          if (err.statusCode === 410 || err.statusCode === 404) {
            await fetch(`${FIREBASE_DB_URL}/subscriptions/${memberId}.json`, { method: 'DELETE' });
          }
        })
      );

    await Promise.all(sendJobs);

    return { statusCode: 200, body: JSON.stringify({ sent: sendJobs.length }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
```

Recordá: al crear el archivo en GitHub, en el campo del nombre escribí `netlify/functions/send-push.js` (con las barras) — eso le crea las carpetas automáticamente sin que tengas que subir nada arrastrado.
