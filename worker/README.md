# SD System Proxy (Cloudflare Worker)

HTTPS proxy ที่ forward request จาก admin.html (GitHub Pages, HTTPS) ไปยัง JSP backend (`sds-mis.sd.ac.th:8888`, HTTP)

ต้องการ proxy นี้เพราะ browser block "mixed content" — หน้า HTTPS เรียก HTTP API ตรงๆ ไม่ได้

## Deploy ครั้งแรก

```bash
# 1. ติดตั้ง wrangler (Cloudflare CLI)
npm install -g wrangler

# 2. Login Cloudflare
wrangler login

# 3. ตั้ง backend URL เป็น secret
cd worker
wrangler secret put BACKEND_URL
# วาง: http://sds-mis.sd.ac.th:8888/school_new_5/jsp/dept/api/index.jsp

# 4. Deploy
wrangler deploy
```

ได้ URL จะเป็น `https://sd-system-proxy.<account>.workers.dev`

## ทดสอบ

```bash
# Health check (ไม่ต้องส่ง body)
curl https://sd-system-proxy.<account>.workers.dev/health

# Test forwarding
curl -X POST https://sd-system-proxy.<account>.workers.dev/ \
  -H "Content-Type: text/plain" \
  -d '{"type":"adminLogin","username":"admin"}'
```

## ใช้ใน admin.html

แก้ `assets/js/config.js` (ผ่าน GitHub Secret `WORKER_URL`):

```javascript
WORKER_URL: 'https://sd-system-proxy.<account>.workers.dev/',
```

แล้วใน admin.html เปลี่ยน `window.APP_CONFIG.GAS_URL` → `window.APP_CONFIG.WORKER_URL` สำหรับ call ที่ต้องไป MySQL  
(image upload ยังใช้ `GAS_URL` ต่อ — เก็บ Google Drive)

## Update Backend URL (เปลี่ยน secret)

```bash
wrangler secret put BACKEND_URL
# วาง URL ใหม่
```

## Logs

```bash
wrangler tail
```

ดู realtime log ของทุก request — debug ได้สะดวก

## Local dev

```bash
wrangler dev
# จะรันที่ http://localhost:8787 ใช้ BACKEND_URL จาก .dev.vars
```

สร้าง `.dev.vars`:
```
BACKEND_URL=http://sds-mis.sd.ac.th:8888/school_new_5/jsp/dept/api/index.jsp
```

## โครงสร้าง

```
worker/
├── src/worker.js        ← main proxy code
├── wrangler.toml        ← config
├── .gitignore
└── README.md
```

## CORS

Worker อนุญาตเฉพาะ `https://chanonnicky.github.io` (จาก `ALLOWED_ORIGIN`)  
ถ้าจะ test จาก localhost — เพิ่ม env var:

```bash
wrangler secret put ALLOWED_ORIGIN
# วาง: http://localhost:8000
```

หรือ override ใน `wrangler.toml`:
```toml
[vars]
ALLOWED_ORIGIN = "*"  # ⚠️ Dev only — production ใช้ origin จริง
```
