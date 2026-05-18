#!/usr/bin/env python3
"""
load_test.py — ทดสอบระบบ 30 แจ้งซ่อม + 30 จองห้อง พร้อมกัน
วิธีรัน: python3 test/load_test.py
"""

import json
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta

GAS_URL = (
    "https://script.google.com/macros/s/"
    "AKfycbw6joijiaVLYTOEG8ajOl7wp5_JhsovC_yW3oqJ3XWHuKvlxmxHGr5bmTY33mnhtEN1/exec"
)

ROOMS = [
    "หอประชุมซาวีโอ",
    "ห้องประชุมอัลเบรา",
    "ห้องประชุมรีกัลโดเน",
    "Auditorium",
]
EQUIPMENT = ["ไมโครโฟน", "ลำโพง / เครื่องเสียง", "โปรเจกเตอร์", "จอภาพ / จอ LED"]


# ─── HTTP POST (รองรับ redirect 302 ด้วยตนเอง) ─────────────────
def post_gas(payload: dict) -> dict:
    start = time.time()
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")

    def do_post(url):
        req = urllib.request.Request(
            url,
            data=body,
            headers={"Content-Type": "text/plain; charset=utf-8"},
            method="POST",
        )
        return urllib.request.urlopen(req, timeout=60)

    try:
        # ส่ง POST แรก — อาจได้ redirect
        try:
            resp = do_post(GAS_URL)
        except urllib.error.HTTPError as e:
            if e.code in (301, 302, 303, 307, 308):
                redirect_url = e.headers.get("Location")
                resp = do_post(redirect_url)
            else:
                raise

        elapsed = round((time.time() - start) * 1000)
        text = resp.read().decode("utf-8")
        data = json.loads(text)
        return {
            "ok": data.get("success") is True,
            "ticket": data.get("ticket"),
            "error": data.get("error"),
            "elapsed": elapsed,
        }

    except Exception as exc:
        return {
            "ok": False,
            "ticket": None,
            "error": str(exc)[:120],
            "elapsed": round((time.time() - start) * 1000),
        }


# ─── PAYLOAD FACTORIES ─────────────────────────────────────────
def make_repair(i: int) -> dict:
    return {
        "type": "repair",
        "name": f"ผู้ทดสอบ คนที่ {i + 1}",
        "phone": f"08{str(i).zfill(8)}",
        "equipment": EQUIPMENT[i % len(EQUIPMENT)],
        "location": f"อาคาร SAVIO ชั้น {(i % 4) + 1} ห้อง {100 + i}",
        "description": f"[LOAD TEST #{i + 1}] ทดสอบระบบอัตโนมัติ",
        "timestamp": datetime.now().isoformat(),
    }


def make_booking(i: int) -> dict:
    future = datetime.now() + timedelta(days=7 + i)   # กระจายวันไม่ให้ conflict
    date_str = future.strftime("%Y-%m-%d")
    start_h = 8 + (i % 10)
    return {
        "type": "booking",
        "name": f"ผู้ทดสอบ คนที่ {i + 1}",
        "phone": f"09{str(i).zfill(8)}",
        "room": ROOMS[i % len(ROOMS)],
        "date": date_str,
        "startTime": f"{start_h:02d}:00",
        "endTime":   f"{start_h + 1:02d}:00",
        "attendees": str(10 + i),
        "purpose": f"[LOAD TEST #{i + 1}] ทดสอบการจองห้องพร้อมกัน",
        "equipment": EQUIPMENT[i % len(EQUIPMENT)],
        "note": f"Auto test entry {i + 1}",
        "timestamp": datetime.now().isoformat(),
    }


# ─── HELPERS ───────────────────────────────────────────────────
def bar(ok, total, width=20):
    filled = round(ok / total * width)
    return f"[{'█' * filled}{'░' * (width - filled)}] {ok}/{total}"


def summarize(label: str, results: list[dict]):
    ok      = sum(1 for r in results if r["ok"])
    fail    = len(results) - ok
    times   = [r["elapsed"] for r in results]
    avg     = round(sum(times) / len(times))
    mn, mx  = min(times), max(times)
    tickets = [r["ticket"] for r in results if r["ticket"]]
    errors  = list({r["error"] for r in results if not r["ok"]})

    print(f"\n{'─' * 58}")
    print(f"  {label}")
    print(f"{'─' * 58}")
    print(f"  สำเร็จ    {bar(ok, len(results))}")
    print(f"  ล้มเหลว   {fail} รายการ")
    print(f"  เวลาเฉลี่ย {avg} ms  (min {mn} ms / max {mx} ms)")
    if tickets:
        sample = ", ".join(tickets[:5])
        extra  = f" … (+{len(tickets) - 5})" if len(tickets) > 5 else ""
        print(f"  Tickets   {sample}{extra}")
    for err in errors[:3]:
        print(f"  ⚠ {err}")


# ─── MAIN ──────────────────────────────────────────────────────
def main():
    N = 30
    print(f"\n{'═' * 58}")
    print(f"  🔬 LOAD TEST — {N} แจ้งซ่อม + {N} จองห้อง พร้อมกัน")
    print(f"  GAS: …{GAS_URL[-40:]}")
    print(f"{'═' * 58}\n")

    repairs  = [make_repair(i)  for i in range(N)]
    bookings = [make_booking(i) for i in range(N)]
    all_payloads = repairs + bookings        # รวม 60 รายการ

    print(f"  ⏳ กำลังส่ง {len(all_payloads)} requests (workers=20)…")
    wall_start = time.time()

    results = [None] * len(all_payloads)
    with ThreadPoolExecutor(max_workers=20) as ex:
        futures = {ex.submit(post_gas, p): i for i, p in enumerate(all_payloads)}
        done = 0
        for fut in as_completed(futures):
            idx = futures[fut]
            results[idx] = fut.result()
            done += 1
            print(f"\r  ส่งแล้ว {done}/{len(all_payloads)}…", end="", flush=True)

    wall_ms = round((time.time() - wall_start) * 1000)
    print(f"\r  ✅ เสร็จสิ้นภายใน {wall_ms} ms ({wall_ms / 1000:.1f} วินาที)       ")

    repair_res  = results[:N]
    booking_res = results[N:]

    summarize("📋 ผลแจ้งซ่อม (30 รายการ)",       repair_res)
    summarize("📅 ผลจองห้องประชุม (30 รายการ)",   booking_res)

    all_ok   = sum(1 for r in results if r["ok"])
    all_fail = len(results) - all_ok

    print(f"\n{'═' * 58}")
    print(f"  รวม: สำเร็จ {all_ok}/60  |  ล้มเหลว {all_fail}/60")
    print(f"  เวลารวม (wall clock): {wall_ms} ms")
    if all_fail == 0:
        print("  🎉 ระบบรองรับ 60 requests พร้อมกันได้ปกติ")
    else:
        print("  ⚠️  มีบางรายการล้มเหลว — ดู error ด้านบน")
    print(f"{'═' * 58}\n")


if __name__ == "__main__":
    main()
