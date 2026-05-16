// ============================================================
// rooms.js — กำหนดห้องประชุมทั้งหมดที่นี่
// เพิ่ม / ลบ / แก้ไขห้องประชุมที่ไฟล์นี้เพียงไฟล์เดียว
// หมายเหตุ: ถ้าเพิ่มห้องใหม่ ต้องเพิ่ม roomColors ใน gas/Code.gs ด้วย
// ============================================================
const ROOMS = [
  {
    id:         'หอประชุมซาวีโอ',
    label:      'หอประชุมซาวีโอ',
    short:      'หอประชุมซาวีโอ',
    capacity:   800,
    floor:      'ชั้น 4 อาคาร SAVIO',
    icon:       'fa-people-roof',
    iconColor:  'text-blue-600',
    iconBg:     'bg-blue-100',
    features:   ['🪑 ชั้นลอย','📺 จอ LED', '🎤 ระบบเครื่องเสียง', '🔦 ระบบไฟคอนเสิร์ต','📹 ระบบ Live'],
    sheetColor: '#dbeafe',
    calClass:   'หอประชุมซาวีโอ',
  },
  {
    id:         'ห้องประชุมอัลเบรา',
    label:      'ห้องประชุมอัลเบรา',
    short:      'อัลเบรา',
    capacity:   50,
    floor:      'ชั้น 3 อาคาร SAVIO',
    icon:       'fa-chalkboard',
    iconColor:  'text-green-600',
    iconBg:     'bg-green-100',
    features:   ['📽️ Projector ×3', '🎤 ระบบเครื่องเสียง'],
    sheetColor: '#d1fae5',
    calClass:   'ห้องประชุมอัลเบรา',
  },
  {
    id:         'ห้องประชุมรีกัลโดเน',
    label:      'ห้องประชุมรีกัลโดเน',
    short:      'ห้องประชุมรีกัลโดเน',
    capacity:   50,
    floor:      'ชั้น 2 อาคาร SAVIO',
    icon:       'fa-chalkboard',
    iconColor:  'text-purple-600',
    iconBg:     'bg-purple-100',
    features:   ['📽️ Projector', '🎤 ระบบเครื่องเสียง'],
    sheetColor: '#ede9fe',
    calClass:   'ห้องประชุมรีกัลโดเน',
  },
  {
    id:         'Auditorium',
    label:      'ห้องประชุม S.D. Auditorium',
    short:      'Auditorium',
    capacity:   150,
    floor:      'ชั้น 3 อาคารยอห์น บอสโก อนุสรณ์ 200 ปีชาตกาล',
    icon:       'fa-masks-theater',
    iconColor:  'text-orange-600',
    iconBg:     'bg-orange-100',
    features:   ['📺 จอ LED', '🎤 ระบบเครื่องเสียง', '🔦 ระบบไฟคอนเสิร์ต'],
    sheetColor: '#ffedd5',
    calClass:   'auditorium',
  },
];
