(function () {
  var _messaging = null;
  var _swReg = null;
  var _inited = false;

  // เรียกตรงจาก onclick button — ขอ permission ก่อนเลย ไม่รอ Firebase
  window.requestNotificationPermission = async function () {
    if (!('Notification' in window)) {
      alert('เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน');
      return;
    }
    const perm = await Notification.requestPermission();
    updateBtn(perm);
    if (perm === 'granted') {
      await ensureInit();
      await registerToken();
    } else if (perm === 'denied') {
      alert('การแจ้งเตือนถูกปิดอยู่\nกรุณาเปิดใน การตั้งค่า → เบราว์เซอร์ → การแจ้งเตือน');
    }
  };

  async function ensureInit() {
    if (_inited) return;
    if (!window.firebase || !window.APP_CONFIG || !window.APP_CONFIG.FIREBASE) return;
    try {
      if (!firebase.apps || !firebase.apps.length) {
        firebase.initializeApp(window.APP_CONFIG.FIREBASE);
      }
      _messaging = firebase.messaging();
      if (!_swReg) {
        _swReg = await navigator.serviceWorker.register('./sw.js');
      }
      _inited = true;
    } catch (err) {
      console.warn('[Notif] init error:', err);
    }
  }

  async function registerToken() {
    if (!_messaging || !_swReg || !window.APP_CONFIG) return;
    try {
      const token = await _messaging.getToken({
        vapidKey: window.APP_CONFIG.FIREBASE_VAPID,
        serviceWorkerRegistration: _swReg,
      });
      if (!token) return;
      await fetch(window.APP_CONFIG.GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'registerFCMToken',
          token: token,
          userAgent: navigator.userAgent,
        }),
      });
    } catch (err) {
      console.warn('[Notif] token error:', err);
    }
  }

  function updateBtn(permission) {
    var btn = document.getElementById('notifBtn');
    if (!btn) return;
    if (permission === 'granted') {
      btn.innerHTML = '<i class="fa-solid fa-bell" style="color:#4ade80"></i>';
      btn.title = 'เปิดการแจ้งเตือนแล้ว';
    } else if (permission === 'denied') {
      btn.innerHTML = '<i class="fa-solid fa-bell-slash" style="color:#f87171"></i>';
      btn.title = 'การแจ้งเตือนถูกปิด — เปิดในการตั้งค่าเบราว์เซอร์';
    } else {
      btn.innerHTML = '<i class="fa-solid fa-bell" style="color:white"></i>';
      btn.title = 'กดเพื่อรับการแจ้งเตือนเมื่อมีงานใหม่';
    }
  }

  // ตอน load: อัป icon ตาม permission ปัจจุบัน + ถ้าเคย allow แล้ว ลงทะเบียน token ทันที
  window.addEventListener('load', async function () {
    if (!('Notification' in window)) return;
    updateBtn(Notification.permission);
    if (Notification.permission === 'granted') {
      await ensureInit();
      await registerToken();
    }
  });
})();
