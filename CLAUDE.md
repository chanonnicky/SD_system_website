# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## โปรเจกต์นี้คืออะไร

ระบบเว็บไซต์สำหรับโรงเรียนเซนต์ดอมินิก เป็น SPA ใน `index.html`:

1. **Portal Hub** (`#page-home`) — เลือกฝ่าย (โสต, ธุรการ, วัดประเมินผล)
2. **ฝ่ายโสตทัศนูปกรณ์** (`#page-av`) — แจ้งซ่อม, จองห้อง, ปฏิทิน, ติดตามสถานะ
3. **ฝ่ายธุรการ** (`#page-docs`) — mockup + view-only; admin แก้ไขได้ที่ `admin-docs.html`
4. **ฝ่ายวัดประเมินผล** (`#page-assess`) — view-only สถานะตรวจข้อสอบ; admin แก้ไขได้ที่ `admin-assess.html`

- **Live:** https://chanonnicky.github.io/SD_system_website/
- **Repo:** https://github.com/chanonnicky/SD_system_website
- **Hosting:** GitHub Pages (branch: main — auto deploy เมื่อ push)

## Tech Stack

- **Frontend:** Vanilla JS + Tailwind CSS (CDN) — ไม่มี build step
- **Backend:** Google Apps Script (GAS) deployed as Web App — รับ POST, บันทึก Google Sheets, ส่ง LINE + FCM
- **Read path:** frontend อ่านข้อมูลโดยตรงจาก Google Sheets API v4 ด้วย API Key (ไม่ผ่าน GAS)
- **Write path:** frontend POST ไป GAS URL ด้วย `Content-Type: text/plain` (ถ้าใช้ `application/json` จะเกิด CORS preflight 405)

## Local Development

ไม่มี build step — เปิดไฟล์โดยตรงหรือ serve ด้วย:

```bash
python3 -m http.server 8080
# จากนั้นเปิด http://localhost:8080
```

**config.js ไม่มีใน repo** (อยู่ใน `.gitignore`) — ต้องสร้างเองก่อน dev:

```bash
cp assets/js/config.example.js assets/js/config.js
# แล้วใส่ค่าจริงใน config.js
```

ในระหว่าง CI/CD, `config.js` ถูก **auto-generate** จาก GitHub Secrets ใน `.github/workflows/deploy.yml` — ไม่ต้อง commit ไฟล์นี้

## โครงสร้างไฟล์สำคัญ

```
index.html          — SPA หลัก: Portal hub + ฝ่ายโสต (av) + ฝ่ายธุรการ (docs) + ฝ่ายวัดประเมินผล (assess)
admin.html          — Admin Panel ฝ่ายโสต (login, จัดการงาน, admin users, คู่มือ PWA)
admin-docs.html     — Admin Panel ฝ่ายธุรการ (login, CRUD เอกสาร, เก็บใน localStorage sdDocsData)
admin-assess.html   — Admin Panel ฝ่ายวัดประเมินผล (login, แก้สถานะตรวจข้อสอบ, เก็บใน localStorage sdAssessExams)
ระบบงานฝ่าย.html   — redirect ไป index.html (ไม่มีเนื้อหา)
sw.js               — Service Worker: FCM background push + notificationclick → admin.html?ticket=XXX
manifest.json       — PWA manifest
rooms.js            — ข้อมูลห้องประชุม (ชื่อ, capacity)
picture/
  school_logo.webp  — โลโก้โรงเรียน (แสดงใน top nav)
  app_logo.webp     — โลโก้แอป (แสดงใน admin.html)
assets/js/
  app.js            — logic หลักทั้งหมดของ index.html (form, calendar, sheets, GAS calls)
  notifications.js  — FCM init, permission request, token registration ไป GAS
  config.js         — APP_CONFIG (ไม่ commit — สร้างจาก config.example.js)
  config.example.js — template ของ config.js
gas/
  Code.gs           — GAS backend (copy ไป GAS Editor ด้วยมือ — ไม่ auto-deploy)
```

## Key Architectural Rules

**Request pattern ไป GAS:**
```js
fetch(APP_CONFIG.GAS_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain' },   // ← ต้อง text/plain เสมอ
  body: JSON.stringify({ secret: APP_CONFIG.CLIENT_SECRET, ...data })
})
```
GAS `doPost` ตรวจ `body.secret !== CONFIG.CLIENT_SECRET` เป็นบรรทัดแรก — ถ้าไม่ผ่านจะ return Unauthorized

**Admin login (ทุกฝ่าย):** เก็บใน `localStorage` + expiry 30 วัน — ไม่ใช่ session

**localStorage keys สำหรับ docs/assess:**
- `sdAssessExams` — JSON array ข้อมูลการตรวจข้อสอบ; เขียนโดย `admin-assess.html`, อ่านโดย `index.html` (view-only)
- `sdDocsData` — JSON array เอกสารฝ่ายธุรการ; เขียนโดย `admin-docs.html`, อ่านโดย `index.html` (view-only)
- `sdAssessAdmin` / `sdDocsAdmin` — session token แยกต่างหากสำหรับแต่ละ admin panel

**FCM token flow:** `notifications.js` → ขอ permission → get token → POST ไป GAS → GAS บันทึกลงชีท `FCMTokens` (A=token, B=timestamp, C=userAgent)

**Notification click:** SW เปิด `admin.html?ticket=XXX` → admin.html อ่าน `?ticket=` แล้วเปิด modal ของงานนั้นอัตโนมัติ

## GAS Script Properties (ตั้งใน GAS Editor → Project Settings)

| Key | คำอธิบาย |
|-----|---------|
| `LINE_TOKEN` | Channel Access Token (มี fallback hardcode ใน Code.gs — ควรลบออก) |
| `SPREADSHEET_ID` | `1rHGjwT6ZBf0qryjXahaw1RUve3ozvbIB89u3gSYzhbU` |
| `CLIENT_SECRET` | **ต้องตรงกับ** GitHub Secret `CLIENT_SECRET` |
| `WEBHOOK_SECRET` | Validate URL ใน LINE Flex card |
| `FCM_PRIVATE_KEY` | private_key จาก Firebase service account JSON (รวม `-----BEGIN/END-----`) |
| `FCM_CLIENT_EMAIL` | `firebase-adminsdk-fbsvc@sd-av-website.iam.gserviceaccount.com` |
| `NOTIFY_USER_IDS` | LINE userId ของ admin ที่รับแจ้งเตือน คั่นด้วย comma |

## GitHub Secrets (ใช้ใน deploy.yml เพื่อ generate config.js)

`GAS_URL`, `SPREADSHEET_ID`, `GOOGLE_API_KEY`, `CLIENT_SECRET`

## Google Sheets Layout

**ชีทแจ้งซ่อม (A:J)**
`A=เลขที่ | B=วันที่แจ้ง | C=ชื่อ | D=เบอร์โทร | E=อุปกรณ์ | F=สถานที่ | G=อาการ | H=รูปภาพ | I=สถานะ | J=ผู้อัปเดตล่าสุด`

**ชีทจองห้องประชุม (A:N)**
`A=เลขที่ | B=วันที่จอง | C=ห้อง | D=วันที่ใช้ห้อง | E=เวลาเริ่ม | F=เวลาสิ้นสุด | G=ชื่อ | H=เบอร์โทร | I=ผู้เข้าร่วม | J=วัตถุประสงค์ | K=อุปกรณ์ | L=หมายเหตุ | M=สถานะ | N=ผู้อัปเดตล่าสุด`

**ชีท FCMTokens (A:C):** token | timestamp | userAgent

**ชีท Admin User (A:F):** username | (ว่าง) | ชื่อ | บทบาท | วันที่เพิ่ม | เบอร์มือถือ

**Ticket format:** แจ้งซ่อม = `REP-YYYY-NNN`, จองห้อง = `BK-YYYY-NNN`

## Notification Logic

| เหตุการณ์ | LINE Broadcast | FCM Push |
|-----------|---------------|----------|
| งานซ่อม/จองใหม่ | ✓ | ✓ (พร้อม ticket URL) |
| อัปเดต → เสร็จสิ้น | ✓ | ✓ |
| อัปเดต → กำลังดำเนินการ / ยกเลิก | ✗ | ✗ |

- LINE Free Plan = 200 msg/เดือน นับต่อ follower (1 broadcast × 10 followers = 10 messages)
- LINE Notify ถูกยกเลิกแล้ว (มี.ค. 2568)

## Status Values

| เก็บใน Sheets | แสดงผล | ปฏิทิน |
|--------------|--------|--------|
| รับเรื่อง | มีงานใหม่ | แถบสีเทา |
| กำลังดำเนินการ | กำลังดำเนินงาน | สีห้องปกติ |
| เสร็จสิ้น | เสร็จสิ้น | สีห้องปกติ |
| ยกเลิก | ยกเลิก | ไม่แสดง |

## Deployment

**Frontend:** `git push origin main` → GitHub Actions auto-generate config.js → deploy to GitHub Pages (~1-2 นาที)

**Backend (GAS):** copy `gas/Code.gs` → paste ใน GAS Editor → Deploy → Manage Deployments → Edit → New Version → Deploy
> GAS ไม่ auto-deploy จาก GitHub — ต้องทำด้วยมือทุกครั้ง

## ข้อควรระวัง

- `CLIENT_SECRET` ใน GAS Script Properties **ต้องตรงกับ** GitHub Secret `CLIENT_SECRET`
- `MINI_APP_ID` hardcode ใน `Code.gs` (`CONFIG.MINI_APP_ID = '2010102800-8WvwvjA4'`) — ต้องแก้ถ้าเปลี่ยน LINE OA
- iOS Web Push ต้อง Add to Home Screen แล้วเปิดจาก app icon (iOS 16.4+, ไม่ใช่ Safari โดยตรง)
- `sw.js` มี Firebase config hardcode ตรงๆ (ไม่อ่านจาก `APP_CONFIG`) — ต้องแก้ใน sw.js แยกถ้าเปลี่ยน Firebase project
