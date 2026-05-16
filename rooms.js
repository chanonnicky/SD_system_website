// ============================================================
// rooms.js — กำหนดห้องประชุมทั้งหมดที่นี่
// เพิ่ม / ลบ / แก้ไขห้องประชุมที่ไฟล์นี้เพียงไฟล์เดียว
// หมายเหตุ: ถ้าเพิ่มห้องใหม่ ต้องเพิ่ม roomColors ใน gas/Code.gs ด้วย
// ============================================================
const ROOMS = [
  {
    id:         'ห้องประชุม A',
    label:      'ห้องประชุม A',
    short:      'ห้อง A',
    capacity:   20,
    floor:      'ชั้น 2',
    icon:       'fa-door-open',
    iconColor:  'text-blue-600',
    iconBg:     'bg-blue-100',
    features:   ['📽️ Projector', '🎤 Mic', '📺 TV'],
    sheetColor: '#dbeafe',
    calClass:   'room-a',
  },
  {
    id:         'ห้องประชุม B',
    label:      'ห้องประชุม B',
    short:      'ห้อง B',
    capacity:   10,
    floor:      'ชั้น 3',
    icon:       'fa-door-open',
    iconColor:  'text-green-600',
    iconBg:     'bg-green-100',
    features:   ['📺 Smart TV', '🔊 Speaker'],
    sheetColor: '#d1fae5',
    calClass:   'room-b',
  },
  {
    id:         'ห้องประชุม C (ใหญ่)',
    label:      'ห้องประชุม C (ใหญ่)',
    short:      'ห้อง C',
    capacity:   50,
    floor:      'ชั้น 1',
    icon:       'fa-door-open',
    iconColor:  'text-purple-600',
    iconBg:     'bg-purple-100',
    features:   ['📽️ Projector×2', '🎤 Mic×4', '📹 Camera'],
    sheetColor: '#ede9fe',
    calClass:   'room-c',
  },
  {
    id:         'ห้องอบรม',
    label:      'ห้องอบรม',
    short:      'ห้องอบรม',
    capacity:   30,
    floor:      'ชั้น 4',
    icon:       'fa-chalkboard-user',
    iconColor:  'text-orange-600',
    iconBg:     'bg-orange-100',
    features:   ['📽️ Projector', '💻 Zoom', '🎙️ Rec'],
    sheetColor: '#ffedd5',
    calClass:   'room-training',
  },
];
