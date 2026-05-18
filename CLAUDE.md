# CLAUDE.md — SD AV Website (ฝ่ายโสตทัศนูปกรณ์ โรงเรียนเซนต์ดอมินิก)

## ภาพรวมโปรเจกต์
เว็บไซต์สำหรับฝ่าย AV ของโรงเรียนเซนต์ดอมินิก มีระบบแจ้งซ่อม จองห้องประชุม ติดตามสถานะ และแจ้งเตือนผ่าน LINE

- **เว็บไซต์:** https://chanonnicky.github.io/SD_AV_website/
- **Repository:** https://github.com/chanonnicky/SD_AV_website
- **Hosting:** GitHub Pages (branch: main — auto deploy เมื่อ push)

## Tech Stack
- **Frontend:** Vanilla JS + Tailwind CSS (CDN) — ไม่มี build step
- **Backend:** Google Apps Script (GAS) — รับ POST บันทึก Sheets + ส่ง LINE
- **Database:** Google Sheets
- **Notification:** LINE Messaging API (Broadcast)
- **Deploy Frontend:** `git push origin main` → GitHub Pages auto deploy

## โครงสร้างไฟล์สำคัญ
```
index.html              — หน้าเว็บหลัก (Single Page App)
rooms.js                — ข้อมูลห้องประชุม
assets/
  js/
    app.js              — logic ทั้งหมด (form, calendar, status tracking)
    config.js           — GAS_URL, SPREADSHEET_ID, API_KEY (public config)
    config.example.js   — template สำหรับ config.js
  css/style.css         — custom styles
gas/
  Code.gs               — Google Apps Script backend (copy ไป GAS Editor ด้วยมือ)
```

## Key Configurations

### GAS Script Properties (ตั้งใน GAS Editor → Project Settings)
| Key | คำอธิบาย |
|-----|---------|
| `LINE_TOKEN` | Channel Access Token จาก LINE Developers Console |
| `SPREADSHEET_ID` | `1rHGjwT6ZBf0qryjXahaw1RUve3ozvbIB89u3gSYzhbU` |
| `CLIENT_SECRET` | Secret สำหรับ validate request จาก frontend |
| `WEBHOOK_SECRET` | Secret สำหรับ validate URL ปุ่มใน LINE card |

### URLs สำคัญ
- **GAS URL:** `https://script.google.com/macros/s/AKfycby1JFOuyNQcF0GlYoxT1cByof5_h1jQVqCwdAxS9tEylqTKPz5bzfY7pLUdgggq-QGc/exec`
- **LIFF/Mini App ID:** `2010102800-8WvwvjA4` (hardcode ใน `Code.gs` → `CONFIG.MINI_APP_ID`)
- **Spreadsheet:** `https://docs.google.com/spreadsheets/d/1rHGjwT6ZBf0qryjXahaw1RUve3ozvbIB89u3gSYzhbU/edit`

## LINE Bot Commands (Reply API — ฟรี ไม่นับ quota)
| Command | ผลลัพธ์ |
|---------|---------|
| `/งาน` หรือ `งาน` | แสดงงานซ่อม + จองที่ค้างอยู่ทั้งหมด |
| `/ซ่อม` หรือ `ซ่อม` | งานซ่อมที่ค้างอยู่ (รับเรื่อง/รอดำเนินการ/กำลังดำเนินการ) |
| `/จอง` หรือ `จอง` | งานจองที่ค้างอยู่ |
| `/quota` หรือ `quota` | ตรวจสอบ broadcast quota + จำนวนครั้งที่ส่งได้ |
| `/sheet` หรือ `sheet` | Link Google Sheets แยกแต่ละชีท |
| `/myid` | ดู LINE userId ของตัวเอง |
| `/ช่วย` หรือ `/help` | แสดงคำสั่งทั้งหมด |

## LINE Notification Logic
- **Broadcast** ส่งทุกครั้งที่มีการแจ้งซ่อมหรือจองห้องใหม่
- **Broadcast** ส่งอีกครั้งเมื่ออัปเดตสถานะเป็น **"เสร็จสิ้น"** เท่านั้น (ไม่ส่งตอน "กำลังดำเนินการ" หรือ "ยกเลิก")
- **Reply API** ใช้สำหรับ bot commands — ฟรี ไม่นับ quota
- **Quota:** Free Plan = 200 msg/เดือน (นับต่อ follower) — reset วันที่ 1 ของทุกเดือน

## Google Sheets Layout
### ชีทแจ้งซ่อม (A:I)
`A=เลขที่ | B=วันที่แจ้ง | C=ชื่อผู้แจ้ง | D=เบอร์โทร | E=อุปกรณ์ | F=สถานที่ | G=อาการ | H=รูปภาพ | I=สถานะ`

### ชีทจองห้องประชุม (A:M)
`A=เลขที่ | B=วันที่จอง | C=ห้อง | D=วันที่ใช้ห้อง | E=เวลาเริ่ม | F=เวลาสิ้นสุด | G=ชื่อผู้จอง | H=เบอร์โทร | I=จำนวนผู้เข้าร่วม | J=วัตถุประสงค์ | K=อุปกรณ์ | L=หมายเหตุ | M=สถานะ`

### Ticket Format
- แจ้งซ่อม: `REP-YYYY-NNN`
- จองห้อง: `BK-YYYY-NNN`

## สถานะและการแสดงผล
| สถานะ | ปฏิทิน | LINE Broadcast |
|-------|--------|---------------|
| รับเรื่อง | แถบสีเทา "กำลังจะจอง" | ไม่ส่ง |
| กำลังดำเนินการ | สีห้องปกติ | ไม่ส่ง |
| เสร็จสิ้น | สีห้องปกติ | ส่ง Flex card |
| ยกเลิก | ไม่แสดง | ไม่ส่ง |

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
- `LINE_TOKEN` มี fallback hardcode อยู่ใน `Code.gs` — ควรตั้งใน Script Properties แทน
- `MINI_APP_ID` hardcode ใน `Code.gs` บรรทัด `CONFIG.MINI_APP_ID` — ถ้าเปลี่ยน LINE OA ต้องแก้ตรงนี้
- Broadcast quota นับต่อ follower — ถ้ามี 10 follower broadcast 1 ครั้ง = ใช้ 10 messages
- LINE Notify ถูกยกเลิกแล้ว (มี.ค. 2568) — ใช้ไม่ได้อีก
- Security: ห้าม commit `config.js` ที่มี key จริง (มี `.gitignore` ป้องกันอยู่)
