/**
 * ML Agent Service Worker - Production Ready 2025
 * Push Notifications + Cache Inteligente + Auto-Update
 * Otimizado para Windows, iOS, Android com melhores práticas 2025
 */

// Versão do Service Worker - Production 2025
const SW_VERSION = '4.0.0';
const APP_NAME = 'ML Agent';
const CACHE_NAME = `ml-agent-cache-v${SW_VERSION}`;
const RUNTIME_CACHE = `ml-agent-runtime-v${SW_VERSION}`;
const APP_SCOPE = self.registration.scope;

// Detectar iOS
const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent || '');

// Recursos essenciais para cache (incluindo ícones iOS e offline page)
const ESSENTIAL_CACHE = [
  '/manifest.json',
  '/offline.html',
  '/apple-touch-icon.png',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
  '/icons/ios-icon-120.png',
  '/icons/ios-icon-152.png',
  '/icons/ios-icon-167.png',
  '/icons/ios-icon-180.png',
  '/notification-new.mp3'
];

// Estratégia: Stale-While-Revalidate com timeout para melhor UX
const NETWORK_TIMEOUT = 3000; // 3 segundos

// VAPID Public Key (hardcoded para service worker)
const VAPID_PUBLIC_KEY = 'BFDQNvQB1cWQbPHStt5S6mRtVCGldecWfKMDWfyBx2HTPhvitpZdVE7kMIAQPpGawd5GN7XrzMnvfMq3n7NOM0g';

// Helper: Network with timeout and fallback
async function networkFirst(request, timeoutMs = NETWORK_TIMEOUT) {
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Network timeout')), timeoutMs)
    );

    const fetchPromise = fetch(request);
    const response = await Promise.race([fetchPromise, timeoutPromise]);

    // Cachear resposta válida em runtime cache
    if (response && response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    // Tentar cache como fallback
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] Using cached response for:', request.url);
      return cachedResponse;
    }

    // Se não tem cache e é uma página, retornar offline page
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match('/offline.html');
      if (offlinePage) {
        return offlinePage;
      }
    }

    // Último recurso: erro
    return new Response('Offline - Verifique sua conexão', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' })
    });
  }
}

// Helper: Cache first com network fallback (para recursos estáticos)
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Recurso não disponível', {
      status: 404,
      statusText: 'Not Found'
    });
  }
}

// Fetch Event - Estratégia otimizada por tipo de recurso (2025 Best Practices)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const { pathname } = url;
  const request = event.request;

  // Ignorar requisições que não são do nosso domínio (exceto APIs ML)
  if (!url.origin.includes(self.location.origin) && !url.host.includes('mercadolibre.com')) {
    return;
  }

  // APIs e páginas dinâmicas: Network First com timeout
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/data/') ||
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/agente') ||
    pathname.startsWith('/answer/') ||
    pathname.startsWith('/approve/')
  ) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Next.js chunks: Cache First (SWR no background)
  if (pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Imagens, fontes, audio: Cache First
  if (pathname.match(/\.(png|jpg|jpeg|svg|ico|woff|woff2|ttf|eot|mp3|mp4|webm)$/)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // CSS/JS: Stale-While-Revalidate
  if (pathname.match(/\.(css|js)$/)) {
    event.respondWith(
      caches.match(request).then(cached => {
        const fetchPromise = fetch(request).then(response => {
          if (response && response.ok) {
            const cache = caches.open(CACHE_NAME);
            cache.then(c => c.put(request, response.clone()));
          }
          return response;
        }).catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // Default: Network First
  event.respondWith(networkFirst(request));
});

// Evento de instalação
self.addEventListener('install', (event) => {
  console.log(`[SW v${SW_VERSION}] Installing...`);

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache apenas recursos estáticos essenciais
      return cache.addAll(ESSENTIAL_CACHE).catch(err => {
        console.warn('[SW] Erro ao cachear recursos:', err);
      });
    })
  );

  // Skip waiting para ativar imediatamente
  self.skipWaiting();
});

// Evento de ativação - Production Ready 2025
self.addEventListener('activate', (event) => {
  console.log(`[SW v${SW_VERSION}] Activating...`);

  event.waitUntil(
    Promise.all([
      // Tomar controle de todas as páginas imediatamente
      clients.claim(),

      // Limpar caches antigos de forma inteligente
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            // Manter apenas caches da versão atual
            if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
              console.log(`[SW v${SW_VERSION}] Deletando cache antigo: ${cacheName}`);
              return caches.delete(cacheName);
            }
          })
        );
      }),

      // Notificar clientes sobre atualização
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
        console.log(`[SW v${SW_VERSION}] Notifying ${windowClients.length} clients`);
        windowClients.forEach(client => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: SW_VERSION,
            timestamp: Date.now()
          });
        });
      })
    ]).then(() => {
      console.log(`[SW v${SW_VERSION}] Activated successfully!`);
    })
  );
});

// Keep-alive para iOS - evitar que pare as notificações
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'keep-alive') {
    event.waitUntil(
      // Ping backend para manter subscription ativa
      fetch('/api/push/keep-alive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).catch(() => {})
    );
  }
});

// Push notification received - iOS optimized
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received - iOS optimized');

  let notificationData = {
    title: '🔔 ML Agent',
    body: 'Nova notificação do Mercado Livre',
    icon: '/mlagent-logo-3d.png',
    badge: '/mlagent-logo-3d.png',
    tag: 'ml-notification',
    requireInteraction: false,
    silent: false,
    data: {}
  };

  // Processar dados do push
  if (event.data) {
    try {
      const payload = event.data.json();

      // Customizar notificação baseado no tipo
      switch (payload.type) {
        case 'new_question':
          notificationData = {
            title: `🔔 ${payload.sellerName || 'ML Agent'}`,
            body: payload.questionText || 'Nova pergunta recebida',
            icon: '/mlagent-logo-3d.png',
            badge: '/mlagent-logo-3d.png',
            tag: `question-${payload.questionId}`,
            requireInteraction: false, // iOS não suporta requireInteraction
            silent: false,
            vibrate: [200, 100, 200],
            data: {
              type: 'question',
              questionId: payload.questionId,
              accountId: payload.accountId,
              url: payload.url || '/agente'
            },
            actions: [
              {
                action: 'answer',
                title: '✅ Responder',
                icon: '/icons/shortcuts/questions.png'
              },
              {
                action: 'later',
                title: '⏰ Ver Depois',
                icon: '/icons/icon-96x96.png'
              }
            ]
          };
          break;

        case 'batch_questions':
          notificationData = {
            title: `🔔 ${payload.sellerName || 'ML Agent'}`,
            body: `Você tem ${payload.count} novas perguntas`,
            icon: '/mlagent-logo-3d.png',
            badge: '/mlagent-logo-3d.png',
            tag: 'questions-batch',
            requireInteraction: true,
            vibrate: [200, 100, 200, 100, 200],
            data: {
              type: 'batch',
              count: payload.count,
              url: '/agente'
            }
          };
          break;

        case 'urgent_question':
          notificationData = {
            title: `⚠️ URGENTE - ${payload.sellerName}`,
            body: `Pergunta há ${payload.hours}h sem resposta: ${payload.questionText}`,
            icon: '/mlagent-logo-3d.png',
            badge: '/mlagent-logo-3d.png',
            tag: `urgent-${payload.questionId}`,
            requireInteraction: true,
            silent: false,
            vibrate: [500, 250, 500], // Vibração mais longa para urgente
            data: {
              type: 'urgent',
              questionId: payload.questionId,
              url: payload.url || '/agente'
            },
            actions: [
              {
                action: 'answer_now',
                title: '🚨 Responder Agora',
                icon: '/icons/shortcuts/questions.png'
              }
            ]
          };
          break;

        case 'answer_approved':
          notificationData = {
            title: '✅ Resposta Aprovada',
            body: `${payload.sellerName}: ${payload.message}`,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            tag: `approved-${payload.questionId}`,
            requireInteraction: false,
            data: {
              type: 'approved',
              questionId: payload.questionId
            }
          };
          break;

        case 'error':
          notificationData = {
            title: '❌ Erro no ML Agent',
            body: payload.message || 'Ocorreu um erro ao processar sua solicitação',
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            tag: 'error',
            requireInteraction: true,
            data: {
              type: 'error'
            }
          };
          break;

        default:
          // Notificação genérica
          notificationData.body = payload.message || notificationData.body;
          notificationData.data = payload;
      }

      // Adicionar imagem do produto se disponível
      if (payload.productImage) {
        notificationData.image = payload.productImage;
      }

      // Timestamp para tracking
      notificationData.timestamp = Date.now();

    } catch (e) {
      console.error('[SW] Error parsing push data:', e);
    }
  }

  // Mostrar notificação
  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );

  // Analytics: contar notificações enviadas
  if (notificationData.data.type === 'question') {
    trackPushEvent('delivered', notificationData.data);
  }
});

// Evento de clique na notificação
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification.tag);

  const notification = event.notification;
  const data = notification.data || {};

  // Fechar notificação
  notification.close();

  // Processar ação
  if (event.action) {
    switch (event.action) {
      case 'answer':
      case 'answer_now':
        // Abrir página de perguntas
        event.waitUntil(
          openUrl(data.url || '/agente', data.questionId)
        );
        trackPushEvent('clicked_answer', data);
        break;

      case 'later':
        // Apenas fechar, usuário verá depois
        trackPushEvent('clicked_later', data);
        break;

      default:
        event.waitUntil(
          openUrl(data.url || '/')
        );
    }
  } else {
    // Clique na notificação (não na ação)
    event.waitUntil(
      openUrl(data.url || '/agente', data.questionId)
    );
    trackPushEvent('clicked', data);
  }
});

// Função para abrir URL
async function openUrl(url, questionId) {
  // Adicionar questionId na URL se disponível
  if (questionId && !url.includes('questionId')) {
    url += (url.includes('?') ? '&' : '?') + `questionId=${questionId}&source=push`;
  } else if (!url.includes('source=push')) {
    url += (url.includes('?') ? '&' : '?') + 'source=push';
  }

  const urlToOpen = new URL(url, self.location.origin).href;

  // Procurar por janelas/abas existentes
  const windowClients = await clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  });

  // Verificar se já existe uma aba aberta do PWA
  for (const windowClient of windowClients) {
    // Verificar se é nosso PWA (não apenas mesma origem)
    if (windowClient.url.includes(self.location.origin) &&
        (windowClient.url.includes('/agente') ||
         windowClient.url.includes('/answer/') ||
         windowClient.url === self.location.origin + '/')) {
      // Focar na aba existente e navegar
      await windowClient.focus();
      await windowClient.navigate(urlToOpen);
      return;
    }
  }

  // Se não houver aba aberta, abrir uma nova
  await clients.openWindow(urlToOpen);
}

// Analytics básico
function trackPushEvent(action, data) {
  // Enviar evento para analytics (se configurado)
  fetch('/api/analytics/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      type: data.type,
      questionId: data.questionId,
      timestamp: Date.now()
    })
  }).catch(() => {
    // Falha silenciosa em analytics
  });
}

// Evento de push subscription change
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Push subscription changed');

  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    })
    .then(subscription => {
      // Enviar nova subscription para o servidor
      return fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription,
          resubscribe: true
        })
      });
    })
  );
});

// Helper: converter VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = self.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Background Sync para reenviar notificações perdidas - Best Practice 2025
self.addEventListener('sync', (event) => {
  if (event.tag === 'check-notifications') {
    console.log('[SW] Background sync: checking for missed notifications');
    event.waitUntil(
      fetch('/api/push/check-missed')
        .then(response => response.json())
        .then(data => {
          if (data.missedNotifications > 0) {
            return self.registration.showNotification('🔔 ML Agent', {
              body: `Você tem ${data.missedNotifications} notificações não lidas`,
              icon: '/mlagent-logo-3d.png',
              badge: '/icons/icon-72x72.png',
              tag: 'missed-notifications',
              requireInteraction: true, // Manter visível até interação
              data: { url: '/agente' }
            });
          }
        })
        .catch(err => console.error('[SW] Background sync error:', err))
    );
  }

  // Sync para verificar novas perguntas
  if (event.tag === 'sync-questions') {
    console.log('[SW] Syncing questions...');
    event.waitUntil(
      fetch('/api/agent/questions-multi')
        .then(response => response.json())
        .then(data => {
          if (data.questions && data.questions.length > 0) {
            // Cache questions for offline access
            return caches.open(CACHE_NAME).then(cache => {
              return cache.put('/api/agent/questions-multi',
                new Response(JSON.stringify(data)));
            });
          }
        })
        .catch(err => console.error('[SW] Questions sync error:', err))
    );
  }
});

// Periodic Background Sync (para navegadores que suportam) - Best Practice 2025
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-questions') {
    console.log('[SW] Periodic sync: checking for new questions');
    event.waitUntil(
      fetch('/api/push/check-questions')
        .then(response => response.json())
        .then(data => {
          if (data.newQuestions > 0) {
            // Play notification sound
            self.clients.matchAll().then(clients => {
              clients.forEach(client => {
                client.postMessage({
                  type: 'play-sound',
                  sound: '/notification-new.mp3'
                });
              });
            });

            return self.registration.showNotification('🔔 Novas Perguntas', {
              body: `${data.newQuestions} perguntas aguardando resposta`,
              icon: '/mlagent-logo-3d.png',
              badge: '/icons/icon-72x72.png',
              tag: 'new-questions',
              requireInteraction: true,
              vibrate: [200, 100, 200],
              data: { url: '/agente' }
            });
          }
        })
        .catch(err => console.error('[SW] Periodic sync error:', err))
    );
  }
});

// Heartbeat para manter service worker ativo - Optimized for 2025
setInterval(() => {
  console.log(`[SW v${SW_VERSION}] Heartbeat - ${new Date().toISOString()}`);

  // Verificar se há clientes conectados
  clients.matchAll().then(clients => {
    if (clients.length > 0) {
      console.log(`[SW] Active clients: ${clients.length}`);

      // Register sync if needed
      self.registration.sync.register('check-notifications')
        .catch(err => console.log('[SW] Sync registration failed:', err));
    }
  });
}, 5 * 60 * 1000); // A cada 5 minutos

// Wake Lock API to keep app active (experimental)
if ('wakeLock' in navigator) {
  navigator.wakeLock.request('screen').catch(() => {
    console.log('[SW] Wake Lock not supported');
  });
}

console.log(`[SW v${SW_VERSION}] ML Agent Service Worker loaded - Production Ready 2025`);