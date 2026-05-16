// ============================================================
// CONFIG — โหลดจาก assets/js/config.js (fallback demo mode ถ้าไม่มีไฟล์)
// ============================================================
const _cfg = window.APP_CONFIG || {
  GAS_URL:        'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL',
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID',
  GOOGLE_API_KEY: 'YOUR_GOOGLE_API_KEY',
  REPAIR_SHEET:   'แจ้งซ่อม',
  BOOKING_SHEET:  'จองห้องประชุม',
};

const SHEETS_BASE = `https://sheets.googleapis.com/v4/spreadsheets/${_cfg.SPREADSHEET_ID}/values`;

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
// สำหรับค่า dynamic ใน onclick attribute: JSON.stringify + HTML-escape
function safeAttr(v) {
  return JSON.stringify(String(v ?? '')).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ============================================================
// SHEETS API HELPER — อ่านข้อมูลตรงจาก Google Sheets
// ============================================================
async function fetchSheetData(sheetName, range = 'A:H') {
  const encoded = encodeURIComponent(`${sheetName}!${range}`);
  const res = await fetch(`${SHEETS_BASE}/${encoded}?key=${_cfg.GOOGLE_API_KEY}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.values || [];
}

// ============================================================
// TAB NAVIGATION
// ============================================================
function showTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

  document.getElementById(`tab-${tabName}`).classList.remove('hidden');
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

  if (tabName === 'calendar') { allBookings = []; renderCalendar(); }
}

// ============================================================
// IMAGE HELPER — resize แล้วแปลงเป็น base64
// ============================================================
function resizeImageToBase64(file, maxPx = 1200, quality = 0.82) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxPx || height > maxPx) {
          if (width > height) { height = Math.round(height * maxPx / width); width = maxPx; }
          else { width = Math.round(width * maxPx / height); height = maxPx; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl.split(',')[1]); // base64 only
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ============================================================
// PHONE VALIDATION — รองรับเบอร์ไทย 9-10 หลัก (มี/ไม่มี -, +66)
// ============================================================
function validatePhone(phone) {
  const cleaned = phone.replace(/[\s\-]/g, '');
  return /^((\+66|0066)?\d{9}|0\d{8,9})$/.test(cleaned);
}

// ============================================================
// REPAIR FORM SUBMISSION
// ============================================================
async function submitRepair(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');

  if (!validatePhone(form.phone.value.trim())) {
    showToast('เบอร์โทรติดต่อไม่ถูกต้อง กรุณากรอกเบอร์ 9-10 หลัก', 'error');
    return;
  }

  const equipmentVal = form.equipment.value;
  const equipmentOther = form.equipmentOther?.value.trim();
  const building = form.locationBuilding.value.trim();
  const floor = form.locationFloor.value.trim();
  const room = form.locationRoom.value.trim();

  const data = {
    type: 'repair',
    name: form.name.value.trim(),
    phone: form.phone.value.trim(),
    equipment: equipmentVal === 'อื่นๆ' && equipmentOther ? `อื่นๆ (${equipmentOther})` : equipmentVal,
    location: [building, `ชั้น ${floor}`, `ห้อง ${room}`].filter(Boolean).join(' '),
    description: form.description.value.trim(),
    timestamp: new Date().toISOString(),
  };

  const imageInput = document.getElementById('repairImageInput');
  const imageFile = imageInput?.files?.[0];
  if (imageFile) {
    setLoading(btn, true, 'กำลังอัปโหลดรูป...');
    data.imageBase64 = await resizeImageToBase64(imageFile);
  }

  setLoading(btn, true, 'กำลังส่ง...');

  try {
    const ticket = await submitToGAS(data);
    form.reset();
    showSuccess(
      'แจ้งซ่อมสำเร็จ!',
      `ทีมงานได้รับเรื่องแจ้งซ่อมของคุณแล้ว`,
      ticket,
      'กรุณาบันทึกเลขที่ Ticket ไว้ติดตามสถานะ ทีมงานจะติดต่อกลับภายใน 24 ชั่วโมง'
    );
  } catch (err) {
    showToast('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', 'error');
    console.error(err);
  } finally {
    setLoading(btn, false, '<i class="fa-solid fa-paper-plane mr-2"></i>ส่งแจ้งซ่อม');
  }
}

// ============================================================
// BOOKING FORM SUBMISSION
// ============================================================
async function submitBooking(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');

  // --- Sync validations ---
  if (!validatePhone(form.phone.value.trim())) {
    showToast('เบอร์โทรติดต่อไม่ถูกต้อง กรุณากรอกเบอร์ 9-10 หลัก', 'error');
    return;
  }

  const startTime  = `${form.startHour.value}:${form.startMin.value}`;
  const endTime    = `${form.endHour.value}:${form.endMin.value}`;
  if (startTime >= endTime) {
    showToast('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น', 'error');
    return;
  }

  const selectedRoom = form.room.value;
  const selectedDate = `${form.bookingYear.value}-${form.bookingMonth.value}-${form.bookingDay.value}`;

  const bookingDate = new Date(selectedDate + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (bookingDate < today) {
    showToast('ไม่สามารถจองย้อนหลังได้', 'error');
    return;
  }

  // --- Lock button before async work ---
  setLoading(btn, true, 'กำลังตรวจสอบ...');

  try {
    // Fresh conflict check จาก Sheet โดยตรง
    if (_cfg.GOOGLE_API_KEY !== 'YOUR_GOOGLE_API_KEY') {
      const rows = await fetchSheetData(_cfg.BOOKING_SHEET, 'A:M');
      const existing = rows.slice(1)
        .map(r => parseBookingRow(r))
        .filter(b => b.room === selectedRoom && b.date === selectedDate && b.status !== 'ยกเลิก');
      const fc = existing.find(b => startTime < b.endTime && endTime > b.startTime);
      if (fc) {
        showToast(`ห้องนี้ถูกจองแล้วในช่วง ${fc.startTime}–${fc.endTime} น. โดย ${fc.name}`, 'error');
        renderSlotsPanel(document.getElementById('bookedSlotsPanel'), existing);
        setLoading(btn, false, '<i class="fa-solid fa-calendar-check mr-2"></i>ยืนยันการจอง');
        return;
      }
    } else {
      const cached = allBookings.find(b =>
        b.room === selectedRoom && b.date === selectedDate &&
        startTime < b.endTime && endTime > b.startTime
      );
      if (cached) {
        showToast(`ห้องนี้ถูกจองแล้วในช่วง ${cached.startTime}–${cached.endTime} น. โดย ${cached.name}`, 'error');
        setLoading(btn, false, '<i class="fa-solid fa-calendar-check mr-2"></i>ยืนยันการจอง');
        return;
      }
    }
  } catch { /* network error — fall through, GAS will re-check */ }

  setLoading(btn, true, 'กำลังจอง...');

  const otherEquipment = form.equipmentOther?.value.trim();
  const checkedEquipment = [...form.querySelectorAll('input[name="equipment"]:checked')]
    .map(el => el.value === 'อื่นๆ' && otherEquipment ? `อื่นๆ (${otherEquipment})` : el.value)
    .join(', ');

  const data = {
    type: 'booking',
    name: form.name.value.trim(),
    phone: form.phone.value.trim(),
    attendees: form.attendees.value,
    room: selectedRoom,
    date: selectedDate,
    startTime,
    endTime,
    purpose: form.purpose.value.trim(),
    equipment: checkedEquipment,
    note: form.note.value.trim(),
    timestamp: new Date().toISOString(),
  };

  try {
    const ticket = await submitToGAS(data);
    clearRoomSelection();
    form.reset();
    // Add booking to calendar immediately (optimistic update)
    allBookings.push({ ticket, date: data.date, room: data.room, startTime: data.startTime, endTime: data.endTime, name: data.name });
    showSuccess(
      'จองห้องสำเร็จ!',
      `ห้อง "${data.room}" วันที่ ${formatDateTH(data.date)} เวลา ${data.startTime}–${data.endTime} น.`,
      ticket,
      'ทีมงานจะยืนยันการจองผ่าน LINE Official Account'
    );
  } catch (err) {
    const msg = err.message && err.message !== 'Unknown error'
      ? err.message
      : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
    showToast(msg, 'error');
    console.error(err);
  } finally {
    setLoading(btn, false, '<i class="fa-solid fa-calendar-check mr-2"></i>ยืนยันการจอง');
  }
}

// ============================================================
// GAS API CALL
// ============================================================
async function submitToGAS(data) {
  if (_cfg.GAS_URL === 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL') {
    // Demo mode — simulate a response
    await new Promise(r => setTimeout(r, 1200));
    const prefix = data.type === 'repair' ? 'REP' : 'BK';
    const num = String(Math.floor(Math.random() * 900) + 100);
    const year = new Date().getFullYear();
    const ticket = `${prefix}-${year}-${num}`;
    if (data.type === 'booking') {
      addDemoBooking(data, ticket);
    }
    return ticket;
  }

  const res = await fetch(_cfg.GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' }, // text/plain หลีกเลี่ยง CORS preflight
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Unknown error');
  return json.ticket;
}

// แจ้งซ่อม:  A=เลขที่(0) B=วันที่(1) C=ชื่อ(2) D=เบอร์(3) E=อุปกรณ์(4) F=สถานที่(5) G=อาการ(6) H=รูปภาพ(7) I=สถานะ(8)
// จองห้อง (ใหม่ A:M): E=เวลาเริ่ม(4) F=เวลาสิ้นสุด(5) G=ชื่อ(6) … M=สถานะ(12)
// จองห้อง (เก่า A:L): E=เวลารวม(4) "09:00–10:00" F=ชื่อ(5) … L=สถานะ(11)

// Normalize เวลาที่ Sheets อาจ auto-convert เป็น "8:00 AM" หรือ decimal fraction
function normalizeTime(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  // decimal fraction (UNFORMATTED_VALUE): 0.333… = 08:00
  const n = parseFloat(s);
  if (!isNaN(n) && s === String(n) && n >= 0 && n < 1) {
    const tot = Math.round(n * 1440);
    return `${String(Math.floor(tot / 60)).padStart(2, '0')}:${String(tot % 60).padStart(2, '0')}`;
  }
  // "8:00 AM" / "8:00 PM" / "8:00" / "08:00"
  const m = s.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (m) {
    let h = parseInt(m[1]);
    if (m[3]) {
      if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12;
      if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
    }
    return `${String(h).padStart(2, '0')}:${m[2]}`;
  }
  return s;
}

// ตรวจ format เก่า/ใหม่ จาก column E: เก่า = มี "–", ใหม่ = ไม่มี
function parseBookingRow(r) {
  const isOld = String(r[4] || '').includes('–');
  if (isOld) {
    const [t1 = '', t2 = ''] = String(r[4]).split('–');
    return { ticket: r[0], room: r[2], date: r[3], startTime: normalizeTime(t1), endTime: normalizeTime(t2), name: r[5], status: r[11] };
  }
  return { ticket: r[0], room: r[2], date: r[3], startTime: normalizeTime(r[4]), endTime: normalizeTime(r[5]), name: r[6], status: r[12] };
}

async function fetchStatus(ticket) {
  if (_cfg.GOOGLE_API_KEY === 'YOUR_GOOGLE_API_KEY') {
    await new Promise(r => setTimeout(r, 800));
    return getDemoStatus(ticket);
  }
  const isRepair = ticket.startsWith('REP');
  const rows = await fetchSheetData(isRepair ? _cfg.REPAIR_SHEET : _cfg.BOOKING_SHEET, isRepair ? 'A:I' : 'A:M');
  if (rows.length <= 1) return null;

  const row = rows.slice(1).find(r => r[0] === ticket);
  if (!row) return null;

  if (isRepair) {
    return {
      ticket:      row[0],
      name:        row[2],
      equipment:   row[4],
      location:    row[5],
      description: row[6],
      status:      row[8],
    };
  }
  return parseBookingRow(row);
}

async function fetchByName(name) {
  const rows = await fetchSheetData(_cfg.REPAIR_SHEET, 'A:I');
  if (rows.length <= 1) return [];
  const q = name.toLowerCase();
  return rows.slice(1)
    .filter(r => r[2]?.toLowerCase().includes(q))
    .map(r => ({
      ticket:      r[0],
      name:        r[2],
      equipment:   r[4],
      location:    r[5],
      description: r[6],
      status:      r[8],
    }))
    .reverse();
}

async function fetchBookings(year, month) {
  if (_cfg.GOOGLE_API_KEY === 'YOUR_GOOGLE_API_KEY') {
    return getDemoBookings();
  }
  const rows = await fetchSheetData(_cfg.BOOKING_SHEET, 'A:M');
  if (rows.length <= 1) return [];

  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return rows.slice(1)
    .map(r => parseBookingRow(r))
    .filter(b => b.date?.startsWith(prefix) && b.status !== 'ยกเลิก');
}

// ============================================================
// STATUS TRACKING
// ============================================================
let _prevResultHTML = null; // เก็บ HTML ผลค้นหาก่อนหน้า เพื่อ restore เมื่อกด "กลับ"

async function searchStatus() {
  _prevResultHTML = null; // clear ทุกครั้งที่ search ใหม่
  const query = document.getElementById('ticketInput').value.trim();
  if (!query) { showToast('กรุณากรอกเลขที่ Ticket หรือชื่อผู้แจ้ง', 'error'); return; }

  const resultEl = document.getElementById('statusResult');
  resultEl.innerHTML = '<div class="card text-center py-8"><div class="spinner mb-4"></div><p class="text-slate-500">กำลังค้นหา...</p></div>';
  resultEl.classList.remove('hidden');
  document.getElementById('recentTickets').classList.add('hidden');

  try {
    const isTicket = /^(REP|BK)-/i.test(query);
    if (isTicket) {
      const data = await fetchStatus(query.toUpperCase());
      if (!data) {
        resultEl.innerHTML = notFoundHTML(`ไม่พบ Ticket "${query.toUpperCase()}"`);
        return;
      }
      resultEl.innerHTML = renderStatusCard(data);
    } else {
      const results = await fetchByName(query);
      if (!results.length) {
        resultEl.innerHTML = notFoundHTML(`ไม่พบผู้แจ้งชื่อ "${query}"`);
        return;
      }
      resultEl.innerHTML = renderNameResults(results);
    }
  } catch (err) {
    resultEl.innerHTML = `<div class="card text-center py-6 text-red-600"><i class="fa-solid fa-triangle-exclamation mr-2"></i>เกิดข้อผิดพลาด กรุณาลองใหม่</div>`;
  }
}

async function showTicketDetail(ticket) {
  const resultEl = document.getElementById('statusResult');
  _prevResultHTML = resultEl.innerHTML; // บันทึกผลค้นหาก่อนหน้า
  resultEl.innerHTML = '<div class="card text-center py-8"><div class="spinner mb-4"></div></div>';
  const data = await fetchStatus(ticket);
  resultEl.innerHTML = data ? renderStatusCard(data) : notFoundHTML(`ไม่พบ Ticket "${ticket}"`);
}

async function updateTicketStatus(ticket, newStatus) {
  const label = newStatus === 'ยกเลิก' ? 'ยกเลิก Ticket นี้' : `เปลี่ยนสถานะเป็น "${newStatus}"`;
  if (!confirm(`ยืนยัน${label}?`)) return;

  try {
    await submitToGAS({ type: 'updateStatus', ticket, status: newStatus });
    showToast(`อัปเดตสถานะเป็น "${newStatus}" สำเร็จ`, 'success');
    await showTicketDetail(ticket);
  } catch (err) {
    showToast(err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่', 'error');
  }
}

function notFoundHTML(msg) {
  return `<div class="card text-center py-8">
    <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
      <i class="fa-solid fa-circle-xmark text-red-400 text-3xl"></i>
    </div>
    <h3 class="font-semibold text-slate-700">ไม่พบข้อมูล</h3>
    <p class="text-slate-500 text-sm mt-2">${escHtml(msg)}</p>
    ${backBtn()}
  </div>`;
}

function goBack() {
  const resultEl = document.getElementById('statusResult');
  if (_prevResultHTML) {
    resultEl.innerHTML = _prevResultHTML;
    _prevResultHTML = null;
  } else {
    resultEl.classList.add('hidden');
    document.getElementById('recentTickets').classList.remove('hidden');
  }
}

function backBtn() {
  return `<div class="mt-4"><button onclick="goBack()" class="btn-secondary"><i class="fa-solid fa-arrow-left mr-2"></i>กลับ</button></div>`;
}

function statusStyle(status) {
  return {
    'รับเรื่อง':       { cls: 'status-pending',    icon: 'fa-clock fa-beat',     label: 'รับเรื่อง' },
    'กำลังดำเนินการ': { cls: 'status-inprogress', icon: 'fa-gear fa-spin',      label: 'กำลังดำเนินการ' },
    'เสร็จสิ้น':       { cls: 'status-done',       icon: 'fa-circle-check', label: 'เสร็จสิ้น' },
    'ยกเลิก':          { cls: 'status-cancelled',  icon: 'fa-ban',          label: 'ยกเลิก' },
  }[status] || { cls: 'status-pending', icon: 'fa-clock', label: status || 'รับเรื่อง' };
}

function renderNameResults(results) {
  const rows = results.map(d => {
    const s = statusStyle(d.status);
    return `
      <div class="card mb-3 cursor-pointer hover:shadow-md transition-shadow" onclick="showTicketDetail(${safeAttr(d.ticket)})">
        <div class="flex items-start justify-between gap-3">
          <div class="flex-1 min-w-0">
            <p class="font-bold text-blue-700 text-lg">${escHtml(d.ticket)}</p>
            <p class="text-sm text-slate-700 font-medium mt-0.5">${escHtml(d.name)}</p>
            <p class="text-sm text-slate-500 truncate">${escHtml(d.equipment || '-')}</p>
            <p class="text-xs text-slate-400">${escHtml(d.location || '-')}</p>
          </div>
          <span class="status-badge ${s.cls} shrink-0"><i class="fa-solid ${s.icon}"></i>${escHtml(s.label)}</span>
        </div>
      </div>`;
  }).join('');
  return `
    <div>
      <p class="text-sm text-slate-500 mb-3">พบ <strong>${results.length}</strong> รายการ — กดเพื่อดูรายละเอียด</p>
      ${rows}
      ${backBtn()}
    </div>`;
}

function renderStatusCard(d) {
  const s = statusStyle(d.status);
  const isRepair = d.ticket?.startsWith('REP');

  const allSteps = isRepair
    ? [
        { label: 'รับเรื่อง',       desc: 'ได้รับ Ticket แล้ว'        },
        { label: 'กำลังดำเนินการ', desc: 'ทีมงานกำลังดำเนินการซ่อม'  },
        { label: 'เสร็จสิ้น',       desc: 'ซ่อมเรียบร้อยแล้ว'          },
      ]
    : [
        { label: 'รับเรื่อง',  desc: 'ได้รับคำขอจองแล้ว'       },
        { label: 'ยืนยัน',     desc: 'ทีมงานกำลังตรวจสอบ'       },
        { label: 'เสร็จสิ้น',  desc: 'ยืนยันการจองแล้ว'          },
      ];

  const currentStep = { 'รับเรื่อง': 0, 'กำลังดำเนินการ': 1, 'เสร็จสิ้น': 2, 'ยกเลิก': -1 }[d.status] ?? 0;
  const isCancelled = d.status === 'ยกเลิก';
  const isComplete  = d.status === 'เสร็จสิ้น';

  const stepsHTML = allSteps.map((step, i) => {
    const done   = isComplete || i < currentStep;
    const active = !isCancelled && !isComplete && i === currentStep;

    const circleCls = done
      ? 'bg-blue-600 border-blue-600 text-white'
      : active
        ? 'bg-white border-blue-500 text-blue-600'
        : isCancelled
          ? 'bg-white border-red-300 text-red-300'
          : 'bg-white border-slate-300 text-slate-400';

    const iconInner = done
      ? '<i class="fa-solid fa-check text-xs"></i>'
      : isCancelled
        ? '<i class="fa-solid fa-xmark text-xs"></i>'
        : active
          ? '<span class="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse inline-block"></span>'
          : `<span class="text-xs font-bold">${i + 1}</span>`;

    const labelCls = done ? 'text-blue-700 font-semibold' : active ? 'text-blue-600 font-semibold' : isCancelled ? 'text-red-400' : 'text-slate-400';
    const descCls  = done ? 'text-slate-500' : active ? 'text-slate-500' : 'text-slate-300';
    const lineCls  = done ? 'bg-blue-500' : isCancelled ? 'bg-red-200' : 'bg-slate-200';

    const circleEl = active
      ? `<div class="relative flex-shrink-0">
           <span class="absolute inset-0 rounded-full bg-blue-400 opacity-30 animate-ping"></span>
           <div class="relative w-9 h-9 rounded-full border-2 flex items-center justify-center ${circleCls}">
             ${iconInner}
           </div>
         </div>`
      : `<div class="w-9 h-9 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${circleCls}">
           ${iconInner}
         </div>`;

    return `
      <div class="flex flex-col items-center flex-1 gap-1 min-w-0">
        ${circleEl}
        <p class="text-xs font-medium text-center leading-tight ${labelCls}">${step.label}</p>
        <p class="text-xs text-center leading-tight ${descCls}">${step.desc}</p>
      </div>
      ${i < allSteps.length - 1 ? `<div class="h-0.5 mt-4 flex-shrink-0 w-6 sm:w-10 ${lineCls}"></div>` : ''}
    `;
  }).join('');

  const cancelledBanner = isCancelled
    ? `<div class="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm font-medium">
        <i class="fa-solid fa-ban"></i>Ticket นี้ถูกยกเลิกแล้ว
       </div>`
    : '';

  return `
    <div class="card">
      <div class="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <p class="text-xs text-slate-500 mb-1">เลขที่ Ticket</p>
          <p class="text-2xl font-bold text-blue-700">${escHtml(d.ticket)}</p>
          <p class="text-sm text-slate-500 mt-1">${escHtml(d.name || '')}</p>
        </div>
        <span class="status-badge ${s.cls}">
          <i class="fa-solid ${s.icon}"></i>${s.label}
        </span>
      </div>

      <div class="flex items-start justify-center mb-2">${stepsHTML}</div>
      ${cancelledBanner}

      <div class="grid sm:grid-cols-2 gap-3 text-sm mt-5">
        ${isRepair ? `
          <div class="sm:col-span-2 bg-slate-50 rounded-xl p-3">
            <p class="text-xs text-slate-500 mb-0.5">อุปกรณ์</p>
            <p class="font-medium">${escHtml(d.equipment || '-')}</p>
          </div>
          <div class="sm:col-span-2 bg-slate-50 rounded-xl p-3">
            <p class="text-xs text-slate-500 mb-0.5">สถานที่</p>
            <p class="font-medium">${escHtml(d.location || '-')}</p>
          </div>
          <div class="sm:col-span-2 bg-slate-50 rounded-xl p-3">
            <p class="text-xs text-slate-500 mb-0.5">อาการ / ปัญหา</p>
            <p class="font-medium">${escHtml(d.description || '-')}</p>
          </div>
        ` : `
          <div class="bg-slate-50 rounded-xl p-3">
            <p class="text-xs text-slate-500 mb-0.5">ห้อง</p>
            <p class="font-medium">${escHtml(d.room || '-')}</p>
          </div>
          <div class="bg-slate-50 rounded-xl p-3">
            <p class="text-xs text-slate-500 mb-0.5">วันที่ / เวลา</p>
            <p class="font-medium">${d.date ? formatDateTH(d.date) : '-'}<br>${escHtml(d.startTime || '')} – ${escHtml(d.endTime || '')} น.</p>
          </div>
        `}
      </div>

      <div class="mt-5">${backBtn()}</div>
    </div>`;
}

// ============================================================
// CALENDAR
// ============================================================
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let activeRoomFilter = 'all';
let allBookings = [];

const monthNamesTH = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

async function loadCalendarBookings() {
  try {
    allBookings = await fetchBookings(currentYear, currentMonth + 1);
  } catch {
    allBookings = getDemoBookings();
  }
}

async function renderCalendar() {
  if (!allBookings.length) await loadCalendarBookings();

  const title = `${monthNamesTH[currentMonth]} ${currentYear}`;
  document.getElementById('calendarTitle').textContent = title;

  const grid = document.getElementById('calendarGrid');
  grid.innerHTML = '';

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
  const today = new Date();

  const cells = [];
  for (let i = firstDay - 1; i >= 0; i--) cells.push({ day: prevMonthDays - i, month: 'prev' });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, month: 'current' });
  const remaining = (7 - (cells.length % 7)) % 7;
  for (let d = 1; d <= remaining; d++) cells.push({ day: d, month: 'next' });

  cells.forEach(({ day, month }, idx) => {
    const isCurrent = month === 'current';
    const dateStr = isCurrent
      ? `${currentYear}-${String(currentMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
      : '';
    const isToday = isCurrent && today.getDate() === day && today.getMonth() === currentMonth && today.getFullYear() === currentYear;
    const colIdx = idx % 7;
    const isSunday = colIdx === 0;
    const isSaturday = colIdx === 6;

    const classes = ['cal-day'];
    if (!isCurrent) classes.push('other-month');
    if (isToday) classes.push('today');
    if (isSunday) classes.push('sunday');
    if (isSaturday) classes.push('saturday');

    const cell = document.createElement('div');
    cell.className = classes.join(' ');

    const dayNum = document.createElement('div');
    dayNum.className = 'day-num';
    dayNum.textContent = day;
    cell.appendChild(dayNum);

    if (isCurrent && dateStr) {
      const dayBookings = allBookings.filter(b => b.date === dateStr && (activeRoomFilter === 'all' || b.room === activeRoomFilter));
      dayBookings.slice(0, 3).forEach(b => {
        const ev = document.createElement('div');
        ev.className = `booking-event ${getRoomClass(b.room)}`;
        ev.textContent = `${b.startTime} ${b.room.replace('ห้องประชุม ', 'ห้อง ')}`;
        ev.onclick = () => showEventDetail(b);
        cell.appendChild(ev);
      });
      if (dayBookings.length > 3) {
        const more = document.createElement('div');
        more.className = 'text-xs text-blue-500 font-semibold pl-1 mt-0.5 cursor-pointer hover:underline';
        more.textContent = `+${dayBookings.length - 3} รายการ`;
        more.onclick = (e) => { e.stopPropagation(); showDayDetail(dateStr, dayBookings); };
        cell.appendChild(more);
      }
    }

    grid.appendChild(cell);
  });
}

function getRoomClass(room) {
  const r = ROOMS.find(r => room === r.id || room.includes(r.id) || r.id.includes(room));
  return r ? r.calClass : 'room-a';
}

function initRooms() {
  // Room cards
  const cardsEl = document.getElementById('roomCardsContainer');
  if (cardsEl) {
    cardsEl.innerHTML = ROOMS.map(r => `
      <div class="room-card" onclick="selectRoom('${r.id}')">
        <div class="room-card-icon ${r.iconBg}">
          <i class="fa-solid ${r.icon} ${r.iconColor} text-xl"></i>
        </div>
        <h3 class="font-semibold mt-2">${r.label}</h3>
        <p class="text-slate-500 text-xs mt-1"><i class="fa-solid fa-users mr-1"></i>รองรับ ${r.capacity} คน</p>
        <p class="text-slate-500 text-xs"><i class="fa-solid fa-location-dot mr-1"></i>${r.floor}</p>
        <div class="room-features">
          ${r.features.map(f => `<span class="feature-tag">${f}</span>`).join('')}
        </div>
      </div>`).join('');
  }

  // Select options
  const selectEl = document.getElementById('roomSelect');
  if (selectEl) {
    ROOMS.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = `${r.label} (${r.capacity} คน) — ${r.floor}`;
      selectEl.appendChild(opt);
    });
  }

  // Calendar filter buttons
  const filtersEl = document.getElementById('roomFilters');
  if (filtersEl) {
    ROOMS.forEach(r => {
      const btn = document.createElement('button');
      btn.className = 'room-filter';
      btn.dataset.room = r.id;
      btn.textContent = r.short;
      btn.onclick = () => filterRoom(r.id);
      filtersEl.appendChild(btn);
    });
  }

  // Calendar legend
  const legendEl = document.getElementById('calendarLegend');
  if (legendEl) {
    legendEl.innerHTML = ROOMS.map(r => `
      <div class="flex items-center gap-2 text-sm">
        <div class="booking-event ${r.calClass}" style="padding:0 0.4rem;flex-shrink:0;font-size:0.6rem;white-space:nowrap">${r.short}</div>
      </div>`).join('');
  }
}

document.addEventListener('DOMContentLoaded', initRooms);

function prevMonth() {
  currentMonth--;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  allBookings = [];
  renderCalendar();
}

function nextMonth() {
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  allBookings = [];
  renderCalendar();
}

function filterRoom(room) {
  activeRoomFilter = room;
  document.querySelectorAll('.room-filter').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.room === room);
  });
  renderCalendar();
}

let _modalBookings = [];

function showDayDetail(dateStr, bookings) {
  _modalBookings = bookings;
  document.getElementById('modalTitle').textContent = `รายการจอง — ${formatDateTH(dateStr)}`;
  document.getElementById('modalContent').innerHTML = bookings.map((b, i) => `
    <div class="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer mb-2"
         onclick="showEventDetail(_modalBookings[${i}])">
      <div class="booking-event ${getRoomClass(b.room)} shrink-0" style="margin:0;white-space:nowrap">
        ${escHtml(b.startTime)}–${escHtml(b.endTime)}
      </div>
      <div class="min-w-0">
        <p class="font-semibold text-sm truncate">${escHtml(b.room)}</p>
        <p class="text-xs text-slate-500 truncate">${escHtml(b.name)}</p>
      </div>
    </div>`).join('');
  document.getElementById('eventModal').classList.remove('hidden');
}

function showEventDetail(b) {
  document.getElementById('modalTitle').textContent = b.room;
  document.getElementById('modalContent').innerHTML = `
    <div class="flex items-center gap-2 text-slate-500 text-xs mb-3">
      <span class="inline-block w-3 h-3 rounded-full ${getRoomClass(b.room)}"></span>
      <span>${escHtml(b.room)}</span>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div class="bg-slate-50 rounded-lg p-3">
        <p class="text-xs text-slate-500">วันที่</p>
        <p class="font-semibold">${formatDateTH(b.date)}</p>
      </div>
      <div class="bg-slate-50 rounded-lg p-3">
        <p class="text-xs text-slate-500">เวลา</p>
        <p class="font-semibold">${escHtml(b.startTime)} – ${escHtml(b.endTime)} น.</p>
      </div>
      <div class="col-span-2 bg-slate-50 rounded-lg p-3">
        <p class="text-xs text-slate-500">ผู้จอง</p>
        <p class="font-semibold">${escHtml(b.name)}</p>
      </div>
    </div>`;
  document.getElementById('eventModal').classList.remove('hidden');
}

function closeModal(e) {
  if (e.target.id === 'eventModal') document.getElementById('eventModal').classList.add('hidden');
}

// ============================================================
// HELPERS
// ============================================================
async function refreshBookedSlots() {
  const room  = document.getElementById('roomSelect')?.value;
  const year  = document.getElementById('bookingYear')?.value;
  const month = document.getElementById('bookingMonth')?.value;
  const day   = document.getElementById('bookingDay')?.value;
  const panel = document.getElementById('bookedSlotsPanel');
  if (!panel) return;
  if (!room) { panel.classList.add('hidden'); return; }

  const date = `${year}-${month}-${day}`;

  panel.className = 'sm:col-span-2 p-3 rounded-xl border text-sm bg-slate-50 border-slate-200';
  panel.innerHTML = '<div class="text-xs text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-1"></i>กำลังตรวจสอบช่วงเวลาว่าง...</div>';
  panel.classList.remove('hidden');

  try {
    let bookings;
    if (_cfg.GOOGLE_API_KEY === 'YOUR_GOOGLE_API_KEY') {
      bookings = getDemoBookings().filter(b => b.room === room && b.date === date && b.status !== 'ยกเลิก');
    } else {
      const rows = await fetchSheetData(_cfg.BOOKING_SHEET, 'A:M');
      bookings = rows.slice(1)
        .map(r => parseBookingRow(r))
        .filter(b => b.room === room && b.date === date && b.status !== 'ยกเลิก');
    }
    renderSlotsPanel(panel, bookings);
  } catch {
    panel.classList.add('hidden');
  }
}

function renderSlotsPanel(panel, bookings) {
  if (bookings.length === 0) {
    panel.className = 'sm:col-span-2 p-3 rounded-xl border text-sm bg-green-50 border-green-200';
    panel.innerHTML = '<div class="flex items-center gap-1.5 text-green-700"><i class="fa-solid fa-circle-check"></i><span>ว่างทั้งวัน — สามารถจองได้</span></div>';
  } else {
    panel.className = 'sm:col-span-2 p-3 rounded-xl border text-sm bg-red-50 border-red-200';
    panel.innerHTML = `
      <div class="text-xs font-semibold text-red-600 mb-2"><i class="fa-solid fa-ban mr-1"></i>ช่วงเวลาที่ถูกจองแล้ว — เลือกเวลาอื่น</div>
      <div class="space-y-1">
        ${bookings.sort((a,b) => a.startTime.localeCompare(b.startTime)).map(b => `
          <div class="flex items-center gap-2">
            <i class="fa-solid fa-clock text-red-400 text-xs flex-shrink-0"></i>
            <span class="font-semibold text-red-700">${escHtml(b.startTime)} – ${escHtml(b.endTime)} น.</span>
            <span class="text-slate-500">· ${escHtml(b.name)}</span>
          </div>`).join('')}
      </div>`;
  }
}

function updateEquipmentOptions(roomId) {
  const container = document.getElementById('equipmentCheckboxes');
  if (!container) return;
  const room = ROOMS.find(r => r.id === roomId);
  if (!room) {
    container.innerHTML = '<p class="text-slate-400 text-sm italic">กรุณาเลือกห้องประชุมก่อน</p>';
    document.getElementById('bookedSlotsPanel')?.classList.add('hidden');
    return;
  }
  refreshBookedSlots();
  const checkboxes = room.features.map(f => `
    <label class="flex items-center gap-2 text-sm cursor-pointer">
      <input type="checkbox" name="equipment" value="${f}" class="accent-blue-600" />${f}
    </label>`).join('');
  container.innerHTML = `
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">${checkboxes}
      <label class="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" name="equipment" value="อื่นๆ" class="accent-blue-600" onchange="toggleEquipmentOtherBooking(this)" />⚙️ อื่นๆ
      </label>
    </div>
    <input type="text" id="equipmentOtherBooking" name="equipmentOther" class="form-input mt-2 hidden" placeholder="ระบุอุปกรณ์เพิ่มเติม" />`;
}

function toggleEquipmentOtherBooking(cb) {
  const el = document.getElementById('equipmentOtherBooking');
  el.classList.toggle('hidden', !cb.checked);
  el.required = cb.checked;
}

function selectRoom(roomName) {
  document.querySelectorAll('.room-card').forEach(c => c.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
  document.getElementById('roomSelect').value = roomName;
  document.getElementById('tab-booking').querySelector('[name="room"]').value = roomName;
  updateEquipmentOptions(roomName);
}

function clearRoomSelection() {
  document.querySelectorAll('.room-card').forEach(c => c.classList.remove('selected'));
}

function setLoading(btn, loading, label) {
  btn.disabled = loading;
  btn.innerHTML = loading
    ? '<span class="spinner" style="width:1.25rem;height:1.25rem;border-width:2px;display:inline-block;margin-right:0.5rem"></span>กำลังดำเนินการ...'
    : label;
}

function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  const icons = { success: 'fa-circle-check', error: 'fa-triangle-exclamation', info: 'fa-circle-info' };
  const item = document.createElement('div');
  item.className = `toast-item toast-${type}`;
  item.innerHTML = `<i class="fa-solid ${icons[type]}"></i><span>${escHtml(msg)}</span>`;
  toast.classList.remove('hidden');
  toast.appendChild(item);
  setTimeout(() => { item.remove(); if (!toast.children.length) toast.classList.add('hidden'); }, 4000);
}

function showSuccess(title, message, ticket, note) {
  document.getElementById('successTitle').textContent = title;
  document.getElementById('successMessage').textContent = message;
  document.getElementById('successTicket').textContent = ticket;
  document.getElementById('successNote').textContent = note;
  document.getElementById('successModal').classList.remove('hidden');
}

function previewImage(input, previewId) {
  const preview = document.getElementById(previewId);
  const img = document.getElementById(previewId + 'Img');
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = e => { img.src = e.target.result; preview.classList.remove('hidden'); };
    reader.readAsDataURL(input.files[0]);
  }
}

function formatDateTH(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d} ${monthNamesTH[m - 1]} ${y}`;
}

// ============================================================
// DEMO DATA (used when GAS_URL is not configured)
// ============================================================
let demoBookings = [
  { ticket:'BK-2025-001', date:`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`, room:'ห้องประชุม A', startTime:'09:00', endTime:'11:00', name:'นายสมชาย ใจดี', department:'กลุ่มสาระวิทยาศาสตร์', purpose:'ประชุมกลุ่มสาระประจำเดือน', attendees:15 },
  { ticket:'BK-2025-002', date:`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`, room:'ห้องประชุม C (ใหญ่)', startTime:'13:00', endTime:'16:00', name:'นางสาวสุภาพร มีทอง', department:'ฝ่ายวิชาการ', purpose:'ประชุมผู้ปกครองนักเรียน', attendees:40 },
];

function getDemoBookings() {
  return demoBookings;
}

function addDemoBooking(data, ticket) {
  demoBookings.push({
    ticket,
    date: data.date,
    room: data.room,
    startTime: data.startTime,
    endTime: data.endTime,
    name: data.name,
    department: data.department,
    purpose: data.purpose,
    attendees: data.attendees,
  });
}

function getDemoStatus(ticket) {
  if (ticket.startsWith('REP')) {
    const statuses = ['รับเรื่อง', 'กำลังดำเนินการ', 'เสร็จสิ้น', 'ยกเลิก'];
    return {
      ticket,
      name: 'ตัวอย่าง ทดสอบ',
      equipment: 'โปรเจกเตอร์',
      location: 'อาคาร SAVIO ชั้น 3 ห้อง 301',
      description: 'โปรเจกเตอร์ไม่สามารถเชื่อมต่อกับคอมพิวเตอร์ได้',
      status: statuses[parseInt(ticket.slice(-1)) % 4],
    };
  }
  if (ticket.startsWith('BK')) {
    const statuses = ['รับเรื่อง', 'กำลังดำเนินการ', 'เสร็จสิ้น', 'ยกเลิก'];
    return {
      ticket,
      name: 'ตัวอย่าง ทดสอบ',
      room: 'ห้องประชุมอัลเบรา',
      date: new Date().toISOString().split('T')[0],
      startTime: '10:00',
      endTime: '12:00',
      purpose: 'ประชุมทีม (ตัวอย่าง)',
      status: statuses[parseInt(ticket.slice(-1)) % 4],
    };
  }
  return null;
}

// วันนี้ และ max = วันนี้ + 2 ปี (คำนวณครั้งเดียว)
const _bookingToday   = new Date();
const _bookingMaxDate = new Date(
  _bookingToday.getFullYear() + 2,
  _bookingToday.getMonth(),
  _bookingToday.getDate()
);

function updateMonths() {
  const yearSel  = document.getElementById('bookingYear');
  const monthSel = document.getElementById('bookingMonth');
  if (!yearSel || !monthSel) return;
  const y    = parseInt(yearSel.value);
  const minM = (y === _bookingToday.getFullYear())   ? _bookingToday.getMonth() + 1   : 1;
  const maxM = (y === _bookingMaxDate.getFullYear()) ? _bookingMaxDate.getMonth() + 1 : 12;
  const prev = parseInt(monthSel.value);
  monthSel.innerHTML = '';
  for (let m = minM; m <= maxM; m++) {
    const opt = document.createElement('option');
    opt.value = String(m).padStart(2, '0');
    opt.textContent = monthNamesTH[m - 1];
    monthSel.appendChild(opt);
  }
  monthSel.value = String(
    (prev >= minM && prev <= maxM) ? prev : minM
  ).padStart(2, '0');
  updateDays();
}

function updateDays() {
  const daySel   = document.getElementById('bookingDay');
  const monthSel = document.getElementById('bookingMonth');
  const yearSel  = document.getElementById('bookingYear');
  if (!daySel || !monthSel || !yearSel) return;
  const y = parseInt(yearSel.value);
  const m = parseInt(monthSel.value);
  const daysInMonth = new Date(y, m, 0).getDate();
  const minD = (y === _bookingToday.getFullYear()   && m === _bookingToday.getMonth() + 1)   ? _bookingToday.getDate()   : 1;
  const maxD = (y === _bookingMaxDate.getFullYear() && m === _bookingMaxDate.getMonth() + 1) ? _bookingMaxDate.getDate() : daysInMonth;
  const prev = parseInt(daySel.value);
  daySel.innerHTML = '';
  for (let d = minD; d <= maxD; d++) {
    const opt = document.createElement('option');
    opt.value = opt.textContent = String(d).padStart(2, '0');
    daySel.appendChild(opt);
  }
  daySel.value = String(
    (prev >= minD && prev <= maxD) ? prev : minD
  ).padStart(2, '0');
  refreshBookedSlots();
}

function countChars(el) {
  const counter = el.parentElement.querySelector('.char-counter');
  if (!counter) return;
  const n = el.value.length;
  const max = el.maxLength;
  counter.textContent = `${n}/${max}`;
  counter.classList.toggle('char-counter-warn', n >= max * 0.9);
}

function toggleEquipmentOther(select) {
  const other = document.getElementById('equipmentOther');
  const isOther = select.value === 'อื่นๆ';
  other.classList.toggle('hidden', !isOther);
  other.required = isOther;
  if (!isOther) other.value = '';
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Populate booking date selects (วว/ดด/ปปปป) — min=วันนี้, max=วันนี้+2ปี
  const yearSel = document.getElementById('bookingYear');
  if (yearSel) {
    for (let y = _bookingToday.getFullYear(); y <= _bookingMaxDate.getFullYear(); y++) {
      const opt = document.createElement('option');
      opt.value = opt.textContent = String(y);
      yearSel.appendChild(opt);
    }
    yearSel.value = String(_bookingToday.getFullYear());
  }
  // months และ days ถูก populate โดย updateMonths() → updateDays()
  updateMonths();
  const daySel = document.getElementById('bookingDay');
  if (daySel) daySel.value = String(_bookingToday.getDate()).padStart(2, '0');

  // Populate 24-hour time selects
  const hourSelects = ['startHour', 'endHour'];
  const minSelects  = ['startMin',  'endMin'];
  const defaults    = { startHour: '08', startMin: '00', endHour: '09', endMin: '00' };

  hourSelects.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    for (let h = 0; h < 24; h++) {
      const opt = document.createElement('option');
      opt.value = opt.textContent = String(h).padStart(2, '0');
      sel.appendChild(opt);
    }
    sel.value = defaults[id];
  });

  minSelects.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    ['00', '15', '30', '45'].forEach(m => {
      const opt = document.createElement('option');
      opt.value = opt.textContent = m;
      sel.appendChild(opt);
    });
    sel.value = defaults[id];
  });

  // Init calendar data in background
  loadCalendarBookings();
});
