// ============================================================
// load_test.mjs — ทดสอบระบบ 30 แจ้งซ่อม + 30 จองห้อง พร้อมกัน
// วิธีรัน: node test/load_test.mjs
// ============================================================

const GAS_URL = 'https://script.google.com/macros/s/AKfycbw6joijiaVLYTOEG8ajOl7wp5_JhsovC_yW3oqJ3XWHuKvlxmxHGr5bmTY33mnhtEN1/exec';

const ROOMS = ['หอประชุมซาวีโอ', 'ห้องประชุมอัลเบรา', 'ห้องประชุมรีกัลโดเน', 'Auditorium'];
const EQUIPMENT_OPTIONS = ['ไมโครโฟน', 'ลำโพง / เครื่องเสียง', 'โปรเจกเตอร์', 'จอภาพ / จอ LED'];

// ส่ง POST ไปยัง GAS (จัดการ redirect 302 ด้วยตนเอง)
async function postGAS(payload) {
  const start = Date.now();
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });

    const elapsed = Date.now() - start;

    if (!res.ok) {
      return { ok: false, status: res.status, elapsed, error: `HTTP ${res.status}` };
    }

    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch {
      return { ok: false, elapsed, error: `Non-JSON response: ${text.slice(0, 80)}` };
    }

    return { ok: json.success === true, elapsed, ticket: json.ticket, error: json.error };
  } catch (err) {
    return { ok: false, elapsed: Date.now() - start, error: err.message };
  }
}

// สร้าง payload แจ้งซ่อม
function makeRepair(i) {
  return {
    type: 'repair',
    name: `ผู้ทดสอบ คนที่ ${i + 1}`,
    phone: `08${String(i).padStart(8, '0')}`,
    equipment: EQUIPMENT_OPTIONS[i % EQUIPMENT_OPTIONS.length],
    location: `อาคาร SAVIO ชั้น ${(i % 4) + 1} ห้อง ${100 + i}`,
    description: `[LOAD TEST #${i + 1}] ทดสอบระบบอัตโนมัติ — อุปกรณ์ทำงานผิดปกติ`,
    timestamp: new Date().toISOString(),
  };
}

// สร้าง payload จองห้อง
function makeBooking(i) {
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + 7 + i); // กระจายวันที่ไม่ให้ conflict
  const dateStr = futureDate.toISOString().split('T')[0];
  const startH = String(8 + (i % 8)).padStart(2, '0');
  return {
    type: 'booking',
    name: `ผู้ทดสอบ คนที่ ${i + 1}`,
    phone: `09${String(i).padStart(8, '0')}`,
    room: ROOMS[i % ROOMS.length],
    date: dateStr,
    startTime: `${startH}:00`,
    endTime:   `${String(parseInt(startH) + 1).padStart(2, '0')}:00`,
    attendees: String(10 + i),
    purpose: `[LOAD TEST #${i + 1}] ทดสอบการจองห้องพร้อมกัน`,
    equipment: EQUIPMENT_OPTIONS[i % EQUIPMENT_OPTIONS.length],
    note: `Auto test entry ${i + 1}`,
    timestamp: new Date().toISOString(),
  };
}

function printBar(ok, total) {
  const filled = Math.round((ok / total) * 20);
  return `[${'█'.repeat(filled)}${'░'.repeat(20 - filled)}] ${ok}/${total}`;
}

function summarize(label, results) {
  const ok      = results.filter(r => r.ok).length;
  const fail    = results.filter(r => !r.ok).length;
  const times   = results.map(r => r.elapsed);
  const avg     = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  const min     = Math.min(...times);
  const max     = Math.max(...times);
  const tickets = results.filter(r => r.ticket).map(r => r.ticket);
  const errors  = results.filter(r => !r.ok).map(r => r.error);

  console.log(`\n${'─'.repeat(56)}`);
  console.log(`  ${label}`);
  console.log(`${'─'.repeat(56)}`);
  console.log(`  สำเร็จ    ${printBar(ok, results.length)}`);
  console.log(`  ล้มเหลว   ${fail} รายการ`);
  console.log(`  เวลาเฉลี่ย ${avg} ms  (min ${min} ms / max ${max} ms)`);
  if (tickets.length) console.log(`  Tickets   ${tickets.slice(0, 5).join(', ')}${tickets.length > 5 ? ` … (+${tickets.length - 5})` : ''}`);
  if (errors.length) {
    console.log(`  ข้อผิดพลาด:`);
    [...new Set(errors)].slice(0, 3).forEach(e => console.log(`    • ${e}`));
  }
}

// ─── MAIN ────────────────────────────────────────────────────
async function main() {
  const N = 30;
  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  🔬 LOAD TEST — ${N} แจ้งซ่อม + ${N} จองห้อง พร้อมกัน`);
  console.log(`  GAS: ${GAS_URL.slice(0, 60)}…`);
  console.log(`${'═'.repeat(56)}\n`);

  // สร้าง payloads
  const repairs  = Array.from({ length: N }, (_, i) => makeRepair(i));
  const bookings = Array.from({ length: N }, (_, i) => makeBooking(i));

  console.log(`  ⏳ กำลังส่ง ${N * 2} requests พร้อมกัน...`);
  const wallStart = Date.now();

  // ส่งทั้งหมดพร้อมกัน
  const [repairResults, bookingResults] = await Promise.all([
    Promise.all(repairs.map(p => postGAS(p))),
    Promise.all(bookings.map(p => postGAS(p))),
  ]);

  const wallTime = Date.now() - wallStart;
  console.log(`  ✅ เสร็จสิ้นภายใน ${wallTime} ms (${(wallTime / 1000).toFixed(1)} วินาที)\n`);

  summarize('📋 ผลแจ้งซ่อม (30 รายการ)', repairResults);
  summarize('📅 ผลจองห้องประชุม (30 รายการ)', bookingResults);

  const allOk = [...repairResults, ...bookingResults].filter(r => r.ok).length;
  const allFail = N * 2 - allOk;
  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  รวม: สำเร็จ ${allOk}/60  |  ล้มเหลว ${allFail}/60`);
  console.log(`  เวลารวม: ${wallTime} ms`);
  if (allFail === 0) {
    console.log('  🎉 ระบบรองรับ 60 requests พร้อมกันได้ปกติ');
  } else {
    console.log('  ⚠️  มีบางรายการล้มเหลว — ตรวจสอบ log ด้านบน');
  }
  console.log(`${'═'.repeat(56)}\n`);
}

main().catch(console.error);
