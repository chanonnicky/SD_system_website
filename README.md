# ระบบงานโสตทัศนูปกรณ์ โรงเรียน

ระบบแจ้งซ่อมอุปกรณ์และจองห้องประชุมสำหรับงานโสตทัศนูปกรณ์ของโรงเรียน พัฒนาด้วย HTML + Tailwind CSS โดยใช้ Google Apps Script เป็น Backend และ Google Sheets เป็นฐานข้อมูล

---

## ฟีเจอร์หลัก

| ฟีเจอร์ | รายละเอียด |
|---------|-----------|
| **แจ้งซ่อมอุปกรณ์** | กรอกฟอร์ม → ส่ง GAS → บันทึก Sheets + แจ้งเตือน LINE |
| **จองห้องประชุม** | เลือกห้อง / วันเวลา → ตรวจ conflict → บันทึก Sheets + แจ้งเตือน LINE |
| **ติดตามสถานะ** | ค้นหาด้วยเลขที่ Ticket หรือชื่อผู้แจ้ง |
| **ปฏิทินห้องประชุม** | ดูตารางการจองรายเดือน กรองตามห้อง |
| **Demo Mode** | ทดลองใช้งานได้ทันทีโดยไม่ต้องตั้งค่า |

---

## สถาปัตยกรรม

```
Browser
  ├── POST (แจ้งซ่อม / จองห้อง) ──→ Google Apps Script Web App
  │                                       ├── บันทึก Google Sheets
  │                                       └── ส่ง LINE Notification
  │
  └── GET (ติดตามสถานะ / ปฏิทิน) ──→ Google Sheets API v4
                                          └── อ่านข้อมูลตรงจาก Spreadsheet
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
4. **ตั้งค่า LINE Messaging API** — สร้าง Channel และคัดลอก Channel access token
5. **กรอก config** — คัดลอก `config.example.js` → `config.js` แล้วใส่ค่าทั้งหมด
6. **Deploy เว็บ** — GitHub Pages, Netlify, หรือ Web Server ของโรงเรียน

---

## ห้องประชุมเริ่มต้น

| ห้อง | ความจุ | ชั้น | อุปกรณ์ |
|------|--------|------|---------|
| ห้องประชุม A | 20 คน | ชั้น 2 | Projector, Mic, TV |
| ห้องประชุม B | 10 คน | ชั้น 3 | Smart TV, Speaker |
| ห้องประชุม C (ใหญ่) | 50 คน | ชั้น 1 | Projector×2, Mic×4, Camera |
| ห้องอบรม | 30 คน | ชั้น 4 | Projector, Zoom, Rec |

แก้ไขหรือเพิ่มห้องได้ที่ `rooms.js`

---

## Tech Stack

- **Frontend**: HTML5, [Tailwind CSS](https://tailwindcss.com), Font Awesome, Google Fonts (Sarabun)
- **Backend**: Google Apps Script (Web App)
- **Database**: Google Sheets
- **Notification**: LINE Messaging API
- **Data Read**: Google Sheets API v4

---

## ความปลอดภัย

- `assets/js/config.js` อยู่ใน `.gitignore` — ไม่ถูก commit ขึ้น Git
- ใช้ `config.example.js` เป็น template สำหรับผู้ติดตั้งใหม่
- API Key ของ Google ควร restrict ให้ใช้ได้เฉพาะ Google Sheets API
