#!/bin/bash
# ============================================================
# run.sh — รัน Local Web Server สำหรับทดสอบเว็บไซต์
# ใช้งาน: ./run.sh [port]
# ============================================================

PORT=${1:-3000}
DIR="$(cd "$(dirname "$0")" && pwd)"

# เปิดเบราว์เซอร์หลังจากเซิร์ฟเวอร์พร้อม
open_browser() {
  sleep 1
  if command -v open &>/dev/null; then
    open "http://localhost:$PORT"          # macOS
  elif command -v xdg-open &>/dev/null; then
    xdg-open "http://localhost:$PORT"      # Linux
  fi
}

echo ""
echo "  ┌─────────────────────────────────────────┐"
echo "  │   งานโสตทัศนูปกรณ์ — Local Dev Server      │"
echo "  └─────────────────────────────────────────┘"
echo ""
echo "  📁 Root : $DIR"
echo "  🌐 URL  : http://localhost:$PORT"
echo "  🛑 หยุด : Ctrl+C"
echo ""

open_browser &

# ลองใช้ Python 3 ก่อน (มีอยู่บน macOS ทุกเครื่อง)
if command -v python3 &>/dev/null; then
  echo "  ✅ ใช้ Python 3 HTTP Server"
  echo ""
  cd "$DIR" && python3 -m http.server "$PORT"

# ถ้าไม่มี Python 3 ลอง Python 2
elif command -v python &>/dev/null; then
  echo "  ✅ ใช้ Python 2 HTTP Server"
  echo ""
  cd "$DIR" && python -m SimpleHTTPServer "$PORT"

# ถ้าไม่มีเลย แสดง error
else
  echo "  ❌ ไม่พบ Python กรุณาติดตั้ง Python 3"
  echo "     brew install python3"
  exit 1
fi
