# CLAUDE.md — SD AV Website (ฝ่ายโสตทัศนูปกรณ์ โรงเรียนเซนต์ดอมินิก)

## ภาพรวมโปรเจกต์
เว็บไซต์สำหรับฝ่าย AV ของโรงเรียนเซนต์ดอมินิก มีระบบแจ้งซ่อม จองห้องประชุม ติดตามสถานะ และแจ้งเตือนผ่าน LINE + FCM Push Notification

- **เว็บไซต์:** https://chanonnicky.github.io/SD_AV_website/
- **Admin Panel:** https://chanonnicky.github.io/SD_AV_website/admin.html
- **Repository:** https://github.com/chanonnicky/SD_AV_website
- **Hosting:** GitHub Pages (branch: main — auto deploy เมื่อ push)

## Tech Stack
- **Frontend:** Vanilla JS + Tailwind CSS (CDN) — ไม่มี build step
- **Backend:** Google Apps Script (GAS) — รับ POST บันทึก Sheets + ส่ง LINE + FCM
- **Database:** Google Sheets
- **Notification:** LINE Messaging API (Broadcast) + Firebase Cloud Messaging (FCM)
- **Deploy Frontend:** `git push origin main` → GitHub Pages auto deploy

## โครงสร้างไฟล์สำคัญ
```
index.html              — หน้าเว็บหลัก (Single Page App)
admin.html              — Admin Panel (login, งาน, จัดการ admin, คู่มือ)
manifest.json           — PWA Manifest
sw.js                   — Service Worker (FCM background push + notification click)
rooms.js                — ข้อมูลห้องประชุม
assets/
  js/
    app.js              — logic ทั้งหมด (form, calendar, status tracking)
    config.js           — GAS_URL, SPREADSHEET_ID, API_KEY, FIREBASE config (ไม่ commit)
    config.example.js   — template สำหรับ config.js
  css/style.css         — custom styles
  img/
    school_logo.webp    — โลโก้โรงเรียน (หน้าหลัก + notification icon)
    app_logo.webp       — โลโก้แอป (หน้า Admin เท่านั้น)
gas/
  Code.gs               — Google Apps Script backend (copy ไป GAS Editor ด้วยมือ)
```

## Key Configurations

### GAS Script Properties (ตั้งใน GAS Editor → Project Settings)
| Key | คำอธิบาย |
|-----|---------|
| `LINE_TOKEN` | Channel Access Token จาก LINE Developers Console |
| `SPREADSHEET_ID` | `1rHGjwT6ZBf0qryjXahaw1RUve3ozvbIB89u3gSYzhbU` |
| `CLIENT_SECRET` | Secret สำหรับ validate request — **ต้องตรงกับ GitHub Secret** |
| `WEBHOOK_SECRET` | Secret สำหรับ validate URL ปุ่มใน LINE card |
| `FCM_PRIVATE_KEY` | private_key จาก Firebase service account JSON |
| `FCM_CLIENT_EMAIL` | `firebase-adminsdk-fbsvc@sd-av-website.iam.gserviceaccount.com` |

### GitHub Secrets (Settings → Secrets and variables → Actions)
| Key | คำอธิบาย |
|-----|---------|
| `GAS_URL` | Web App URL จาก GAS Deploy |
| `SPREADSHEET_ID` | ID ของ Google Spreadsheet |
| `GOOGLE_API_KEY` | Google Sheets API Key |
| `CLIENT_SECRET` | ต้องตรงกับ GAS Script Property `CLIENT_SECRET` |

### URLs สำคัญ
- **GAS URL:** `https://script.google.com/macros/s/AKfycby1JFOuyNQcF0GlYoxT1cByof5_h1jQVqCwdAxS9tEylqTKPz5bzfY7pLUdgggq-QGc/exec`
- **LIFF/Mini App ID:** `2010102800-8WvwvjA4` (hardcode ใน `Code.gs` → `CONFIG.MINI_APP_ID`)
- **Spreadsheet:** `https://docs.google.com/spreadsheets/d/1rHGjwT6ZBf0qryjXahaw1RUve3ozvbIB89u3gSYzhbU/edit`
- **Firebase Project:** `sd-av-website`

## LINE Bot Commands (Reply API — ฟรี ไม่นับ quota)
| Command | ผลลัพธ์ |
|---------|---------|
| `/งาน` หรือ `งาน` | แสดงงานซ่อม + จองที่ค้างอยู่ทั้งหมด |
| `/ซ่อม` หรือ `ซ่อม` | งานซ่อมที่ค้างอยู่ (รับเรื่อง/กำลังดำเนินการ) |
| `/จอง` หรือ `จอง` | งานจองที่ค้างอยู่ |
| `/quota` หรือ `quota` | ตรวจสอบ broadcast quota + จำนวนครั้งที่ส่งได้ |
| `/sheet` หรือ `sheet` | Link Google Sheets แยกแต่ละชีท |
| `/myid` | ดู LINE userId ของตัวเอง |
| `/ช่วย` หรือ `/help` | แสดงคำสั่งทั้งหมด |

## LINE + FCM Notification Logic
| เหตุการณ์ | LINE Broadcast | FCM Push |
|-----------|---------------|----------|
| มีงานซ่อมใหม่ | ส่ง | ส่ง (พร้อม ticket URL) |
| มีงานจองใหม่ | ส่ง | ส่ง (พร้อม ticket URL) |
| อัปเดตสถานะ → เสร็จสิ้น | ส่ง | ส่ง (พร้อม ticket URL) |
| อัปเดตสถานะ → กำลังดำเนินการ | ไม่ส่ง | ไม่ส่ง |
| อัปเดตสถานะ → ยกเลิก | ไม่ส่ง | ไม่ส่ง |

- **FCM Push** ส่งผ่าน Service Account JWT → FCM HTTP v1 API
- **กด notification** → เปิด `admin.html?ticket=XXX` → modal ของงานนั้นเปิดอัตโนมัติ
- **Quota:** Free Plan LINE = 200 msg/เดือน — reset วันที่ 1 ของทุกเดือน

## Google Sheets Layout
### ชีทแจ้งซ่อม (A:J)
`A=เลขที่ | B=วันที่แจ้ง | C=ชื่อผู้แจ้ง | D=เบอร์โทร | E=อุปกรณ์ | F=สถานที่ | G=อาการ | H=รูปภาพ | I=สถานะ | J=ผู้อัปเดตล่าสุด`

### ชีทจองห้องประชุม (A:N)
`A=เลขที่ | B=วันที่จอง | C=ห้อง | D=วันที่ใช้ห้อง | E=เวลาเริ่ม | F=เวลาสิ้นสุด | G=ชื่อผู้จอง | H=เบอร์โทร | I=จำนวนผู้เข้าร่วม | J=วัตถุประสงค์ | K=อุปกรณ์ | L=หมายเหตุ | M=สถานะ | N=ผู้อัปเดตล่าสุด`

### ชีท FCMTokens (A:C)
`A=token | B=timestamp | C=userAgent`

### ชีท Admin User (A:F)
`A=username | B=(ว่าง) | C=ชื่อ | D=บทบาท | E=วันที่เพิ่ม | F=เบอร์มือถือ`

### Ticket Format
- แจ้งซ่อม: `REP-YYYY-NNN`
- จองห้อง: `BK-YYYY-NNN`

## สถานะและการแสดงผล
| สถานะ (เก็บใน Sheets) | แสดงผล (Label) | ปฏิทิน | LINE/FCM |
|----------------------|---------------|--------|----------|
| รับเรื่อง | มีงานใหม่ | แถบสีเทา | ไม่ส่ง |
| กำลังดำเนินการ | กำลังดำเนินงาน | สีห้องปกติ | ไม่ส่ง |
| เสร็จสิ้น | เสร็จสิ้น | สีห้องปกติ | ส่ง |
| ยกเลิก | ยกเลิก | ไม่แสดง | ไม่ส่ง |

## Admin Panel — ฟีเจอร์
- **Login:** localStorage + expiry 30 วัน (ไม่ต้อง login ทุกครั้งที่เปิดแอป)
- **แท็บงานค้างอยู่:** sort (ใหม่/เก่า) + filter สถานะ
- **แท็บงานทั้งหมด:** ทุกสถานะ, sort + filter
- **Card คลิกได้** → เปิด modal รายละเอียดงาน (รูปภาพ, updatedBy, ปุ่มเปลี่ยนสถานะ)
- **จัดการ Admin:** เพิ่ม/แก้ไข/ลบ (ชื่อ, username, บทบาท, เบอร์มือถือ)
- **แท็บคู่มือ:** ขั้นตอนติดตั้ง PWA, เปิดรับแจ้งเตือน, ตรวจสอบระบบ, ทดสอบ FCM

## CORS / Request Pattern สำคัญ
- **ทุก fetch ไป GAS ต้องใช้ `Content-Type: text/plain`** — ถ้าใช้ `application/json` จะเกิด CORS preflight 405
- **ทุก request ต้องส่ง `secret: APP_CONFIG.CLIENT_SECRET`** ใน body — GAS ตรวจสอบก่อนประมวลผล
- GAS `doPost` ตรวจ `body.secret !== CONFIG.CLIENT_SECRET` ที่บรรทัดแรก

## Deployment Process

### Frontend (GitHub Pages)
```bash
git add <files>
git commit -m "..."
git push origin main   # GitHub Pages auto deploy ~1-2 นาที
```

### Backend (GAS)
1. Copy โค้ดทั้งหมดจาก `gas/Code.gs`
2. วางใน GAS Editor ที่ script.google.com
3. Deploy → Manage Deployments → Edit → New Version → Deploy

> ⚠️ การ push GitHub **ไม่ได้** อัปเดต GAS อัตโนมัติ ต้อง deploy ใน GAS Editor แยก

## ข้อควรระวัง
- `CLIENT_SECRET` ใน GAS Script Properties **ต้องตรงกับ** GitHub Secret `CLIENT_SECRET` — ถ้าไม่ตรงจะ Unauthorized
- `LINE_TOKEN` มี fallback hardcode อยู่ใน `Code.gs` — ควรตั้งใน Script Properties แทน
- `MINI_APP_ID` hardcode ใน `Code.gs` บรรทัด `CONFIG.MINI_APP_ID` — ถ้าเปลี่ยน LINE OA ต้องแก้ตรงนี้
- Broadcast quota นับต่อ follower — ถ้ามี 10 follower broadcast 1 ครั้ง = ใช้ 10 messages
- LINE Notify ถูกยกเลิกแล้ว (มี.ค. 2568) — ใช้ไม่ได้อีก
- Security: ห้าม commit `config.js` ที่มี key จริง (มี `.gitignore` ป้องกันอยู่)
- Security: ห้าม commit Firebase service account JSON ขึ้น Git
- iOS Web Push: ต้อง Add to Home Screen ก่อน แล้วเปิดจาก App icon (ไม่ใช่ Safari โดยตรง), iOS 16.4+
