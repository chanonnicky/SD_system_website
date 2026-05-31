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
messaging.onBackgroundMessage((payload) => {
  const n    = payload.notification || {};
  const data = payload.data || {};
  const url  = data.url || 'https://chanonnicky.github.io/SD_system_website/admin.html';
  self.registration.showNotification(n.title || 'AV โสตทัศนูปกรณ์', {
    body: n.body || '',
    icon: '/SD_system_website/assets/img/school_logo.webp',
    badge: '/SD_system_website/assets/img/school_logo.webp',
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
