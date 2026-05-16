// ============================================================
// Google Apps Script — AV Department Web App Backend
// ============================================================
// หน้าที่: รับ POST (บันทึกข้อมูลลง Sheets + ส่ง LINE Flex Message)
// การอ่านข้อมูล (ติดตามสถานะ / ปฏิทิน) ทำผ่าน Google Sheets API v4
// โดยตรงจาก frontend ด้วย API Key แทน
//
// วิธีติดตั้ง:
// 1. ไปที่ script.google.com > New Project
// 2. วางโค้ดนี้ แล้วแก้ไขค่าใน CONFIG ด้านล่าง
// 3. Deploy > New Deployment > Web App
//    - Execute as: Me
//    - Who has access: Anyone
// 4. คัดลอก Web App URL ไปใส่ใน assets/js/config.js → GAS_URL
// 5. ตั้งค่า Spreadsheet เป็น "Anyone with the link can view"
//    เพื่อให้ Google Sheets API Key อ่านได้
// ============================================================

// ============================================================
// CONFIG — ค่าจาก GAS Script Properties (Project Settings > Script Properties)
// ⚠️  SECURITY: ตั้งค่าต่อไปนี้ใน Script Properties แล้วลบ fallback ออก:
//     SPREADSHEET_ID, LINE_TOKEN
//     หลังตั้งค่าแล้วให้ rotate LINE_TOKEN ใน LINE Developers Console ด้วย
//     (LINE Developers > Messaging API > Channel access token > Issue new token)
// ============================================================
const _props = PropertiesService.getScriptProperties().getProperties();
const CONFIG = {
  SPREADSHEET_ID: _props.SPREADSHEET_ID || '1rHGjwT6ZBf0qryjXahaw1RUve3ozvbIB89u3gSYzhbU',
  LINE_TOKEN:     _props.LINE_TOKEN     || 'kZDmkCpgVMDKGFDn3u0doCpZ9IiqpK4TvzULDxa9Sw7N02Btc/0MRxViBHBR6xMwsOO7kWeQWoEwCwwPctm/o+wKFDJp1J+BySHDDj9PDiq5jyMYqPa6+h7WCJCNYTU3kSljs22vMdFZTV5yVz1/hAdB04t89/1O/w1cDnyilFU=',
  REPAIR_SHEET:   'แจ้งซ่อม',
  BOOKING_SHEET:  'จองห้องประชุม',
  SHEET_URL:      'https://docs.google.com/spreadsheets/d/1rHGjwT6ZBf0qryjXahaw1RUve3ozvbIB89u3gSYzhbU/edit',
  WEBHOOK_SECRET:  _props.WEBHOOK_SECRET || '', // ตั้งค่าใน Script Properties → ป้องกัน URL ปุ่ม LINE ถูกเดา
  CLIENT_SECRET:   _props.CLIENT_SECRET  || '', // ตั้งค่าใน Script Properties + GitHub Secret CLIENT_SECRET
  MINI_APP_ID:    '2010102800-8WvwvjA4',
};

// ============================================================
// แจ้งซ่อม — Column layout (A:I)
// A=เลขที่  B=วันที่แจ้ง  C=ชื่อผู้แจ้ง  D=เบอร์โทร
// E=อุปกรณ์  F=สถานที่  G=อาการ  H=รูปภาพ  I=สถานะ
// ============================================================

// จองห้องประชุม — Column layout (A:M)
// A=เลขที่  B=วันที่จอง  C=ห้อง  D=วันที่ใช้ห้อง  E=เวลาเริ่ม  F=เวลาสิ้นสุด
// G=ชื่อผู้จอง  H=เบอร์โทร  I=จำนวนผู้เข้าร่วม
// J=วัตถุประสงค์  K=อุปกรณ์  L=หมายเหตุ  M=สถานะ
// ============================================================

// ============================================================
// doGet — อัปเดตสถานะผ่าน LIFF (กดปุ่มใน LINE card)
// ============================================================
function htmlEscape(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function doGet(e) {
  let params = e.parameter || {};

  if (!params.action && params['liff.state']) {
    try {
      const liffState = decodeURIComponent(params['liff.state']);
      const qs = liffState.slice(liffState.indexOf('?') + 1);
      const parsed = {};
      qs.split('&').forEach(pair => {
        const [k, v] = pair.split('=');
        if (k) parsed[decodeURIComponent(k)] = decodeURIComponent(v || '');
      });
      params = Object.assign({}, params, parsed);
    } catch (_) {}
  }

  if (params.action === 'updateStatus' && params.ticket && params.status) {
    if (CONFIG.WEBHOOK_SECRET && params.secret !== CONFIG.WEBHOOK_SECRET) {
      return HtmlService.createHtmlOutput(
        '<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fef2f2">' +
        '<div style="text-align:center;padding:2rem"><div style="font-size:2.5rem">🔒</div>' +
        '<p style="color:#dc2626;font-weight:600">ไม่มีสิทธิ์เข้าถึง</p>' +
        '<p style="color:#6b7280;font-size:.85rem">Unauthorized</p></div></body></html>'
      );
    }
    const updated = updateRepairStatus(params.ticket, params.status);

    if (updated) {
      const ticketData = getTicketData(params.ticket);
      if (ticketData) sendLineFlex(buildStatusUpdateFlex(ticketData));
    }

    const statusConfig = {
      'รับเรื่อง':        { label: '🟡 รับเรื่อง',        color: '#d97706', bg: '#fffbeb' },
      'กำลังดำเนินการ':  { label: '🔵 กำลังดำเนินการ',  color: '#1d4ed8', bg: '#eff6ff' },
      'เสร็จสิ้น':        { label: '✅ เสร็จสิ้น',        color: '#059669', bg: '#f0fdf4' },
      'ยกเลิก':           { label: '❌ ยกเลิก',           color: '#dc2626', bg: '#fef2f2' },
    }[params.status] || { label: params.status, color: '#6b7280', bg: '#f9fafb' };

    const liffScript = CONFIG.MINI_APP_ID
      ? `<script charset="utf-8" src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
         <script>liff.init({liffId:'${CONFIG.MINI_APP_ID}'}).then(()=>setTimeout(()=>liff.closeWindow(),1200)).catch(()=>{});</script>`
      : '';

    const html = updated
      ? `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
         ${liffScript}
         <style>*{box-sizing:border-box}body{font-family:'Helvetica Neue',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:${statusConfig.bg}}
         .card{text-align:center;padding:2rem 1.5rem;background:#fff;border-radius:1.25rem;box-shadow:0 8px 24px rgba(0,0,0,.08);max-width:300px;width:90%}
         .icon{font-size:3.5rem;margin-bottom:.5rem}.ticket{font-size:.8rem;color:#9ca3af;margin-bottom:.75rem}
         .status{font-size:1.1rem;font-weight:700;color:${statusConfig.color};background:${statusConfig.bg};border:2px solid ${statusConfig.color}33;border-radius:.75rem;padding:.5rem 1rem;display:inline-block}
         .hint{margin-top:1.25rem;font-size:.72rem;color:#9ca3af}</style></head>
         <body><div class="card">
         <div class="icon">✅</div>
         <div class="ticket">${htmlEscape(params.ticket)}</div>
         <div class="status">${htmlEscape(statusConfig.label)}</div>
         <p class="hint">${CONFIG.MINI_APP_ID ? 'กำลังปิดหน้าต่าง...' : 'ปิดหน้าต่างนี้ได้เลย'}</p>
         </div></body></html>`
      : `<!doctype html><html><head><meta charset="utf-8">${liffScript}</head>
         <body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fef2f2">
         <div style="text-align:center;padding:2rem;background:#fff;border-radius:1rem;box-shadow:0 4px 12px rgba(0,0,0,.1)">
         <div style="font-size:2.5rem">❌</div><p style="color:#dc2626;font-weight:600">ไม่พบ Ticket</p>
         <p style="color:#6b7280;font-size:.85rem">${htmlEscape(params.ticket)}</p></div></body></html>`;

    return HtmlService.createHtmlOutput(html);
  }

  return HtmlService.createHtmlOutput('<p>AV Web App — GAS Backend</p>');
}

// ============================================================
// HANDLE POST REQUESTS
// ============================================================
function doPost(e) {
  let result;

  try {
    const body = JSON.parse(e.postData.contents);

    if (body.events) {
      handleLineWebhook(body.events);
      return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
    }

    if (CONFIG.CLIENT_SECRET && body.secret !== CONFIG.CLIENT_SECRET) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (body.type === 'repair') {
      result = handleRepair(body);
    } else if (body.type === 'booking') {
      result = handleBooking(body);
    } else if (body.type === 'updateStatus') {
      result = handleUpdateStatus(body);
    } else {
      result = { success: false, error: 'Unknown type' };
    }
  } catch (err) {
    result = { success: false, error: err.message };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// LINE WEBHOOK
// ============================================================
function handleLineWebhook(events) {
  for (const ev of events) {
    if (ev.type === 'postback') handlePostback(ev);
  }
}

function handlePostback(ev) {
  const params = Object.fromEntries(ev.postback.data.split('&').map(p => p.split('=')));
  if (params.action !== 'updateStatus') return;

  const { ticket, status } = params;
  const updated = updateRepairStatus(ticket, status);

  const statusLabel = {
    'รับเรื่อง':       '🟡 รับเรื่อง',
    'กำลังดำเนินการ': '🔵 กำลังดำเนินการ',
    'เสร็จสิ้น':       '✅ เสร็จสิ้น',
    'ยกเลิก':          '❌ ยกเลิก',
  }[status] || status;

  const msg = updated
    ? `อัปเดตสถานะ ${ticket} เป็น ${statusLabel} แล้ว`
    : `❌ ไม่พบ Ticket ${ticket}`;

  replyLineMessage(ev.replyToken, msg);
}

function updateRepairStatus(ticket, newStatus) {
  const ss        = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const isRepair  = String(ticket).startsWith('REP');
  const sheetName = isRepair ? CONFIG.REPAIR_SHEET : CONFIG.BOOKING_SHEET;
  const statusCol = isRepair ? 9 : 13; // repair=I(9), booking=M(13)
  const sheet     = ss.getSheetByName(sheetName);
  if (!sheet) return false;

  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(ticket)) {
      sheet.getRange(i + 1, statusCol).setValue(newStatus);
      return true;
    }
  }
  return false;
}

function handleUpdateStatus(data) {
  const ticket   = String(data.ticket  || '').trim();
  const newStatus = String(data.status || '').trim();
  const allowed  = ['รับเรื่อง', 'กำลังดำเนินการ', 'เสร็จสิ้น', 'ยกเลิก'];
  if (!ticket || !allowed.includes(newStatus)) {
    return { success: false, error: 'ข้อมูลไม่ถูกต้อง' };
  }

  const ss        = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const isRepair  = ticket.startsWith('REP');
  const sheetName = isRepair ? CONFIG.REPAIR_SHEET : CONFIG.BOOKING_SHEET;
  const statusCol = isRepair ? 9 : 13; // repair=I(9), booking=M(13)
  const sheet     = ss.getSheetByName(sheetName);
  if (!sheet) return { success: false, error: 'ไม่พบ Sheet' };

  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === ticket) {
      sheet.getRange(i + 1, statusCol).setValue(newStatus);
      return { success: true };
    }
  }
  return { success: false, error: `ไม่พบ Ticket ${ticket}` };
}

function replyLineMessage(replyToken, text) {
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: `Bearer ${CONFIG.LINE_TOKEN}` },
    payload: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
    muteHttpExceptions: true,
  };
  try {
    UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', options);
  } catch (err) {
    Logger.log('Reply error: ' + err.message);
  }
}

// ============================================================
// REPAIR HANDLER
// A=เลขที่ B=วันที่แจ้ง C=ชื่อผู้แจ้ง D=เบอร์โทร
// E=อุปกรณ์ F=สถานที่ G=อาการ H=รูปภาพ I=สถานะ
// ============================================================
function handleRepair(data) {
  const phone = String(data.phone || '').replace(/[\s\-]/g, '');
  if (!data.name || !data.phone || !data.equipment || !data.location || !data.description)
    return { success: false, error: 'กรุณากรอกข้อมูลให้ครบถ้วน' };
  if (!/^((\+66|0066)?\d{9}|0\d{8,9})$/.test(phone))
    return { success: false, error: 'เบอร์โทรไม่ถูกต้อง' };
  if (String(data.name).length > 100 || String(data.description).length > 2000)
    return { success: false, error: 'ข้อมูลยาวเกินกำหนด' };

  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.REPAIR_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.REPAIR_SHEET);
    sheet.appendRow(['เลขที่', 'วันที่แจ้ง', 'ชื่อผู้แจ้ง', 'เบอร์โทร', 'อุปกรณ์', 'สถานที่', 'อาการ', 'รูปภาพ', 'สถานะ']);
    sheet.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#1d4ed8').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }

  const lastRow = sheet.getLastRow();
  const year = new Date().getFullYear();
  const ticket = `REP-${year}-${String(lastRow).padStart(3, '0')}`;
  const dateStr = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm');

  let imageUrl = '';
  if (data.imageBase64) imageUrl = saveImageToDrive(data.imageBase64, ticket);

  sheet.appendRow([
    ticket,               // A เลขที่
    dateStr,              // B วันที่แจ้ง
    data.name    || '',   // C ชื่อผู้แจ้ง
    data.phone   || '',   // D เบอร์โทร
    data.equipment|| '',  // E อุปกรณ์
    data.location|| '',   // F สถานที่
    data.description||'', // G อาการ
    imageUrl,             // H รูปภาพ
    'รับเรื่อง',           // I สถานะ
  ]);

  sendLineFlex(buildRepairFlex(data, ticket, dateStr, imageUrl));
  return { success: true, ticket };
}

// ============================================================
// BOOKING HANDLER
// A=เลขที่ B=วันที่จอง C=ห้อง D=วันที่ใช้ห้อง E=เวลาเริ่ม F=เวลาสิ้นสุด
// G=ชื่อผู้จอง H=เบอร์โทร I=จำนวนผู้เข้าร่วม
// J=วัตถุประสงค์ K=อุปกรณ์ L=หมายเหตุ M=สถานะ
// ============================================================
function handleBooking(data) {
  const allowedRooms = ['หอประชุมซาวีโอ', 'ห้องประชุมอัลเบรา', 'ห้องประชุมรีกัลโดเน', 'Auditorium'];
  const phone = String(data.phone || '').replace(/[\s\-]/g, '');
  if (!data.room || !data.date || !data.startTime || !data.endTime || !data.name || !data.phone)
    return { success: false, error: 'กรุณากรอกข้อมูลให้ครบถ้วน' };
  if (!allowedRooms.includes(data.room))
    return { success: false, error: 'ห้องประชุมไม่ถูกต้อง' };
  if (!/^((\+66|0066)?\d{9}|0\d{8,9})$/.test(phone))
    return { success: false, error: 'เบอร์โทรไม่ถูกต้อง' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date))
    return { success: false, error: 'รูปแบบวันที่ไม่ถูกต้อง' };
  if (!/^\d{2}:\d{2}$/.test(data.startTime) || !/^\d{2}:\d{2}$/.test(data.endTime))
    return { success: false, error: 'รูปแบบเวลาไม่ถูกต้อง' };
  if (data.startTime >= data.endTime)
    return { success: false, error: 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น' };
  const tz = Session.getScriptTimeZone();
  if (data.date < Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'))
    return { success: false, error: 'ไม่สามารถจองย้อนหลังได้' };
  if (String(data.purpose || '').length > 500)
    return { success: false, error: 'วัตถุประสงค์ยาวเกินกำหนด' };

  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.BOOKING_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.BOOKING_SHEET);
    sheet.appendRow(['เลขที่', 'วันที่จอง', 'ห้อง', 'วันที่ใช้ห้อง', 'เวลาเริ่ม', 'เวลาสิ้นสุด', 'ชื่อผู้จอง', 'เบอร์โทร', 'จำนวนผู้เข้าร่วม', 'วัตถุประสงค์', 'อุปกรณ์', 'หมายเหตุ', 'สถานะ']);
    sheet.getRange(1, 1, 1, 13).setFontWeight('bold').setBackground('#1d4ed8').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }

  const conflict = checkBookingConflict(sheet, data.room, data.date, data.startTime, data.endTime);
  if (conflict) {
    return { success: false, error: `ห้องนี้ถูกจองในช่วงเวลาดังกล่าวแล้ว (${conflict})` };
  }

  const lastRow = sheet.getLastRow();
  const year = new Date().getFullYear();
  const ticket = `BK-${year}-${String(lastRow).padStart(3, '0')}`;
  const createdAt = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm');

  sheet.appendRow([
    ticket,               // A เลขที่
    createdAt,            // B วันที่จอง
    data.room      || '', // C ห้อง
    data.date      || '', // D วันที่ใช้ห้อง
    data.startTime || '', // E เวลาเริ่ม
    data.endTime   || '', // F เวลาสิ้นสุด
    data.name      || '', // G ชื่อผู้จอง
    data.phone     || '', // H เบอร์โทร
    data.attendees || '', // I จำนวนผู้เข้าร่วม
    data.purpose   || '', // J วัตถุประสงค์
    data.equipment || '', // K อุปกรณ์
    data.note      || '', // L หมายเหตุ
    'รับเรื่อง',           // M สถานะ
  ]);

  const newRow = sheet.getLastRow();
  // บังคับ E:F เป็น plain text เพื่อป้องกัน Sheets auto-convert "08:00" → Date
  sheet.getRange(newRow, 5, 1, 2).setNumberFormat('@');

  const roomColors = {
    'หอประชุมซาวีโอ':       '#dbeafe',
    'ห้องประชุมอัลเบรา':    '#d1fae5',
    'ห้องประชุมรีกัลโดเน':  '#ede9fe',
    'Auditorium':            '#ffedd5',
  };
  if (roomColors[data.room]) sheet.getRange(newRow, 3).setBackground(roomColors[data.room]);

  const dateParts = (data.date || '').split('-');
  const months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const dateDisplay = `${dateParts[2]} ${months[parseInt(dateParts[1])-1]} ${dateParts[0]} (ค.ศ.)`;

  sendLineFlex(buildBookingFlex(data, ticket, createdAt, dateDisplay));
  return { success: true, ticket };
}

// ============================================================
// CHECK BOOKING CONFLICT (cols A:M → 13 columns, status = col M = index 12)
// ============================================================
function normalizeTimeStr(val) {
  if (!val) return '';
  if (val instanceof Date) return Utilities.formatDate(val, Session.getScriptTimeZone(), 'HH:mm');
  const s = String(val).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!m) return s;
  let h = parseInt(m[1]);
  if (m[3]) {
    if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12;
    if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
  }
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

function checkBookingConflict(sheet, room, date, startTime, endTime) {
  if (sheet.getLastRow() <= 1) return null;

  const tz = Session.getScriptTimeZone();
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 13).getValues();
  for (const row of rows) {
    const [ticket, , rowRoom, rowDate, rowStart, rowEnd, , , , , , , rowStatus] = row;
    if (rowStatus === 'ยกเลิก' || rowStatus === 'เสร็จสิ้น') continue;
    if (rowRoom !== room) continue;
    const rowDateStr = rowDate instanceof Date
      ? Utilities.formatDate(rowDate, tz, 'yyyy-MM-dd')
      : String(rowDate).slice(0, 10);
    if (rowDateStr !== date) continue;
    const rs = normalizeTimeStr(rowStart);
    const re = normalizeTimeStr(rowEnd);
    if (startTime < re && endTime > rs) {
      return `${rs}–${re} น. (${ticket})`;
    }
  }
  return null;
}

// ============================================================
// SAVE IMAGE TO GOOGLE DRIVE
// ============================================================
function saveImageToDrive(base64, ticket) {
  try {
    const folder = getOrCreateFolderPath(['ฝ่ายโสต', 'AV_Repair']);
    const blob = Utilities.newBlob(Utilities.base64Decode(base64), 'image/jpeg', `${ticket}.jpg`);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return `https://lh3.googleusercontent.com/d/${file.getId()}`;
  } catch (err) {
    Logger.log('Drive upload error: ' + err.message);
    return '';
  }
}

function getOrCreateFolderPath(pathParts) {
  let current = DriveApp.getRootFolder();
  for (const name of pathParts) {
    const found = current.getFoldersByName(name);
    current = found.hasNext() ? found.next() : current.createFolder(name);
  }
  return current;
}

// ============================================================
// FLEX MESSAGE BUILDER — แจ้งซ่อม
// ============================================================
function buildRepairFlex(data, ticket, dateStr, imageUrl) {
  const gasUrl = ScriptApp.getService().getUrl();
  const makeStatusUri = (status) => {
    const secret = CONFIG.WEBHOOK_SECRET ? `&secret=${encodeURIComponent(CONFIG.WEBHOOK_SECRET)}` : '';
    const params = `?action=updateStatus&ticket=${encodeURIComponent(ticket)}&status=${encodeURIComponent(status)}${secret}`;
    return CONFIG.MINI_APP_ID
      ? `https://miniapp.line.me/${CONFIG.MINI_APP_ID}${params}`
      : `${gasUrl}${params}`;
  };

  return {
    altText: `🔧 แจ้งซ่อมใหม่ ${ticket}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#1d4ed8',
        paddingAll: 'xl',
        contents: [
          { type: 'text', text: '🔧 แจ้งซ่อมใหม่', color: '#ffffff', size: 'xl', weight: 'bold' },
          { type: 'text', text: ticket, color: '#bfdbfe', size: 'md', margin: 'sm' },
          { type: 'box', layout: 'vertical', backgroundColor: '#1e40af', cornerRadius: 'md', paddingAll: 'sm', margin: 'lg',
            contents: [{ type: 'text', text: '🟡 รับเรื่อง', color: '#fde68a', size: 'md', weight: 'bold', align: 'center' }] },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: 'xl',
        contents: [
          ...(imageUrl ? [{ type: 'image', url: imageUrl, size: 'full', aspectRatio: '20:13', aspectMode: 'cover', margin: 'none' },
            { type: 'separator', margin: 'lg' }] : []),
          flexRow('👤 ผู้แจ้ง',   data.name        || '-'),
          { type: 'separator', margin: 'sm' },
          flexRow('📞 เบอร์โทร',  data.phone       || '-'),
          { type: 'separator', margin: 'sm' },
          flexRow('🛠️ อุปกรณ์',  data.equipment   || '-'),
          { type: 'separator', margin: 'sm' },
          flexRow('📍 สถานที่',   data.location    || '-'),
          { type: 'separator', margin: 'sm' },
          flexRow('📝 อาการ',     data.description || '-'),
          { type: 'separator', margin: 'sm' },
          flexRow('🕐 เวลา',      dateStr),
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: 'lg',
        spacing: 'md',
        contents: [
          { type: 'box', layout: 'horizontal', spacing: 'md', contents: [
            { type: 'button', action: { type: 'uri', label: '🔵 กำลังดำเนินการ', uri: makeStatusUri('กำลังดำเนินการ') }, style: 'secondary', height: 'md', flex: 1 },
            { type: 'button', action: { type: 'uri', label: '✅ เสร็จสิ้น', uri: makeStatusUri('เสร็จสิ้น') }, style: 'primary', color: '#059669', height: 'md', flex: 1 },
          ]},
          { type: 'button', action: { type: 'uri', label: '❌ ยกเลิกการซ่อม', uri: makeStatusUri('ยกเลิก') }, style: 'primary', color: '#dc2626', height: 'md' },
          { type: 'button', action: { type: 'uri', label: '📊 ดูใน Google Sheets', uri: CONFIG.SHEET_URL }, style: 'link', height: 'sm' },
        ],
      },
    },
  };
}

// ============================================================
// FLEX MESSAGE BUILDER — จองห้องประชุม
// ============================================================
function buildBookingFlex(data, ticket, createdAt, dateDisplay) {
  const gasUrl = ScriptApp.getService().getUrl();
  const makeStatusUri = (status) => {
    const secret = CONFIG.WEBHOOK_SECRET ? `&secret=${encodeURIComponent(CONFIG.WEBHOOK_SECRET)}` : '';
    const params = `?action=updateStatus&ticket=${encodeURIComponent(ticket)}&status=${encodeURIComponent(status)}${secret}`;
    return CONFIG.MINI_APP_ID
      ? `https://miniapp.line.me/${CONFIG.MINI_APP_ID}${params}`
      : `${gasUrl}${params}`;
  };

  return {
    altText: `📅 จองห้องประชุม ${ticket}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#1d4ed8',
        paddingAll: 'xl',
        contents: [
          { type: 'text', text: '📅 จองห้องประชุมใหม่', color: '#ffffff', size: 'xl', weight: 'bold' },
          { type: 'text', text: ticket, color: '#bfdbfe', size: 'md', margin: 'sm' },
          { type: 'box', layout: 'vertical', backgroundColor: '#1e40af', cornerRadius: 'md', paddingAll: 'sm', margin: 'lg',
            contents: [{ type: 'text', text: '🟡 รับเรื่อง', color: '#fde68a', size: 'md', weight: 'bold', align: 'center' }] },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: 'xl',
        contents: [
          { type: 'box', layout: 'vertical', backgroundColor: '#eff6ff', cornerRadius: 'lg', paddingAll: 'lg',
            contents: [
              { type: 'text', text: data.room, color: '#1e3a8a', size: 'xl', weight: 'bold', align: 'center' },
              { type: 'text', text: dateDisplay, color: '#1d4ed8', size: 'md', align: 'center', margin: 'sm' },
              { type: 'text', text: `🕐 ${data.startTime} – ${data.endTime} น.`, color: '#374151', size: 'md', align: 'center', margin: 'xs' },
            ],
          },
          { type: 'separator', margin: 'md' },
          flexRow('👤 ผู้จอง',        data.name      || '-'),
          flexRow('📞 เบอร์โทร',      data.phone     || '-'),
          flexRow('👥 ผู้เข้าร่วม',   `${data.attendees || '-'} คน`),
          { type: 'separator', margin: 'sm' },
          flexRow('📌 วัตถุประสงค์',  data.purpose   || '-'),
          ...(data.equipment ? [flexRow('🎛️ อุปกรณ์', data.equipment)] : []),
          ...(data.note      ? [flexRow('💬 หมายเหตุ', data.note)]      : []),
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: 'lg',
        spacing: 'md',
        contents: [
          { type: 'box', layout: 'horizontal', spacing: 'md', contents: [
            { type: 'button', action: { type: 'uri', label: '🔵 กำลังดำเนินการ', uri: makeStatusUri('กำลังดำเนินการ') }, style: 'secondary', height: 'md', flex: 1 },
            { type: 'button', action: { type: 'uri', label: '✅ เสร็จสิ้น',       uri: makeStatusUri('เสร็จสิ้น')      }, style: 'primary', color: '#059669', height: 'md', flex: 1 },
          ]},
          { type: 'button', action: { type: 'uri', label: '❌ ยกเลิกการจอง', uri: makeStatusUri('ยกเลิก') }, style: 'primary', color: '#dc2626', height: 'md' },
          { type: 'button', action: { type: 'uri', label: '📊 ดูใน Google Sheets', uri: CONFIG.SHEET_URL }, style: 'link', height: 'sm' },
        ],
      },
    },
  };
}

// ============================================================
// FLEX ROW HELPER
// ============================================================
function flexRow(label, value) {
  return {
    type: 'box',
    layout: 'horizontal',
    paddingTop: 'xs',
    paddingBottom: 'xs',
    contents: [
      { type: 'text', text: label, size: 'md', color: '#6b7280', flex: 4, wrap: false },
      { type: 'text', text: String(value), size: 'md', color: '#111827', flex: 6, wrap: true, weight: 'bold' },
    ],
  };
}

// ============================================================
// GET TICKET DATA — รองรับทั้ง REP (repair) และ BK (booking)
// ============================================================
function getTicketData(ticket) {
  const ss       = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const isRepair = String(ticket).startsWith('REP');

  if (isRepair) {
    const sheet = ss.getSheetByName(CONFIG.REPAIR_SHEET);
    if (!sheet) return null;
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0]) === String(ticket)) {
        return {
          ticket:      values[i][0],
          name:        values[i][2],
          phone:       values[i][3],
          equipment:   values[i][4],
          location:    values[i][5],
          description: values[i][6],
          status:      values[i][8],
        };
      }
    }
  } else {
    const sheet = ss.getSheetByName(CONFIG.BOOKING_SHEET);
    if (!sheet) return null;
    const tz     = Session.getScriptTimeZone();
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0]) === String(ticket)) {
        const rawDate = values[i][3];
        const dateStr = rawDate instanceof Date
          ? Utilities.formatDate(rawDate, tz, 'yyyy-MM-dd')
          : String(rawDate).slice(0, 10);
        return {
          ticket:    values[i][0],
          name:      values[i][6],
          phone:     values[i][7],
          room:      values[i][2],
          date:      dateStr,
          startTime: normalizeTimeStr(values[i][4]),
          endTime:   normalizeTimeStr(values[i][5]),
          purpose:   values[i][9],
          status:    values[i][12],
        };
      }
    }
  }
  return null;
}

// ============================================================
// BUILD STATUS UPDATE FLEX
// ============================================================
function buildStatusUpdateFlex(d) {
  const cfg = {
    'รับเรื่อง':       { emoji: '🟡', color: '#d97706', dark: '#92400e' },
    'กำลังดำเนินการ': { emoji: '🔵', color: '#1d4ed8', dark: '#1e3a8a' },
    'เสร็จสิ้น':       { emoji: '✅', color: '#059669', dark: '#065f46' },
    'ยกเลิก':          { emoji: '❌', color: '#dc2626', dark: '#991b1b' },
  }[d.status] || { emoji: '⚪', color: '#6b7280', dark: '#374151' };

  const gasUrl = ScriptApp.getService().getUrl();
  const makeStatusUri = (status) => {
    const secret = CONFIG.WEBHOOK_SECRET ? `&secret=${encodeURIComponent(CONFIG.WEBHOOK_SECRET)}` : '';
    const params = `?action=updateStatus&ticket=${encodeURIComponent(d.ticket)}&status=${encodeURIComponent(status)}${secret}`;
    return CONFIG.MINI_APP_ID
      ? `https://miniapp.line.me/${CONFIG.MINI_APP_ID}${params}`
      : `${gasUrl}${params}`;
  };

  const isActive = d.status === 'รับเรื่อง' || d.status === 'กำลังดำเนินการ';

  const footerContents = isActive
    ? [
        { type: 'box', layout: 'horizontal', spacing: 'md', contents: [
          { type: 'button', action: { type: 'uri', label: '✅ เสร็จสิ้น', uri: makeStatusUri('เสร็จสิ้น') }, style: 'primary', color: '#059669', height: 'md', flex: 1 },
          { type: 'button', action: { type: 'uri', label: '❌ ยกเลิก',   uri: makeStatusUri('ยกเลิก')   }, style: 'primary', color: '#dc2626', height: 'md', flex: 1 },
        ]},
        { type: 'button', action: { type: 'uri', label: '📊 ดูใน Google Sheets', uri: CONFIG.SHEET_URL }, style: 'link', height: 'sm' },
      ]
    : [
        { type: 'button', action: { type: 'uri', label: '📊 ดูใน Google Sheets', uri: CONFIG.SHEET_URL }, style: 'primary', color: cfg.color, height: 'md' },
      ];

  return {
    altText: `🔄 ${d.ticket} → ${d.status}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: cfg.color,
        paddingAll: 'xl',
        contents: [
          { type: 'text', text: '🔄 อัปเดตสถานะ', color: '#ffffff', size: 'xl', weight: 'bold' },
          { type: 'text', text: d.ticket, color: '#ffffff', size: 'md', margin: 'sm' },
          { type: 'box', layout: 'vertical', backgroundColor: cfg.dark, cornerRadius: 'md', paddingAll: 'md', margin: 'lg',
            contents: [{ type: 'text', text: `${cfg.emoji}  ${d.status}`, color: '#ffffff', size: 'xxl', weight: 'bold', align: 'center' }] },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: 'xl',
        spacing: 'md',
        contents: d.ticket && d.ticket.startsWith('REP')
          ? [
              flexRow('👤 ผู้แจ้ง',  d.name      || '-'),
              { type: 'separator', margin: 'sm' },
              flexRow('📞 เบอร์',    d.phone     || '-'),
              { type: 'separator', margin: 'sm' },
              flexRow('🛠️ อุปกรณ์', d.equipment || '-'),
              { type: 'separator', margin: 'sm' },
              flexRow('📍 สถานที่',  d.location  || '-'),
            ]
          : [
              flexRow('👤 ผู้จอง',  d.name     || '-'),
              { type: 'separator', margin: 'sm' },
              flexRow('📞 เบอร์',   d.phone    || '-'),
              { type: 'separator', margin: 'sm' },
              flexRow('🏢 ห้อง',    d.room     || '-'),
              { type: 'separator', margin: 'sm' },
              flexRow('📅 วันที่',  d.date     || '-'),
              { type: 'separator', margin: 'sm' },
              flexRow('🕐 เวลา',    `${d.startTime || ''} – ${d.endTime || ''} น.`),
            ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: 'lg',
        spacing: 'md',
        contents: footerContents,
      },
    },
  };
}

// ============================================================
// SEND LINE FLEX MESSAGE
// ============================================================
function sendLineFlex(flex) {
  if (!CONFIG.LINE_TOKEN) { Logger.log('LINE skipped (no token)'); return; }

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: `Bearer ${CONFIG.LINE_TOKEN}` },
    payload: JSON.stringify({ messages: [{ type: 'flex', altText: flex.altText, contents: flex.contents }] }),
    muteHttpExceptions: true,
  };

  try {
    const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/broadcast', options);
    const code = res.getResponseCode();
    if (code !== 200) Logger.log(`LINE API error ${code}: ${res.getContentText()}`);
    else Logger.log('LINE flex sent OK');
  } catch (err) {
    Logger.log('LINE error: ' + err.message);
  }
}

// ============================================================
// TEST DRIVE ACCESS
// ============================================================
function testDriveAccess() {
  const folders = DriveApp.getFoldersByName('AV_Repairs');
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder('AV_Repairs');
  const file = folder.createFile('test.txt', 'DriveApp authorized OK', MimeType.PLAIN_TEXT);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  Logger.log('Drive OK — folder: ' + folder.getName() + ', file: ' + file.getId());
}

// ============================================================
// SETUP FUNCTION — Run once to create sheets
// ============================================================
function setupSpreadsheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  let repairSheet = ss.getSheetByName(CONFIG.REPAIR_SHEET);
  if (!repairSheet) {
    repairSheet = ss.insertSheet(CONFIG.REPAIR_SHEET);
    repairSheet.appendRow(['เลขที่', 'วันที่แจ้ง', 'ชื่อผู้แจ้ง', 'เบอร์โทร', 'อุปกรณ์', 'สถานที่', 'อาการ', 'รูปภาพ', 'สถานะ']);
    repairSheet.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#1d4ed8').setFontColor('#ffffff');
    repairSheet.setFrozenRows(1);
    Logger.log('Created repair sheet');
  }

  let bookingSheet = ss.getSheetByName(CONFIG.BOOKING_SHEET);
  if (!bookingSheet) {
    bookingSheet = ss.insertSheet(CONFIG.BOOKING_SHEET);
    bookingSheet.appendRow(['เลขที่', 'วันที่จอง', 'ห้อง', 'วันที่ใช้ห้อง', 'เวลาเริ่ม', 'เวลาสิ้นสุด', 'ชื่อผู้จอง', 'เบอร์โทร', 'จำนวนผู้เข้าร่วม', 'วัตถุประสงค์', 'อุปกรณ์', 'หมายเหตุ', 'สถานะ']);
    bookingSheet.getRange(1, 1, 1, 13).setFontWeight('bold').setBackground('#1d4ed8').setFontColor('#ffffff');
    bookingSheet.setFrozenRows(1);
    Logger.log('Created booking sheet');
  }

  Logger.log('Setup complete!');
}
