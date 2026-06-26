// ============================================================
// CONFIG EXAMPLE — template สำหรับ commit ขึ้น Git
// คัดลอกไฟล์นี้ → ตั้งชื่อว่า config.js → ใส่ค่าจริง
// ============================================================
window.APP_CONFIG = {

  // 1. Google Apps Script Web App URL (legacy — for image uploads only)
  GAS_URL: '',

  // 1b. Cloudflare Worker URL (HTTPS proxy to JSP backend on MySQL)
  //     Used by admin.html for all admin operations + index.html for data fetch
  //     Deploy via: cd worker && npx wrangler@4 deploy
  WORKER_URL: 'https://sd-system-proxy.chanon-b.workers.dev',

  // 2. Google Spreadsheet ID
  SPREADSHEET_ID: '',

  // 3. Google Cloud API Key (Sheets API)
  GOOGLE_API_KEY: '',

  // 4. LINE Messaging API
  LINE_TOKEN: '',
  LINE_TO:    '',

  // 5. ชื่อ Sheet (ปกติไม่ต้องแก้)
  REPAIR_SHEET:  'แจ้งซ่อม',
  BOOKING_SHEET: 'จองห้องประชุม',

};
