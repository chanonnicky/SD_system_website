# วิธีติดตั้งระบบ งานโสตทัศนูปกรณ์ โรงเรียน

## สถาปัตยกรรมระบบ

```
เบราว์เซอร์
  ├── POST (แจ้งซ่อม / จองห้อง) ──→ Google Apps Script Web App
  │                                        └── บันทึก Google Sheets
  │                                        └── ส่ง LINE Notification
  │
  └── GET (ติดตามสถานะ / ปฏิทิน) ──→ Google Sheets API v4 (API Key)
                                           └── อ่านตรงจาก Spreadsheet
```

---

## ขั้นตอนที่ 1 — สร้าง Google Spreadsheet

1. ไปที่ [sheets.google.com](https://sheets.google.com) > สร้าง Spreadsheet ใหม่
2. ตั้งชื่อ เช่น `งานโสตทัศนูปกรณ์`
3. คัดลอก **Spreadsheet ID** จาก URL:
   ```
   docs.google.com/spreadsheets/d/<<SPREADSHEET_ID>>/edit
   ```
4. ตั้งค่าการแชร์ > **"Anyone with the link"** > **Viewer**
   (จำเป็นสำหรับให้ API Key อ่านข้อมูลได้)

---

## ขั้นตอนที่ 2 — สร้าง Google Cloud API Key

1. ไปที่ [console.cloud.google.com](https://console.cloud.google.com)
2. สร้างโปรเจกต์ใหม่ หรือเลือกโปรเจกต์ที่มีอยู่
3. **APIs & Services** > **Enable APIs** > ค้นหา `Google Sheets API` > **Enable**
4. **APIs & Services** > **Credentials** > **Create Credentials** > **API Key**
5. คัดลอก **API Key** ที่ได้
6. (แนะนำ) **Edit Key** > **Restrict** > จำกัดให้ใช้ได้เฉพาะ `Google Sheets API`

---

## ขั้นตอนที่ 3 — ตั้งค่า Google Apps Script

1. ไปที่ [script.google.com](https://script.google.com) > **New Project**
2. ลบโค้ดเดิม แล้ววางโค้ดจากไฟล์ `gas/Code.gs`
3. บันทึก (Ctrl+S)
4. รัน function **`setupSpreadsheet`** ครั้งเดียวเพื่อสร้าง Sheet อัตโนมัติ
5. **Deploy** > **New Deployment**
   - Type: **Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. คลิก **Deploy** > คัดลอก **Web App URL** ที่ได้

> หมายเหตุ: ยังไม่ต้องกรอกค่าใน `CONFIG` ตอนนี้ — ทำในขั้นตอนที่ 5

---

## ขั้นตอนที่ 4 — ตั้งค่า LINE Messaging API

1. ไปที่ [developers.line.biz](https://developers.line.biz)
2. สร้าง Provider และ Channel ประเภท **Messaging API**
3. **Messaging API** tab > **Issue** > คัดลอก **Channel access token**
4. เพิ่ม Bot เป็นเพื่อน หรือเพิ่มเข้า Group ที่ต้องการรับแจ้งเตือน
5. คัดลอก **User ID** หรือ **Group ID** ที่ต้องการส่งแจ้งเตือน
   (ดูได้จาก Webhook event หรือ LINE Developers Console)

---

## ขั้นตอนที่ 5 — ใส่ค่า Config ทั้งหมด

ขั้นตอนนี้ทำ **2 ไฟล์** เพราะ GAS ทำงานบน server ของ Google จึงอ่าน `config.js` ไม่ได้โดยตรง

### 5.1 — เปิด `assets/js/config.js` กรอกทุกค่า

```js
const APP_CONFIG = {
  GAS_URL:        '...',  // Web App URL จากขั้นตอนที่ 3
  SPREADSHEET_ID: '...',  // Spreadsheet ID จากขั้นตอนที่ 1
  GOOGLE_API_KEY: '...',  // API Key จากขั้นตอนที่ 2
  LINE_TOKEN:     '...',  // Channel access token จากขั้นตอนที่ 4
  LINE_TO:        '...',  // User ID / Group ID จากขั้นตอนที่ 4
  REPAIR_SHEET:   'แจ้งซ่อม',       // ไม่ต้องแก้
  BOOKING_SHEET:  'จองห้องประชุม',  // ไม่ต้องแก้
};
```

> ⚠️ ไฟล์ `config.js` อยู่ใน `.gitignore` แล้ว — ไม่ถูก commit ขึ้น Git

### 5.2 — เปิด `gas/Code.gs` คัดลอกค่าจาก config.js มาใส่

```js
const CONFIG = {
  SPREADSHEET_ID: '...',  // ← วางค่าเดียวกับ APP_CONFIG.SPREADSHEET_ID
  LINE_TOKEN:     '...',  // ← วางค่าเดียวกับ APP_CONFIG.LINE_TOKEN
  LINE_TO:        '...',  // ← วางค่าเดียวกับ APP_CONFIG.LINE_TO
  REPAIR_SHEET:   'แจ้งซ่อม',
  BOOKING_SHEET:  'จองห้องประชุม',
};
```

บันทึกแล้ว **Deploy ใหม่อีกครั้ง** (New Deployment หรือ Deploy existing)

---

## ขั้นตอนที่ 6 — Deploy เว็บไซต์

- **GitHub Pages**: Push โค้ดขึ้น GitHub > Settings > Pages > Deploy from main branch
- **Netlify**: ลาก folder ไปวางที่ [netlify.com/drop](https://netlify.com/drop)
- **เซิร์ฟเวอร์ภายใน**: วางไฟล์ใน web server ของโรงเรียน

---

## โครงสร้างไฟล์

```
AV_Web/
├── index.html                    ← หน้าเว็บหลัก
├── .gitignore                    ← กัน config.js ไม่ให้ขึ้น Git
├── assets/
│   ├── css/style.css             ← สไตล์ชีต
│   └── js/
│       ├── config.js             ← ⚙️ ใส่ Token จริง (ไม่ commit)
│       ├── config.example.js     ← 📄 Template ว่าง (commit ได้)
│       └── app.js                ← JavaScript หลัก
└── gas/
    └── Code.gs                   ← Google Apps Script (รับ POST + ส่ง LINE)
```

---

## ฟีเจอร์และการทำงาน

| ฟีเจอร์ | วิธีทำงาน |
|---------|-----------|
| แจ้งซ่อมอุปกรณ์ | POST → GAS → บันทึก Sheets + ส่ง LINE |
| จองห้องประชุม | POST → GAS → ตรวจ conflict → บันทึก Sheets + ส่ง LINE |
| ติดตามสถานะ | GET → Sheets API v4 (API Key) → อ่านตรง |
| ปฏิทินห้องประชุม | GET → Sheets API v4 (API Key) → อ่านตรง |
| Demo Mode | ทำงานได้โดยไม่ต้องตั้งค่า (ข้อมูลไม่บันทึกจริง) |
