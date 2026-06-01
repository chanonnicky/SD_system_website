# ระบบงานฝ่าย โรงเรียนเซนต์ดอมินิก

🌐 **[ระบบงานฝ่าย](https://chanonnicky.github.io/SD_system_website/)** · [Admin โสต](https://chanonnicky.github.io/SD_system_website/admin.html) · [Admin ธุรการ](https://chanonnicky.github.io/SD_system_website/admin-docs.html) · [Admin วัดประเมินผล](https://chanonnicky.github.io/SD_system_website/admin-assess.html)

ระบบสารสนเทศภายในโรงเรียนเซนต์ดอมินิก เป็น SPA ประกอบด้วย Portal เลือกฝ่าย, ระบบงานฝ่ายโสตทัศนูปกรณ์ (แจ้งซ่อม, จองห้อง, ปฏิทิน), หน้าสถานะตรวจข้อสอบฝ่ายวัดประเมินผล, และคลังเอกสารฝ่ายธุรการ พัฒนาด้วย HTML + Tailwind CSS ใช้ Google Apps Script เป็น Backend และ Google Sheets เป็นฐานข้อมูล รองรับ PWA และแจ้งเตือนผ่าน LINE + FCM Push Notification

---

## ฟีเจอร์หลัก

| ฟีเจอร์ | รายละเอียด |
|---------|-----------|
| **Portal Hub** | หน้าแรกเลือกฝ่าย (โสต / ธุรการ / วัดประเมินผล) พร้อม design system |
| **แจ้งซ่อมอุปกรณ์** | กรอกฟอร์ม → ส่ง GAS → บันทึก Sheets + แจ้งเตือน LINE + FCM Push |
| **จองห้องประชุม** | เลือกห้อง / วันเวลา → ตรวจ conflict → บันทึก Sheets + แจ้งเตือน LINE + FCM Push |
| **ติดตามสถานะ** | ค้นหาด้วยเลขที่ Ticket หรือชื่อผู้แจ้ง |
| **ปฏิทินห้องประชุม** | ดูตารางการจองรายเดือน กรองตามห้อง พร้อม "กำลังจะถึง" |
| **สถานะตรวจข้อสอบ** | ฝ่ายวัดประเมินผล: ดูความคืบหน้าการตรวจข้อสอบแต่ละวิชา (view-only) |
| **คลังเอกสาร** | ฝ่ายธุรการ: ดูสถานะเอกสาร (view-only) |
| **Admin ฝ่ายโสต** | Login จำสถานะ 30 วัน, ดูงานค้าง/งานทั้งหมด, อัปเดตสถานะ, จัดการผู้ดูแล |
| **Admin ฝ่ายวัดประเมินผล** | Login แยก, แก้ไขสถานะตรวจข้อสอบ, sync ผ่าน localStorage |
| **Admin ฝ่ายธุรการ** | Login แยก, CRUD เอกสาร, sync ผ่าน localStorage |
| **Push Notification** | แจ้งเตือนมือถือ/เบราว์เซอร์ผ่าน Firebase Cloud Messaging (เฉพาะ Admin ฝ่ายโสต) |
| **กด Notification → เปิด Job** | แตะแจ้งเตือน → เปิดหน้า Admin ตรง modal ของงานนั้นเลย |
| **PWA** | ติดตั้งเป็น App บนมือถือได้ (Add to Home Screen) |
| **LINE Bot Commands** | พิมพ์คำสั่งใน LINE OA เพื่อดูข้อมูลและ quota |

---

## สถาปัตยกรรม

```
ระบบงานฝ่าย.html (Portal)
  └── เลือกฝ่าย ──→ index.html (โสต) / mockup (ธุรการ, วัดประเมินผล)

Browser / PWA (index.html + admin.html)
  ├── POST (แจ้งซ่อม / จองห้อง) ──→ Google Apps Script Web App
  │                                       ├── บันทึก Google Sheets
  │                                       ├── ส่ง LINE Notification (Broadcast)
  │                                       └── ส่ง FCM Push ทุก Admin ที่ลงทะเบียน
  │
  ├── GET (ติดตามสถานะ / ปฏิทิน) ──→ Google Sheets API v4
  │
  ├── POST (Admin login / จัดการข้อมูล) → Google Apps Script Web App
  │
  └── POST (registerFCMToken) ──────────→ GAS → บันทึก token ลง sheet FCMTokens

LINE Chat (Bot Commands)
  └── Webhook ──→ Google Apps Script Web App (Reply API — ฟรี ไม่นับ quota)

เมื่อสถานะเปลี่ยนเป็น "เสร็จสิ้น"
  └── GAS ──→ FCM HTTP v1 API ──→ Push Notification ทุก Admin ที่ลงทะเบียนไว้
```

---

## โครงสร้างไฟล์

```
SD_system_website/
├── index.html                  ← SPA หลัก: Portal + ฝ่ายโสต + ฝ่ายธุรการ + ฝ่ายวัดประเมินผล
├── admin.html                  ← Admin Panel ฝ่ายโสต (login, งานค้าง, จัดการ admin, คู่มือ)
├── admin-docs.html             ← Admin Panel ฝ่ายธุรการ (login, CRUD เอกสาร)
├── admin-assess.html           ← Admin Panel ฝ่ายวัดประเมินผล (login, แก้สถานะตรวจข้อสอบ)
├── ระบบงานฝ่าย.html            ← redirect ไป index.html
├── manifest.json               ← PWA Manifest
├── sw.js                       ← Service Worker (รับ Push Notification เบื้องหลัง)
├── rooms.js                    ← กำหนดห้องประชุม (แก้ไขเพื่อเพิ่ม/ลดห้อง)
├── picture/
│   ├── school_logo.webp        ← โลโก้โรงเรียน (แสดงใน top nav)
│   └── app_logo.webp           ← โลโก้แอป (แสดงใน admin.html)
├── assets/
│   └── js/
│       ├── app.js              ← JavaScript หลัก (index.html)
│       ├── notifications.js    ← FCM permission + token registration
│       ├── config.js           ← Token/Key จริง (ไม่ถูก commit — auto-gen ใน CI)
│       └── config.example.js  ← Template สำหรับ config.js
└── gas/
    └── Code.gs                 ← Google Apps Script backend ทั้งหมด
```

---

## Google Sheets Layout

### ชีทแจ้งซ่อม (A:J)
`A=เลขที่ | B=วันที่แจ้ง | C=ชื่อผู้แจ้ง | D=เบอร์โทร | E=อุปกรณ์ | F=สถานที่ | G=อาการ | H=รูปภาพ | I=สถานะ | J=ผู้อัปเดตล่าสุด`

### ชีทจองห้องประชุม (A:N)
`A=เลขที่ | B=วันที่จอง | C=ห้อง | D=วันที่ใช้ห้อง | E=เวลาเริ่ม | F=เวลาสิ้นสุด | G=ชื่อผู้จอง | H=เบอร์โทร | I=จำนวนผู้เข้าร่วม | J=วัตถุประสงค์ | K=อุปกรณ์ | L=หมายเหตุ | M=สถานะ | N=ผู้อัปเดตล่าสุด`

### ชีท FCMTokens (A:C)
`A=token | B=timestamp | C=userAgent`

### ชีท Admin User (A:F)
`A=username | B=(ว่าง) | C=ชื่อ | D=บทบาท | E=วันที่เพิ่ม | F=เบอร์มือถือ`

---

## Admin Panel

| แท็บ | รายละเอียด |
|------|-----------|
| **งานค้างอยู่** | งานสถานะ "มีงานใหม่" และ "กำลังดำเนินงาน" — sort/filter ได้ |
| **งานทั้งหมด** | ทุกสถานะรวมกัน — sort/filter ได้ |
| **จัดการ Admin** | เพิ่ม/แก้ไข/ลบผู้ดูแล (ชื่อ, username, บทบาท, เบอร์) |
| **คู่มือ** | วิธีติดตั้ง PWA, เปิดรับแจ้งเตือน, ตรวจสอบระบบ, ทดสอบ notification |

**การแจ้งเตือน:**
- กดปุ่ม 🔔 ในหน้า Admin → อนุญาตการแจ้งเตือน → ลงทะเบียน FCM token
- ระบบส่ง push notification ทุกครั้งที่มีงานซ่อม/จองใหม่ และเมื่อสถานะเป็น "เสร็จสิ้น"
- กดแจ้งเตือน → เปิดหน้า Admin ตรง modal ของงานนั้น

**การ login:**
- ใช้ localStorage จำ session 30 วัน — ไม่ต้อง login ทุกครั้งที่เปิดแอป

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
| `CLIENT_SECRET` | Secret สำหรับ validate request (ต้องตรงกับ GitHub Secret) |
| `WEBHOOK_SECRET` | Secret สำหรับ validate URL ปุ่มใน LINE card |

### 6. GitHub Secrets
ตั้งใน Repository Settings → Secrets and variables → Actions:

| Secret | Value |
|--------|-------|
| `GAS_URL` | Web App URL จาก GAS Deploy |
| `SPREADSHEET_ID` | ID ของ Google Spreadsheet |
| `GOOGLE_API_KEY` | Google Sheets API Key |
| `CLIENT_SECRET` | ต้องตรงกับ GAS Script Property `CLIENT_SECRET` |

### 7. เพิ่ม Admin คนแรก
เพิ่ม row ใน sheet "Admin User":
`username | (ว่าง) | ชื่อจริง | บทบาท | วันที่ | เบอร์`

### 8. Deploy

**Frontend (GitHub Pages):**
```bash
git push origin main   # GitHub Actions auto-generate config.js และ deploy อัตโนมัติ ~1-2 นาที
```

ดูสถานะ deploy ได้ที่: [GitHub Actions](https://github.com/chanonnicky/SD_system_website/actions)

**เว็บไซต์ที่ deploy แล้ว:**
- [ระบบงานฝ่าย](https://chanonnicky.github.io/SD_system_website/)
- [Admin ฝ่ายโสต](https://chanonnicky.github.io/SD_system_website/admin.html)
- [Admin ฝ่ายธุรการ](https://chanonnicky.github.io/SD_system_website/admin-docs.html)
- [Admin ฝ่ายวัดประเมินผล](https://chanonnicky.github.io/SD_system_website/admin-assess.html)

**Backend (GAS):** ต้อง deploy ด้วยมือทุกครั้งที่แก้ `gas/Code.gs`
> GAS Editor → Deploy → Manage Deployments → Edit → New Version → Deploy

---

## Tech Stack

- **Frontend**: HTML5, [Tailwind CSS](https://tailwindcss.com), Font Awesome, Google Fonts (Sarabun)
- **Backend**: Google Apps Script (Web App)
- **Database**: Google Sheets
- **Push Notification**: Firebase Cloud Messaging (FCM HTTP v1 API + Service Account JWT)
- **LINE Integration**: LINE Messaging API (Broadcast + Reply API)
- **Data Read**: Google Sheets API v4
- **PWA**: Web App Manifest + Service Worker
- **Hosting**: GitHub Pages (deploy via GitHub Actions)

---

## ความปลอดภัย

- `assets/js/config.js` อยู่ใน `.gitignore` — ไม่ถูก commit ขึ้น Git
- Secrets ฝั่ง GAS เก็บใน **Script Properties** (ไม่ hardcode ใน code)
- Firebase service account JSON ห้าม commit ขึ้น Git
- ทุก request จาก frontend ต้องส่ง `CLIENT_SECRET` — GAS ตรวจสอบก่อนประมวลผล
- XSS prevention: ทุก user-generated content ผ่าน `escHtml()` ก่อน render
