importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyASQuoat2a3LrbHY1r7_iycoIx-1bLgKxc',
  authDomain: 'sd-av-website.firebaseapp.com',
  projectId: 'sd-av-website',
  storageBucket: 'sd-av-website.firebasestorage.app',
  messagingSenderId: '134184397016',
  appId: '1:134184397016:web:b302bf3862374352044fad',
});

const messaging = firebase.messaging();

// รับ push เมื่อแอปอยู่ background
// Backend ส่ง data-only payload (no notification field) เพื่อไม่ให้ FCM auto-display
// → SW เป็นที่เดียวที่เรียก showNotification, ไม่ซ้ำ
const ORIGIN  = 'https://chanonnicky.github.io/SD_system_website';
const DEFAULT_ICON  = ORIGIN + '/assets/img/school_logo.webp';
const DEFAULT_IMAGE = ORIGIN + '/assets/img/school_logo.webp';

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const url   = data.url   || (ORIGIN + '/admin.html');
  const icon  = data.icon  || DEFAULT_ICON;
  const image = data.image || DEFAULT_IMAGE;
  const tag   = data.ticket || data.tag || ('av-' + Date.now());
  self.registration.showNotification(data.title || 'งานโสตและอาคารสถานที่', {
    body: data.body || '',
    icon: icon,
    badge: icon,
    image: image,
    tag: tag,
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: { url },
  });
});

// เมื่อกด notification → เปิดหน้า admin ตรง job นั้น
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url)
    || 'https://chanonnicky.github.io/SD_system_website/admin.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const match = wins.find(w => w.url.includes('admin.html'));
      if (match) { match.focus(); match.navigate(url); }
      else clients.openWindow(url);
    })
  );
});
