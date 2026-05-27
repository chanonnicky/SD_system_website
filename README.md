# ระบบงานโสตทัศนูปกรณ์ โรงเรียนเซนต์ดอมินิก

**Live:** https://chanonnicky.github.io/SD_AV_website/

ระบบแจ้งซ่อมอุปกรณ์และจองห้องประชุมสำหรับงานโสตทัศนูปกรณ์ พัฒนาด้วย HTML + Tailwind CSS โดยใช้ Google Apps Script เป็น Backend และ Google Sheets เป็นฐานข้อมูล รองรับการติดตั้งเป็น PWA บนมือถือและแจ้งเตือนผ่าน Push Notification

---

## ฟีเจอร์หลัก

| ฟีเจอร์ | รายละเอียด |
|---------|-----------|
| **แจ้งซ่อมอุปกรณ์** | กรอกฟอร์ม → ส่ง GAS → บันทึก Sheets + แจ้งเตือน LINE Bot |
| **จองห้องประชุม** | เลือกห้อง / วันเวลา → ตรวจ conflict → บันทึก Sheets + แจ้งเตือน LINE Bot |
| **ติดตามสถานะ** | ค้นหาด้วยเลขที่ Ticket หรือชื่อผู้แจ้ง |
| **ปฏิทินห้องประชุม** | ดูตารางการจองรายเดือน กรองตามห้อง |
| **Admin Panel** | Login → ดูงานค้างอยู่ อัปเดตสถานะ จัดการผู้ดูแลระบบ |
| **Push Notification** | แจ้งเตือนบนเบราว์เซอร์/มือถือผ่าน Firebase Cloud Messaging (เฉพาะ Admin) |
| **PWA** | ติดตั้งเป็น App บนมือถือได้ (Add to Home Screen) |
| **LINE Bot Commands** | พิมพ์คำสั่งใน LINE OA เพื่อดูข้อมูลและ quota |

---

## สถาปัตยกรรม

```
Browser / PWA
  ├── POST (แจ้งซ่อม / จองห้อง) ──→ Google Apps Script Web App
  │                                       ├── บันทึก Google Sheets
  │                                       └── ส่ง LINE Notification (Reply API)
  │
  ├── GET (ติดตามสถานะ / ปฏิทิน) ──→ Google Sheets API v4
  │                                       └── อ่านข้อมูลตรงจาก Spreadsheet
  │
  ├── POST (Admin login / จัดการข้อมูล) → Google Apps Script Web App
  │                                       └── อ่าน/เขียน Google Sheets
  │
  └── POST (registerFCMToken) ──────────→ Google Apps Script Web App
                                          └── บันทึก token ลง sheet FCMTokens

LINE Chat (Bot Commands)
  └── Webhook ──→ Google Apps Script Web App (Reply API — ฟรี ไม่นับ quota)

เมื่อสถานะเปลี่ยนเป็น "เสร็จสิ้น"
  └── GAS ──→ FCM HTTP v1 API ──→ Push Notification ทุก Admin ที่ลงทะเบียนไว้
```

---

## โครงสร้างไฟล์

```
SD_AV_website/
├── index.html                  ← หน้าเว็บหลัก (แจ้งซ่อม / จอง / ติดตาม / ปฏิทิน)
├── admin.html                  ← Admin Panel (login, งานค้าง, จัดการ admin)
├── manifest.json               ← PWA Manifest (ติดตั้งเป็น App บนมือถือ)
├── sw.js                       ← Service Worker (รับ Push Notification เบื้องหลัง)
├── rooms.js                    ← กำหนดห้องประชุม (แก้ไขเพื่อเพิ่ม/ลดห้อง)
├── .gitignore
├── assets/
│   ├── css/style.css           ← Custom styles
│   ├── img/school_logo.webp    ← โลโก้โรงเรียน
│   └── js/
│       ├── app.js              ← JavaScript หลัก (index.html)
│       ├── config.js           ← ใส่ Token/Key จริง (ไม่ถูก commit)
│       └── config.example.js  ← Template สำหรับ config.js
└── gas/
    └── Code.gs                 ← Google Apps Script backend ทั้งหมด
```

---

## Google Sheets Layout

### ชีทแจ้งซ่อม (A:I)
`A=เลขที่ | B=วันที่แจ้ง | C=ชื่อผู้แจ้ง | D=เบอร์โทร | E=อุปกรณ์ | F=สถานที่ | G=อาการ | H=รูปภาพ | I=สถานะ`

### ชีทจองห้องประชุม (A:M)
`A=เลขที่ | B=วันที่จอง | C=ห้อง | D=วันที่ใช้ห้อง | E=เวลาเริ่ม | F=เวลาสิ้นสุด | G=ชื่อผู้จอง | H=เบอร์โทร | I=จำนวนผู้เข้าร่วม | J=วัตถุประสงค์ | K=อุปกรณ์ | L=หมายเหตุ | M=สถานะ`

### ชีท FCMTokens (A:C)
`A=token | B=userAgent | C=วันที่ลงทะเบียน`

### ชีท Admin User (A:E)
`A=username | B=(ว่าง) | C=ชื่อ | D=บทบาท | E=วันที่เพิ่ม`

---

## LINE Bot Commands

| Command | ผลลัพธ์ |
|---------|---------|
| `/งาน` หรือ `งาน` | งานซ่อม + จองที่ค้างอยู่ทั้งหมด |
| `/ซ่อม` หรือ `ซ่อม` | งานซ่อมที่ยังไม่เสร็จ |
| `/จอง` หรือ `จอง` | งานจองที่ยังไม่เสร็จ |
| `/quota` หรือ `quota` | ตรวจสอบ broadcast quota ที่เหลือ |
| `/sheet` หรือ `sheet` | Link Google Sheets แต่ละชีท |
| `/myid` | ดู LINE userId ของตัวเอง |
| `/ช่วย` หรือ `/help` | แสดงคำสั่งทั้งหมด |

> Reply API ฟรี ไม่นับ quota ใช้ได้ไม่จำกัด

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

## วิธีติดตั้ง

### 1. Google Spreadsheet
- สร้าง Spreadsheet ใหม่ แชร์เป็น "Anyone with the link can view"
- สร้าง sheet ตามที่กำหนดใน [Google Sheets Layout](#google-sheets-layout)

### 2. Google Cloud
- สร้าง API Key → จำกัดสิทธิ์เฉพาะ **Google Sheets API v4**

### 3. Firebase
- สร้าง Firebase project → เปิดใช้ **Cloud Messaging**
- สร้าง Service Account → ดาวน์โหลด JSON key
- คัดลอก `private_key` และ `client_email` จาก JSON key

### 4. LINE Messaging API
- สร้าง LINE OA + Messaging API Channel
- ตั้ง Webhook URL = GAS URL
- คัดลอก Channel Access Token

### 5. Google Apps Script
- วางโค้ดจาก `gas/Code.gs` ใน GAS Editor
- Deploy เป็น Web App (Execute as: Me, Access: Anyone)
- ตั้ง **Script Properties**:

| Key | Value |
|-----|-------|
| `LINE_TOKEN` | Channel Access Token จาก LINE Developers |
| `SPREADSHEET_ID` | ID ของ Google Spreadsheet |
| `FCM_PRIVATE_KEY` | `private_key` จาก Firebase service account JSON |
| `FCM_CLIENT_EMAIL` | `client_email` จาก Firebase service account JSON |
| `CLIENT_SECRET` | Secret สำหรับ validate request (กำหนดเองได้) |
| `WEBHOOK_SECRET` | Secret สำหรับ validate URL ปุ่มใน LINE card |

### 6. Frontend Config
- Copy `assets/js/config.example.js` เป็น `assets/js/config.js`
- กรอกค่าทั้งหมดใน `config.js`

### 7. Deploy
```bash
git push origin main   # GitHub Actions deploy อัตโนมัติ ~1-2 นาที
```

---

## Tech Stack

- **Frontend**: HTML5, [Tailwind CSS](https://tailwindcss.com), Font Awesome, Google Fonts (Sarabun)
- **Backend**: Google Apps Script (Web App)
- **Database**: Google Sheets
- **Push Notification**: Firebase Cloud Messaging (FCM HTTP v1 API)
- **LINE Integration**: LINE Messaging API (Reply API — bot commands)
- **Data Read**: Google Sheets API v4
- **PWA**: Web App Manifest + Service Worker
- **Hosting**: GitHub Pages (deploy via GitHub Actions)

---

## ความปลอดภัย

- `assets/js/config.js` อยู่ใน `.gitignore` — ไม่ถูก commit ขึ้น Git
- Secrets ฝั่ง GAS เก็บใน **Script Properties** (ไม่ hardcode ใน code)
- Firebase service account JSON ห้าม commit ขึ้น Git
- Push Notification และ Admin Panel ใช้ได้เฉพาะผู้ที่ login แล้วเท่านั้น
- XSS prevention: ทุก user-generated content ผ่าน `escHtml()` ก่อน render
