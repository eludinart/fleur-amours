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

function fleurWithBasePath(raw) {
  var bp = '${basePath}';
  if (bp.slice(-1) === '/') bp = bp.slice(0, -1);
  if (!raw || raw === '/') return bp;
  var s = String(raw);
  if (s.indexOf('http') === 0) return s;
  var r = s.charAt(0) === '/' ? s : '/' + s;
  if (r === bp || r.indexOf(bp + '/') === 0) return r;
  return bp + r;
}

// Notifications en arrière-plan (app fermée ou minimisée)
messaging.onBackgroundMessage(function(payload) {
  const title = payload.notification?.title || "Fleur d'Amours";
  const body = payload.notification?.body || '';
  var path = fleurWithBasePath(payload.data?.action_url || '${basePath}');

  self.registration.showNotification(title, {
    body: body,
    icon: '${icon}',
    badge: '${icon}',
    tag: 'fleur-message',
    renotify: true,
    data: { url: path },
  });
});

// Clic sur la notification : ouvre l'app (chemin toujours avec basePath /jardin)
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var path = fleurWithBasePath(event.notification.data?.url || '${basePath}');
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf('${basePath}') !== -1 && 'focus' in client) {
          return client.focus();
        }
      }
      var toOpen = path.indexOf('http') === 0 ? path : (self.location.origin + path);
      return clients.openWindow(toOpen);
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
