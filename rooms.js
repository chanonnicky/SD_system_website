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
    iconColor:  'text-blue-700',
    iconBg:     'bg-blue-200',
    features:   ['🪑 ชั้นลอย','📺 จอ LED', '🎤 ระบบเครื่องเสียง', '🔦 ระบบไฟคอนเสิร์ต','📹 ระบบ Live'],
    sheetColor: '#bfdbfe',
    calClass:   'room-savio',
  },
  {
    id:         'ห้องประชุมอัลเบรา',
    label:      'ห้องประชุมอัลเบรา',
    short:      'อัลเบรา',
    capacity:   50,
    floor:      'ชั้น 3 อาคาร SAVIO',
    icon:       'fa-chalkboard',
    iconColor:  'text-emerald-700',
    iconBg:     'bg-emerald-200',
    features:   ['📽️ Projector ×3', '🎤 ระบบเครื่องเสียง'],
    sheetColor: '#a7f3d0',
    calClass:   'room-albera',
  },
  {
    id:         'ห้องประชุมรีกัลโดเน',
    label:      'ห้องประชุมรีกัลโดเน',
    short:      'ห้องประชุมรีกัลโดเน',
    capacity:   50,
    floor:      'ชั้น 2 อาคาร SAVIO',
    icon:       'fa-chalkboard',
    iconColor:  'text-violet-700',
    iconBg:     'bg-violet-200',
    features:   ['📽️ Projector', '🎤 ระบบเครื่องเสียง'],
    sheetColor: '#ddd6fe',
    calClass:   'room-regaldon',
  },
  {
    id:         'Auditorium',
    label:      'S.D. Auditorium',
    short:      'Auditorium',
    capacity:   150,
    floor:      'ชั้น 3 อาคารยอห์น บอสโก อนุสรณ์ 200 ปีชาตกาล',
    icon:       'fa-masks-theater',
    iconColor:  'text-red-700',
    iconBg:     'bg-red-200',
    features:   ['📺 จอ LED', '🎤 ระบบเครื่องเสียง', '🔦 ระบบไฟคอนเสิร์ต'],
    sheetColor: '#fecaca',
    calClass:   'room-auditorium',
  },
];
