# วิธีดึงข้อมูลปฏิทิน (Calendar) — SD System Admin

ช่องทางดึงข้อมูลการจองมาแสดงบนปฏิทินของหน้า **admin.html**
(backend: Cloudflare Worker → JSP + MySQL)

---

## Flow

```
admin.html: fetchCalMonth()
   │  POST (Content-Type: text/plain)  +  secret ใน body
   ▼
WORKER_URL   https://sd-system-proxy.chanon-b.workers.dev
   │  forward body ตรงๆ (ไม่แก้)
   ▼
BACKEND_URL  http://sds-mis.sd.ac.th:8888/school_new_5/jsp/dept/api/index.jsp  (MySQL)
```

> Worker เป็นแค่ HTTPS proxy — จำเป็นเพราะเว็บเป็น HTTPS (GitHub Pages) แต่ backend เป็น HTTP
> ตัว Worker ไม่ตรวจ token เอง แต่ backend (JSP) ตรวจ `secret` ที่แนบมาใน body

---

## Token ที่ต้องใช้

| ชื่อ | ใช้ยังไง | ค่าจริงอยู่ที่ไหน |
|------|---------|------------------|
| `CLIENT_SECRET` | แนบใน field `secret` ของทุก request | GitHub Secret `CLIENT_SECRET` / Cloudflare Worker / GAS Script Properties |

ค่าจริงถูก inject เข้า `assets/js/config.js` ตอน deploy โดย GitHub Actions
ดูค่าได้จาก DevTools บนหน้า live `admin.html` → Console: `APP_CONFIG.CLIENT_SECRET`
แล้วเอาไปแทน `<CLIENT_SECRET>` ในตัวอย่างด้านล่าง

---

## Request body

```jsonc
// จองห้องประชุม
{ "type": "monthBookings",          "year": 2026, "month": 9,
  "username": "<admin_username>", "actor_username": "<admin_username>",
  "secret": "<CLIENT_SECRET>" }

// จองอุปกรณ์
{ "type": "equipmentMonthBookings", "year": 2026, "month": 9,
  "username": "<admin_username>", "actor_username": "<admin_username>",
  "secret": "<CLIENT_SECRET>" }
```

- `Content-Type` ต้องเป็น `text/plain` เสมอ (ถ้าใช้ `application/json` โดน CORS preflight)
- `username` / `actor_username` = user ที่ล็อกอิน admin (จาก `authBody()`)
- `secret` = `CLIENT_SECRET`

## Response

```jsonc
{
  "data": [
    { "date": "2026-09-05", "room": "...", "status": "จองห้องสำเร็จ", ... },
    { "date": "2026-09-12", ... }
  ]
}
```

frontend จับกลุ่ม event ตาม `ev.date` (`YYYY-MM-DD`) แล้ววางลงช่องปฏิทิน (`renderCalendarGrid()`)
สถานะที่ใช้แสดงสี: `เสร็จสิ้น` (เขียว) / `จองห้องสำเร็จ`,`กำลังดำเนินการ` (ฟ้า) / อื่นๆ = รอ (เหลือง)

---

## ตัวอย่างเรียก

### JS (fetch)

```js
const WORKER_URL = 'https://sd-system-proxy.chanon-b.workers.dev';
const res = await fetch(WORKER_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain' },
  body: JSON.stringify({
    type: 'monthBookings',      // หรือ 'equipmentMonthBookings'
    year: 2026,
    month: 9,
    username: '<admin_username>',
    actor_username: '<admin_username>',
    secret: '<CLIENT_SECRET>',
  }),
});
const { data } = await res.json();
console.log(data);
```

### curl

```bash
curl -X POST 'https://sd-system-proxy.chanon-b.workers.dev' \
  -H 'Content-Type: text/plain' \
  -d '{"type":"monthBookings","year":2026,"month":9,"username":"<admin_username>","actor_username":"<admin_username>","secret":"<CLIENT_SECRET>"}'
```

### Health check (ไม่ต้องมี token)

```bash
curl 'https://sd-system-proxy.chanon-b.workers.dev/health'
# → {"ok":true,"backend":"configured"}
```

---

## request types อื่นๆ ที่ backend รองรับ (จาก admin.html)

| type | ใช้ทำอะไร |
|------|-----------|
| `monthBookings` | ข้อมูลจองห้อง รายเดือน (ปฏิทิน) |
| `equipmentMonthBookings` | ข้อมูลจองอุปกรณ์ รายเดือน (ปฏิทิน) |
| `adminGetData` | ข้อมูลงานค้าง |
| `adminGetAllData` | ข้อมูลงานทั้งหมด |
| `reportData` | รายงานตามช่วงวันที่ (`dateFrom`,`dateTo`) |
| `updateStatus` | อัปเดตสถานะงาน (`ticket`,`status`,`updatedBy`) |
| `adminLogin` | ล็อกอิน admin |
| `getAdmins` / `addDeptAdmin` / `updateDeptAdmin` / `deleteDeptAdmin` | จัดการ admin |
| `registerFCMToken` | ลงทะเบียน push token |

ทุก type แนบ `secret: <CLIENT_SECRET>` เหมือนกัน
