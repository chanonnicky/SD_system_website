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
  const n = payload.notification || {};
  self.registration.showNotification(n.title || 'AV โสตทัศนูปกรณ์', {
    body: n.body || '',
    icon: '/SD_AV_website/assets/img/school_logo.webp',
    badge: '/SD_AV_website/assets/img/school_logo.webp',
    data: { url: 'https://chanonnicky.github.io/SD_AV_website/' },
  });
});

// เมื่อกด notification → เปิดเว็บ
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url)
    || 'https://chanonnicky.github.io/SD_AV_website/';
  event.waitUntil(clients.openWindow(url));
});
