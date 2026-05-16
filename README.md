# ระบบงานโสตทัศนูปกรณ์ โรงเรียนเซนต์ดอมินิก

**Live:** https://chanonnicky.github.io/SD_AV_website/

ระบบแจ้งซ่อมอุปกรณ์และจองห้องประชุมสำหรับงานโสตทัศนูปกรณ์ พัฒนาด้วย HTML + Tailwind CSS โดยใช้ Google Apps Script เป็น Backend และ Google Sheets เป็นฐานข้อมูล

---

## ฟีเจอร์หลัก

| ฟีเจอร์ | รายละเอียด |
|---------|-----------|
| **แจ้งซ่อมอุปกรณ์** | กรอกฟอร์ม → ส่ง GAS → บันทึก Sheets + แจ้งเตือน LINE |
| **จองห้องประชุม** | เลือกห้อง / วันเวลา → ตรวจ conflict → บันทึก Sheets + แจ้งเตือน LINE |
| **ติดตามสถานะ** | ค้นหาด้วยเลขที่ Ticket หรือชื่อผู้แจ้ง |
| **ปฏิทินห้องประชุม** | ดูตารางการจองรายเดือน กรองตามห้อง |
| **อัปเดตสถานะผ่าน LINE** | กดปุ่มใน LINE card → อัปเดต Sheets + แจ้งเตือนกลับ |

---

## สถาปัตยกรรม

```
Browser
  ├── POST (แจ้งซ่อม / จองห้อง) ──→ Google Apps Script Web App
  │                                       ├── บันทึก Google Sheets
  │                                       └── ส่ง LINE Notification (multicast)
  │
  ├── GET (ติดตามสถานะ / ปฏิทิน) ──→ Google Sheets API v4
  │                                       └── อ่านข้อมูลตรงจาก Spreadsheet
  │
LINE Card Buttons (via LIFF)
  └── GET ?action=updateStatus ──→ Google Apps Script Web App
                                      ├── อัปเดต Google Sheets
                                      └── ส่ง LINE Status Card (multicast)
```

---

## โครงสร้างไฟล์

```
SD_AV_website/
├── index.html                  ← หน้าเว็บหลัก
├── rooms.js                    ← กำหนดห้องประชุม (แก้ไขเพื่อเพิ่ม/ลดห้อง)
├── .gitignore
├── assets/
│   ├── css/style.css           ← Custom styles
│   └── js/
│       ├── app.js              ← JavaScript หลัก
│       ├── config.js           ← ใส่ Token/Key จริง (ไม่ถูก commit)
│       └── config.example.js  ← Template สำหรับ config
└── gas/
    └── Code.gs                 ← Google Apps Script (รับ POST + ส่ง LINE)
```

---

## วิธีติดตั้ง

ดูรายละเอียดขั้นตอนการติดตั้งทั้งหมดได้ที่ [SETUP.md](SETUP.md)

### ขั้นตอนสั้น ๆ

1. **สร้าง Google Spreadsheet** — แชร์เป็น "Anyone with the link can view"
2. **สร้าง Google Cloud API Key** — จำกัดสิทธิ์เฉพาะ Google Sheets API
3. **ตั้งค่า Google Apps Script** — วางโค้ดจาก `gas/Code.gs` แล้ว Deploy เป็น Web App
4. **ตั้งค่า Script Properties** — ใส่ค่า `LINE_TOKEN`, `SPREADSHEET_ID`, `NOTIFY_USER_IDS` ฯลฯ
5. **ตั้งค่า LINE Messaging API** — สร้าง Channel, ตั้ง Webhook URL = GAS URL, ตั้ง LIFF endpoint
6. **หา LINE userId** — ส่ง `/myid` ใน LINE OA แล้วนำค่ามาใส่ `NOTIFY_USER_IDS`
7. **กรอก GitHub Secrets** — `GAS_URL`, `SPREADSHEET_ID`, `GOOGLE_API_KEY`, `CLIENT_SECRET`
8. **Deploy เว็บ** — Push to `main` → GitHub Actions deploy อัตโนมัติ

---

## ห้องประชุม

| ห้อง | หมายเหตุ |
|------|---------|
| หอประชุมซาวีโอ | ห้องประชุมใหญ่ |
| ห้องประชุมอัลเบรา | ห้องประชุมขนาดกลาง |
| ห้องประชุมรีกัลโดเน | ห้องประชุมขนาดกลาง |
| Auditorium | ห้องโสต |

แก้ไขหรือเพิ่มห้องได้ที่ `rooms.js` และ `gas/Code.gs` → `allowedRooms`

---

## Tech Stack

- **Frontend**: HTML5, [Tailwind CSS](https://tailwindcss.com), Font Awesome, Google Fonts (Sarabun)
- **Backend**: Google Apps Script (Web App)
- **Database**: Google Sheets
- **Notification**: LINE Messaging API (multicast)
- **Data Read**: Google Sheets API v4
- **Hosting**: GitHub Pages (deploy via GitHub Actions)

---

## ความปลอดภัย

- `assets/js/config.js` อยู่ใน `.gitignore` — ไม่ถูก commit ขึ้น Git
- Secrets ฝั่ง GAS เก็บใน **Script Properties** (ไม่ hardcode ใน code)
- Secrets ฝั่ง Frontend เก็บใน **GitHub Secrets** → inject ตอน deploy
- `WEBHOOK_SECRET` ป้องกัน URL ปุ่ม LINE ถูกเรียกโดยไม่ได้รับอนุญาต
- `CLIENT_SECRET` ป้องกัน POST endpoint ถูกเรียกจากภายนอก
- XSS prevention: `escHtml()` ทุก user-generated content ใน HTML
