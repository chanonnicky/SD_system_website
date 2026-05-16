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

  if (tabName === 'calendar') renderCalendar();
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

  if (!validatePhone(form.phone.value.trim())) {
    showToast('เบอร์โทรติดต่อไม่ถูกต้อง กรุณากรอกเบอร์ 9-10 หลัก', 'error');
    return;
  }

  const startTime = form.startTime.value;
  const endTime = form.endTime.value;
  if (startTime >= endTime) {
    showToast('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น', 'error');
    return;
  }

  const bookingDate = new Date(form.date.value);
  const today = new Date(); today.setHours(0,0,0,0);
  if (bookingDate < today) {
    showToast('ไม่สามารถจองย้อนหลังได้', 'error');
    return;
  }

  const otherEquipment = form.equipmentOther?.value.trim();
  const checkedEquipment = [...form.querySelectorAll('input[name="equipment"]:checked')]
    .map(el => el.value === 'อื่นๆ' && otherEquipment ? `อื่นๆ (${otherEquipment})` : el.value)
    .join(', ');

  const data = {
    type: 'booking',
    name: form.name.value.trim(),
    phone: form.phone.value.trim(),
    attendees: form.attendees.value,
    room: form.room.value,
    date: form.date.value,
    startTime,
    endTime,
    purpose: form.purpose.value.trim(),
    equipment: checkedEquipment,
    note: form.note.value.trim(),
    timestamp: new Date().toISOString(),
  };

  setLoading(btn, true, 'กำลังจอง...');

  try {
    const ticket = await submitToGAS(data);
    clearRoomSelection();
    form.reset();
    // Refresh calendar bookings
    await loadCalendarBookings();
    showSuccess(
      'จองห้องสำเร็จ!',
      `ห้อง "${data.room}" วันที่ ${formatDateTH(data.date)} เวลา ${data.startTime}–${data.endTime} น.`,
      ticket,
      'ทีมงานจะยืนยันการจองผ่าน LINE Official Account'
    );
  } catch (err) {
    showToast('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', 'error');
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
// จองห้อง:   A=เลขที่(0) B=วันที่จอง(1) C=ห้อง(2) D=วันที่ใช้(3) E=เวลา(4) F=ชื่อ(5) G=เบอร์(6) H=จำนวน(7) I=วัตถุประสงค์(8) J=อุปกรณ์(9) K=หมายเหตุ(10) L=สถานะ(11)
async function fetchStatus(ticket) {
  if (_cfg.GOOGLE_API_KEY === 'YOUR_GOOGLE_API_KEY') {
    await new Promise(r => setTimeout(r, 800));
    return getDemoStatus(ticket);
  }
  const isRepair = ticket.startsWith('REP');
  const rows = await fetchSheetData(isRepair ? _cfg.REPAIR_SHEET : _cfg.BOOKING_SHEET, isRepair ? 'A:I' : 'A:L');
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
  const [startTime = '', endTime = ''] = (row[4] || '').split('–');
  return {
    ticket:    row[0],
    room:      row[2],
    date:      row[3],
    startTime,
    endTime,
    name:      row[5],
    status:    row[11],
  };
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
  const rows = await fetchSheetData(_cfg.BOOKING_SHEET, 'A:L');
  if (rows.length <= 1) return [];

  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return rows.slice(1)
    .filter(r => r[3]?.startsWith(prefix) && r[11] !== 'ยกเลิก')
    .map(r => {
      const [startTime = '', endTime = ''] = (r[4] || '').split('–');
      return {
        ticket:    r[0],
        room:      r[2],
        date:      r[3],
        startTime,
        endTime,
        name:      r[5],
      };
    });
}

// ============================================================
// STATUS TRACKING
// ============================================================
async function searchStatus() {
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
  resultEl.innerHTML = '<div class="card text-center py-8"><div class="spinner mb-4"></div></div>';
  const data = await fetchStatus(ticket);
  resultEl.innerHTML = data ? renderStatusCard(data) : notFoundHTML(`ไม่พบ Ticket "${ticket}"`);
}

function notFoundHTML(msg) {
  return `<div class="card text-center py-8">
    <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
      <i class="fa-solid fa-circle-xmark text-red-400 text-3xl"></i>
    </div>
    <h3 class="font-semibold text-slate-700">ไม่พบข้อมูล</h3>
    <p class="text-slate-500 text-sm mt-2">${msg}</p>
    ${backBtn()}
  </div>`;
}

function backBtn() {
  return `<div class="mt-4"><button onclick="document.getElementById('statusResult').classList.add('hidden');document.getElementById('recentTickets').classList.remove('hidden')" class="btn-secondary"><i class="fa-solid fa-arrow-left mr-2"></i>กลับ</button></div>`;
}

function statusStyle(status) {
  return {
    'รับเรื่อง':       { cls: 'status-pending',    icon: 'fa-clock',        label: 'รับเรื่อง' },
    'กำลังดำเนินการ': { cls: 'status-inprogress', icon: 'fa-gear fa-spin', label: 'กำลังดำเนินการ' },
    'เสร็จสิ้น':       { cls: 'status-done',       icon: 'fa-circle-check', label: 'เสร็จสิ้น' },
    'ยกเลิก':          { cls: 'status-cancelled',  icon: 'fa-ban',          label: 'ยกเลิก' },
  }[status] || { cls: 'status-pending', icon: 'fa-clock', label: status || 'รับเรื่อง' };
}

function renderNameResults(results) {
  const rows = results.map(d => {
    const s = statusStyle(d.status);
    return `
      <div class="card mb-3 cursor-pointer hover:shadow-md transition-shadow" onclick="showTicketDetail('${d.ticket}')">
        <div class="flex items-start justify-between gap-3">
          <div class="flex-1 min-w-0">
            <p class="font-bold text-blue-700 text-lg">${d.ticket}</p>
            <p class="text-sm text-slate-700 font-medium mt-0.5">${d.name}</p>
            <p class="text-sm text-slate-500 truncate">${d.equipment || '-'}</p>
            <p class="text-xs text-slate-400">${d.location || '-'}</p>
          </div>
          <span class="status-badge ${s.cls} shrink-0"><i class="fa-solid ${s.icon}"></i>${s.label}</span>
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

  const steps = isRepair
    ? ['รับเรื่อง', 'กำลังดำเนินการ', 'เสร็จแล้ว']
    : ['รับจอง', 'ยืนยัน', 'เสร็จแล้ว'];

  const stepIdx = isRepair
    ? { 'รับเรื่อง': 1, 'กำลังดำเนินการ': 2, 'เสร็จสิ้น': 3, 'ยกเลิก': 0 }[d.status] ?? 1
    : { 'รับเรื่อง': 1, 'กำลังดำเนินการ': 2, 'เสร็จสิ้น': 3, 'ยกเลิก': 0 }[d.status] ?? 1;

  const stepsHTML = steps.map((step, i) => `
    <div class="flex flex-col items-center gap-1 flex-1">
      <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${i < stepIdx ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'}">
        ${i < stepIdx ? '<i class="fa-solid fa-check text-xs"></i>' : i + 1}
      </div>
      <span class="text-xs text-center ${i < stepIdx ? 'text-blue-700 font-medium' : 'text-slate-400'}">${step}</span>
    </div>
    ${i < steps.length - 1 ? `<div class="flex-1 h-0.5 mt-4 ${i < stepIdx - 1 ? 'bg-blue-600' : 'bg-slate-200'}"></div>` : ''}
  `).join('');

  return `
    <div class="card">
      <div class="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <p class="text-xs text-slate-500 mb-1">เลขที่ Ticket</p>
          <p class="text-2xl font-bold text-blue-700">${d.ticket}</p>
          <p class="text-sm text-slate-500 mt-1">${d.name || ''}</p>
        </div>
        <span class="status-badge ${s.cls}">
          <i class="fa-solid ${s.icon}"></i>${s.label}
        </span>
      </div>

      <div class="flex items-center mb-6">${stepsHTML}</div>

      <div class="grid sm:grid-cols-2 gap-3 text-sm">
        ${isRepair ? `
          <div class="sm:col-span-2 bg-slate-50 rounded-xl p-3">
            <p class="text-xs text-slate-500 mb-0.5">อุปกรณ์</p>
            <p class="font-medium">${d.equipment || '-'}</p>
          </div>
          <div class="sm:col-span-2 bg-slate-50 rounded-xl p-3">
            <p class="text-xs text-slate-500 mb-0.5">สถานที่</p>
            <p class="font-medium">${d.location || '-'}</p>
          </div>
          <div class="sm:col-span-2 bg-slate-50 rounded-xl p-3">
            <p class="text-xs text-slate-500 mb-0.5">อาการ / ปัญหา</p>
            <p class="font-medium">${d.description || '-'}</p>
          </div>
        ` : `
          <div class="bg-slate-50 rounded-xl p-3">
            <p class="text-xs text-slate-500 mb-0.5">ห้อง</p>
            <p class="font-medium">${d.room || '-'}</p>
          </div>
          <div class="bg-slate-50 rounded-xl p-3">
            <p class="text-xs text-slate-500 mb-0.5">วันที่ / เวลา</p>
            <p class="font-medium">${d.date ? formatDateTH(d.date) : '-'}<br>${d.startTime || ''} – ${d.endTime || ''} น.</p>
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

  const title = `${monthNamesTH[currentMonth]} ${currentYear + 543}`;
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
        more.className = 'text-xs text-slate-400 pl-1 mt-0.5';
        more.textContent = `+${dayBookings.length - 3} รายการ`;
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
        <div class="w-4 h-4 rounded booking-event ${r.calClass}" style="padding:0"></div>
        <span class="text-slate-600">${r.label}</span>
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

function showEventDetail(b) {
  document.getElementById('modalTitle').textContent = b.room;
  document.getElementById('modalContent').innerHTML = `
    <div class="flex items-center gap-2 text-slate-500 text-xs mb-3">
      <span class="inline-block w-3 h-3 rounded-full ${getRoomClass(b.room)}"></span>
      <span>${b.room}</span>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div class="bg-slate-50 rounded-lg p-3">
        <p class="text-xs text-slate-500">วันที่</p>
        <p class="font-semibold">${formatDateTH(b.date)}</p>
      </div>
      <div class="bg-slate-50 rounded-lg p-3">
        <p class="text-xs text-slate-500">เวลา</p>
        <p class="font-semibold">${b.startTime} – ${b.endTime} น.</p>
      </div>
      <div class="col-span-2 bg-slate-50 rounded-lg p-3">
        <p class="text-xs text-slate-500">ผู้จอง</p>
        <p class="font-semibold">${b.name}</p>
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
function updateEquipmentOptions(roomId) {
  const container = document.getElementById('equipmentCheckboxes');
  if (!container) return;
  const room = ROOMS.find(r => r.id === roomId);
  if (!room) {
    container.innerHTML = '<p class="text-slate-400 text-sm italic">กรุณาเลือกห้องประชุมก่อน</p>';
    return;
  }
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
  item.innerHTML = `<i class="fa-solid ${icons[type]}"></i><span>${msg}</span>`;
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
  return `${d} ${monthNamesTH[m - 1]} ${y + 543}`;
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
    const statuses = ['รอดำเนินการ', 'กำลังดำเนินการ', 'เสร็จสิ้น'];
    return {
      ticket,
      name: 'ตัวอย่าง ทดสอบ',
      department: 'กลุ่มสาระวิทยาศาสตร์',
      equipment: 'โปรเจกเตอร์',
      description: 'โปรเจกเตอร์ไม่สามารถเชื่อมต่อกับคอมพิวเตอร์ได้',
      status: statuses[Math.floor(Math.random() * 3)],
    };
  }
  if (ticket.startsWith('BK')) {
    return {
      ticket,
      name: 'ตัวอย่าง ทดสอบ',
      department: 'ฝ่ายวิชาการ',
      room: 'ห้องประชุม A',
      date: new Date().toISOString().split('T')[0],
      startTime: '10:00',
      endTime: '12:00',
      purpose: 'ประชุมทีม (ตัวอย่าง)',
      status: 'กำลังดำเนินการ',
    };
  }
  return null;
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
  // Set min date for booking to today
  const dateInput = document.getElementById('bookingDate');
  if (dateInput) {
    dateInput.min = new Date().toISOString().split('T')[0];
  }
  // Init calendar data in background
  loadCalendarBookings();
});
