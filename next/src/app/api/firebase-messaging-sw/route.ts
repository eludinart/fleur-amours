/**
 * GET /api/firebase-messaging-sw
 * Génère le service worker Firebase Messaging avec la config embarquée.
 * Servi avec Content-Type: application/javascript pour pouvoir être
 * enregistré comme service worker.
 *
 * L'en-tête Service-Worker-Allowed: /jardin permet d'étendre le scope
 * au-delà du chemin de ce fichier (/api/).
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  // NEXT_PUBLIC_* sont inlinés au build côté client, mais restent lisibles
  // côté serveur via process.env si Coolify les expose aussi comme runtime vars.
  // On accepte également les versions sans préfixe comme fallback.
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? process.env.FIREBASE_API_KEY ?? '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? process.env.FIREBASE_AUTH_DOMAIN ?? '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID ?? process.env.FCM_PROJECT_ID ?? '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? process.env.FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? process.env.FIREBASE_APP_ID ?? '',
  }

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'
  const icon = `${basePath}/juste-la-fleur.png`

  // Si Firebase n'est pas configuré, retourner un SW vide valide
  if (!config.projectId || !config.apiKey) {
    return new Response(
      `// Firebase non configuré — push désactivé\nself.addEventListener('install', () => self.skipWaiting())`,
      {
        headers: {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Service-Worker-Allowed': basePath,
          'Cache-Control': 'no-cache',
        },
      }
    )
  }

  const swScript = `
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp(${JSON.stringify(config)});

const messaging = firebase.messaging();

// Notifications en arrière-plan (app fermée ou minimisée)
messaging.onBackgroundMessage(function(payload) {
  const title = payload.notification?.title || "Fleur d'Amours";
  const body = payload.notification?.body || '';
  const actionUrl = payload.data?.action_url || '${basePath}';

  self.registration.showNotification(title, {
    body: body,
    icon: '${icon}',
    badge: '${icon}',
    tag: 'fleur-message',
    renotify: true,
    data: { url: actionUrl },
  });
});

// Clic sur la notification : ouvre l'app
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data?.url || '${basePath}';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url.includes('${basePath}') && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
`.trim()

  return new Response(swScript, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Service-Worker-Allowed': basePath,
      'Cache-Control': 'no-store',
    },
  })
}
