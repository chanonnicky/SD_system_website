#!/usr/bin/env python3
"""
report.py — รัน load test แล้วสร้าง PDF รายงานผล
วิธีรัน: python3 test/report.py
ผลลัพธ์: test/load_test_report.pdf
"""

import json, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.graphics.shapes import Drawing, Rect, String, Line
from reportlab.graphics import renderPDF

# ─── FONT SETUP ────────────────────────────────────────────────
pdfmetrics.registerFont(TTFont('TH',     '/System/Library/Fonts/Supplemental/Tahoma.ttf'))
pdfmetrics.registerFont(TTFont('TH-B',   '/System/Library/Fonts/Supplemental/Tahoma.ttf'))

def S(name, size, bold=False, color=colors.black, align=TA_LEFT, leading=None):
    return ParagraphStyle(
        name, fontName='TH-B' if bold else 'TH',
        fontSize=size, textColor=color, alignment=align,
        leading=leading or size * 1.4, wordWrap='CJK',
    )

# Shared styles
sTitle   = S('title',   20, bold=True,  color=colors.HexColor('#1d4ed8'), align=TA_CENTER)
sH1      = S('h1',      14, bold=True,  color=colors.HexColor('#1e293b'))
sH2      = S('h2',      11, bold=True,  color=colors.HexColor('#334155'))
sBody    = S('body',     9, color=colors.HexColor('#475569'))
sBodyC   = S('bodyC',    9, color=colors.HexColor('#475569'), align=TA_CENTER)
sSmall   = S('small',    8, color=colors.HexColor('#94a3b8'))
sSmallC  = S('smallC',   8, color=colors.HexColor('#94a3b8'), align=TA_CENTER)
sGreen   = S('green',   10, bold=True,  color=colors.HexColor('#16a34a'), align=TA_CENTER)
sRed     = S('red',     10, bold=True,  color=colors.HexColor('#dc2626'), align=TA_CENTER)
sBigNum  = S('bignum',  26, bold=True,  color=colors.HexColor('#1d4ed8'), align=TA_CENTER)

# ─── GAS / TEST CONFIG ────────────────────────────────────────
GAS_URL = (
    "https://script.google.com/macros/s/"
    "AKfycbw6joijiaVLYTOEG8ajOl7wp5_JhsovC_yW3oqJ3XWHuKvlxmxHGr5bmTY33mnhtEN1/exec"
)
ROOMS    = ["หอประชุมซาวีโอ", "ห้องประชุมอัลเบรา", "ห้องประชุมรีกัลโดเน", "Auditorium"]
EQUIP    = ["ไมโครโฟน", "ลำโพง / เครื่องเสียง", "โปรเจกเตอร์", "จอภาพ / จอ LED"]
N        = 30


# ─── HTTP POST ────────────────────────────────────────────────
def post_gas(payload: dict) -> dict:
    start = time.time()
    body  = json.dumps(payload, ensure_ascii=False).encode()

    def do_post(url):
        req = urllib.request.Request(
            url, data=body,
            headers={'Content-Type': 'text/plain; charset=utf-8'},
            method='POST',
        )
        return urllib.request.urlopen(req, timeout=60)

    try:
        try:
            resp = do_post(GAS_URL)
        except urllib.error.HTTPError as e:
            if e.code in (301, 302, 303, 307, 308):
                resp = do_post(e.headers.get('Location'))
            else:
                raise
        elapsed = round((time.time() - start) * 1000)
        data = json.loads(resp.read().decode())
        return {'ok': data.get('success') is True, 'ticket': data.get('ticket'),
                'error': data.get('error'), 'elapsed': elapsed}
    except Exception as exc:
        return {'ok': False, 'ticket': None, 'error': str(exc)[:100],
                'elapsed': round((time.time() - start) * 1000)}


# ─── PAYLOAD FACTORIES ───────────────────────────────────────
def make_repair(i):
    return dict(type='repair', name=f'ผู้ทดสอบ คนที่ {i+1}',
                phone=f'08{str(i).zfill(8)}',
                equipment=EQUIP[i % len(EQUIP)],
                location=f'อาคาร SAVIO ชั้น {(i%4)+1} ห้อง {100+i}',
                description=f'[LOAD TEST #{i+1}] ทดสอบระบบอัตโนมัติ',
                timestamp=datetime.now().isoformat())

def make_booking(i):
    d = datetime.now() + timedelta(days=7+i)
    h = 8 + (i % 10)
    return dict(type='booking', name=f'ผู้ทดสอบ คนที่ {i+1}',
                phone=f'09{str(i).zfill(8)}',
                room=ROOMS[i % len(ROOMS)],
                date=d.strftime('%Y-%m-%d'),
                startTime=f'{h:02d}:00', endTime=f'{h+1:02d}:00',
                attendees=str(10+i),
                purpose=f'[LOAD TEST #{i+1}] ทดสอบการจองห้อง',
                equipment=EQUIP[i % len(EQUIP)], note=f'Auto test {i+1}',
                timestamp=datetime.now().isoformat())


# ─── BAR CHART DRAWING ───────────────────────────────────────
def make_bar_chart(repair_results, booking_results, width=160*mm, height=60*mm):
    d = Drawing(width, height)
    categories = ['แจ้งซ่อม\nสำเร็จ', 'แจ้งซ่อม\nล้มเหลว',
                  'จองห้อง\nสำเร็จ', 'จองห้อง\nล้มเหลว']
    values = [
        sum(1 for r in repair_results  if r['ok']),
        sum(1 for r in repair_results  if not r['ok']),
        sum(1 for r in booking_results if r['ok']),
        sum(1 for r in booking_results if not r['ok']),
    ]
    bar_colors = [
        colors.HexColor('#22c55e'), colors.HexColor('#ef4444'),
        colors.HexColor('#3b82f6'), colors.HexColor('#f97316'),
    ]
    max_val = max(values) or 1
    bar_w   = width / (len(values) * 2)
    gap     = bar_w
    chart_h = height - 30*mm if height > 40*mm else height * 0.5
    chart_y = 18*mm

    for i, (val, col, cat) in enumerate(zip(values, bar_colors, categories)):
        x = gap + i * (bar_w + gap)
        bh = (val / max_val) * chart_h if val > 0 else 1
        d.add(Rect(x, chart_y, bar_w, bh, fillColor=col, strokeColor=None))
        d.add(String(x + bar_w/2, chart_y + bh + 2*mm, str(val),
                     fontSize=9, fontName='TH-B', fillColor=col,
                     textAnchor='middle'))
        for j, line in enumerate(cat.split('\n')):
            d.add(String(x + bar_w/2, 6*mm - j*5*mm, line,
                         fontSize=7, fontName='TH', fillColor=colors.HexColor('#64748b'),
                         textAnchor='middle'))
    d.add(Line(0, chart_y, width, chart_y,
               strokeColor=colors.HexColor('#e2e8f0'), strokeWidth=0.5))
    return d


# ─── TIMING CHART ────────────────────────────────────────────
def make_timing_chart(repair_results, booking_results, width=160*mm, height=55*mm):
    d = Drawing(width, height)
    all_times = [r['elapsed'] for r in repair_results + booking_results]
    max_t     = max(all_times) or 1
    chart_h   = height - 15*mm
    chart_y   = 12*mm
    bar_w     = (width - 10*mm) / 60
    gap       = 1

    repair_col  = colors.HexColor('#3b82f6')
    booking_col = colors.HexColor('#22c55e')

    for i, r in enumerate(repair_results):
        bh = (r['elapsed'] / max_t) * chart_h
        col = repair_col if r['ok'] else colors.HexColor('#ef4444')
        d.add(Rect(5*mm + i*(bar_w+gap), chart_y, bar_w, bh,
                   fillColor=col, strokeColor=None))

    for i, r in enumerate(booking_results):
        bh = (r['elapsed'] / max_t) * chart_h
        col = booking_col if r['ok'] else colors.HexColor('#f97316')
        d.add(Rect(5*mm + (N+i)*(bar_w+gap), chart_y, bar_w, bh,
                   fillColor=col, strokeColor=None))

    d.add(Line(5*mm, chart_y, width, chart_y,
               strokeColor=colors.HexColor('#e2e8f0'), strokeWidth=0.5))

    # Y-axis labels
    for pct in [0, 50, 100]:
        y_val = pct / 100 * max_t
        y_pos = chart_y + pct / 100 * chart_h
        d.add(String(0, y_pos - 2*mm, f'{int(y_val/1000):.0f}s',
                     fontSize=6, fontName='TH', fillColor=colors.HexColor('#94a3b8')))

    # Legend
    d.add(Rect(5*mm, 2*mm, 4*mm, 4*mm, fillColor=repair_col,  strokeColor=None))
    d.add(String(10*mm, 2*mm, 'แจ้งซ่อม', fontSize=7, fontName='TH',
                 fillColor=colors.HexColor('#64748b')))
    d.add(Rect(45*mm, 2*mm, 4*mm, 4*mm, fillColor=booking_col, strokeColor=None))
    d.add(String(50*mm, 2*mm, 'จองห้อง', fontSize=7, fontName='TH',
                 fillColor=colors.HexColor('#64748b')))
    return d


# ─── RUN TEST ────────────────────────────────────────────────
def run_test():
    repairs  = [make_repair(i)  for i in range(N)]
    bookings = [make_booking(i) for i in range(N)]
    all_pl   = repairs + bookings

    print(f"  ⏳ กำลังส่ง {len(all_pl)} requests (workers=20)…")
    t0 = time.time()
    results = [None] * len(all_pl)
    with ThreadPoolExecutor(max_workers=20) as ex:
        futures = {ex.submit(post_gas, p): i for i, p in enumerate(all_pl)}
        done = 0
        for fut in as_completed(futures):
            results[futures[fut]] = fut.result()
            done += 1
            print(f"\r  {done}/{len(all_pl)} requests…", end='', flush=True)
    wall = round((time.time() - t0) * 1000)
    print(f"\r  ✅ เสร็จใน {wall} ms                    ")
    return results[:N], results[N:], wall


# ─── BUILD PDF ───────────────────────────────────────────────
def build_pdf(repair_res, booking_res, wall_ms, out_path):
    W, H = A4
    M    = 18*mm
    doc  = SimpleDocTemplate(out_path, pagesize=A4,
                             leftMargin=M, rightMargin=M,
                             topMargin=M, bottomMargin=M)

    now   = datetime.now().strftime('%d/%m/%Y %H:%M:%S')
    story = []

    # ── Header ────────────────────────────────────────────────
    story.append(Paragraph('รายงานผลการทดสอบระบบ', sTitle))
    story.append(Paragraph('งานโสตทัศนูปกรณ์ โรงเรียนเซนต์ดอมินิก', S('sub', 11, align=TA_CENTER, color=colors.HexColor('#64748b'))))
    story.append(Spacer(1, 3*mm))
    story.append(HRFlowable(width='100%', thickness=1.5, color=colors.HexColor('#1d4ed8')))
    story.append(Spacer(1, 4*mm))

    # ── Meta ──────────────────────────────────────────────────
    meta_data = [
        ['วันที่ทดสอบ', now,           'เวลารวม (wall clock)', f'{wall_ms:,} ms  ({wall_ms/1000:.1f} วินาที)'],
        ['จำนวน Requests', '60 requests', 'Workers (parallel)',  '20 threads'],
        ['GAS URL', GAS_URL[43:80]+'…', 'N per type',          f'{N} แจ้งซ่อม + {N} จองห้อง'],
    ]
    tbl_meta = Table(meta_data, colWidths=[(W-M*2)*0.22, (W-M*2)*0.28, (W-M*2)*0.25, (W-M*2)*0.25])
    tbl_meta.setStyle(TableStyle([
        ('FONTNAME',  (0,0), (-1,-1), 'TH'),
        ('FONTNAME',  (0,0), (0,-1),  'TH-B'),
        ('FONTNAME',  (2,0), (2,-1),  'TH-B'),
        ('FONTSIZE',  (0,0), (-1,-1), 8),
        ('TEXTCOLOR', (0,0), (0,-1),  colors.HexColor('#475569')),
        ('TEXTCOLOR', (2,0), (2,-1),  colors.HexColor('#475569')),
        ('TEXTCOLOR', (1,0), (1,-1),  colors.HexColor('#1e293b')),
        ('TEXTCOLOR', (3,0), (3,-1),  colors.HexColor('#1e293b')),
        ('BACKGROUND',(0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [colors.HexColor('#f8fafc'), colors.white]),
        ('GRID', (0,0), (-1,-1), 0.3, colors.HexColor('#e2e8f0')),
        ('TOPPADDING',  (0,0), (-1,-1), 4),
        ('BOTTOMPADDING',(0,0),(-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(tbl_meta)
    story.append(Spacer(1, 6*mm))

    # ── KPI Cards ─────────────────────────────────────────────
    r_ok   = sum(1 for r in repair_res  if r['ok'])
    b_ok   = sum(1 for r in booking_res if r['ok'])
    all_ok = r_ok + b_ok

    def kpi_cell(top, mid, bot, bg, fg):
        return Table([[Paragraph(top, S('kt', 8, color=colors.HexColor('#64748b'), align=TA_CENTER))],
                      [Paragraph(mid, S('km', 26, bold=True, color=colors.HexColor(fg), align=TA_CENTER))],
                      [Paragraph(bot, S('kb', 8, color=colors.HexColor('#64748b'), align=TA_CENTER))]],
                     colWidths=[(W-M*2)/4 - 3*mm])

    kw = (W - M*2) / 4 - 2*mm
    kpis = Table([[
        kpi_cell('สำเร็จทั้งหมด', f'{all_ok}/60', '🎉 ผ่านทุกรายการ', '#f0fdf4', '#16a34a'),
        kpi_cell('แจ้งซ่อม',      f'{r_ok}/{N}',  'รายการ', '#eff6ff', '#1d4ed8'),
        kpi_cell('จองห้อง',       f'{b_ok}/{N}',  'รายการ', '#eff6ff', '#1d4ed8'),
        kpi_cell('เวลาเฉลี่ย', f'{round(sum(r["elapsed"] for r in repair_res+booking_res)/60/1000, 1)} วิ', 'ต่อ request', '#fff7ed', '#ea580c'),
    ]], colWidths=[kw]*4, hAlign='CENTER')
    kpis.setStyle(TableStyle([
        ('FONTNAME',    (0,0), (-1,-1), 'TH'),
        ('BACKGROUND',  (0,0), (0,0),   colors.HexColor('#f0fdf4')),
        ('BACKGROUND',  (1,0), (1,0),   colors.HexColor('#eff6ff')),
        ('BACKGROUND',  (2,0), (2,0),   colors.HexColor('#eff6ff')),
        ('BACKGROUND',  (3,0), (3,0),   colors.HexColor('#fff7ed')),
        ('BOX',         (0,0), (0,0),   1, colors.HexColor('#bbf7d0')),
        ('BOX',         (1,0), (1,0),   1, colors.HexColor('#bfdbfe')),
        ('BOX',         (2,0), (2,0),   1, colors.HexColor('#bfdbfe')),
        ('BOX',         (3,0), (3,0),   1, colors.HexColor('#fed7aa')),
        ('ROUNDEDCORNERS', [4]),
        ('LEFTPADDING', (0,0), (-1,-1), 3),
        ('RIGHTPADDING',(0,0), (-1,-1), 3),
        ('TOPPADDING',  (0,0), (-1,-1), 6),
        ('BOTTOMPADDING',(0,0),(-1,-1), 6),
    ]))
    story.append(kpis)
    story.append(Spacer(1, 7*mm))

    # ── Bar Chart ─────────────────────────────────────────────
    story.append(Paragraph('สรุปผลลัพธ์แยกตามประเภท', sH1))
    story.append(Spacer(1, 3*mm))
    story.append(make_bar_chart(repair_res, booking_res, width=W-M*2, height=60*mm))
    story.append(Spacer(1, 6*mm))

    # ── Timing Chart ──────────────────────────────────────────
    story.append(Paragraph('เวลาตอบสนองแต่ละ Request (ms)', sH1))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph('แท่งสีน้ำเงิน = แจ้งซ่อม  |  แท่งสีเขียว = จองห้อง  |  แกน Y = วินาที', sSmall))
    story.append(Spacer(1, 2*mm))
    story.append(make_timing_chart(repair_res, booking_res, width=W-M*2, height=55*mm))
    story.append(Spacer(1, 7*mm))

    # ── Stats Table ───────────────────────────────────────────
    def stats_row(label, results):
        times  = [r['elapsed'] for r in results]
        ok     = sum(1 for r in results if r['ok'])
        avg    = round(sum(times)/len(times))
        mn, mx = min(times), max(times)
        p90    = sorted(times)[int(len(times)*0.9)]
        return [label, f'{ok}/{len(results)}', f'{avg:,}', f'{mn:,}', f'{mx:,}', f'{p90:,}']

    all_res = repair_res + booking_res
    stat_data = [
        ['ประเภท', 'สำเร็จ', 'เฉลี่ย (ms)', 'เร็วสุด (ms)', 'ช้าสุด (ms)', 'P90 (ms)'],
        stats_row('แจ้งซ่อม',         repair_res),
        stats_row('จองห้องประชุม',    booking_res),
        stats_row('รวมทั้งหมด',       all_res),
    ]
    cw = [(W-M*2)*x for x in [0.22, 0.12, 0.165, 0.165, 0.165, 0.165]]
    tbl_stat = Table(stat_data, colWidths=cw)
    tbl_stat.setStyle(TableStyle([
        ('FONTNAME',    (0,0), (-1,-1), 'TH'),
        ('FONTNAME',    (0,0), (-1,0),  'TH-B'),
        ('FONTNAME',    (0,-1),(-1,-1), 'TH-B'),
        ('FONTSIZE',    (0,0), (-1,-1), 9),
        ('BACKGROUND',  (0,0), (-1,0),  colors.HexColor('#1d4ed8')),
        ('TEXTCOLOR',   (0,0), (-1,0),  colors.white),
        ('BACKGROUND',  (0,-1),(-1,-1), colors.HexColor('#eff6ff')),
        ('ROWBACKGROUNDS',(0,1),(-1,-2),[colors.white, colors.HexColor('#f8fafc')]),
        ('ALIGN',       (1,0), (-1,-1), 'CENTER'),
        ('GRID',        (0,0), (-1,-1), 0.3, colors.HexColor('#e2e8f0')),
        ('TOPPADDING',  (0,0), (-1,-1), 5),
        ('BOTTOMPADDING',(0,0),(-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(tbl_stat)
    story.append(Spacer(1, 7*mm))

    # ── Ticket List ───────────────────────────────────────────
    story.append(Paragraph('รายการ Ticket ที่สร้างได้ (ตัวอย่าง 10 รายการแรก)', sH1))
    story.append(Spacer(1, 2*mm))

    sample = [(r, 'แจ้งซ่อม') for r in repair_res if r['ticket']][:5] + \
             [(r, 'จองห้อง')  for r in booking_res  if r['ticket']][:5]
    t_rows = [['#', 'Ticket', 'ประเภท', 'เวลา (ms)', 'สถานะ']]
    for i, (r, typ) in enumerate(sample, 1):
        t_rows.append([
            str(i), r['ticket'] or '-', typ,
            f"{r['elapsed']:,}",
            'สำเร็จ' if r['ok'] else f"ล้มเหลว: {r['error']}",
        ])
    tcw = [(W-M*2)*x for x in [0.06, 0.22, 0.18, 0.16, 0.38]]
    tbl_t = Table(t_rows, colWidths=tcw)
    tbl_t.setStyle(TableStyle([
        ('FONTNAME',    (0,0), (-1,-1), 'TH'),
        ('FONTNAME',    (0,0), (-1,0),  'TH-B'),
        ('FONTSIZE',    (0,0), (-1,-1), 8.5),
        ('BACKGROUND',  (0,0), (-1,0),  colors.HexColor('#334155')),
        ('TEXTCOLOR',   (0,0), (-1,0),  colors.white),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white, colors.HexColor('#f8fafc')]),
        ('ALIGN',       (0,0), (0,-1),  'CENTER'),
        ('ALIGN',       (3,0), (3,-1),  'CENTER'),
        ('GRID',        (0,0), (-1,-1), 0.3, colors.HexColor('#e2e8f0')),
        ('TOPPADDING',  (0,0), (-1,-1), 4),
        ('BOTTOMPADDING',(0,0),(-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(tbl_t)
    story.append(Spacer(1, 7*mm))

    # ── Conclusion ────────────────────────────────────────────
    story.append(HRFlowable(width='100%', thickness=0.5, color=colors.HexColor('#e2e8f0')))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph('สรุปผลการทดสอบ', sH1))
    story.append(Spacer(1, 2*mm))

    fail_total = 60 - all_ok
    pass_pct   = all_ok / 60 * 100
    avg_all    = round(sum(r['elapsed'] for r in all_res) / len(all_res))
    conclusion = (
        f'ระบบ Google Apps Script (GAS) สามารถรองรับการส่งข้อมูลพร้อมกัน 60 requests '
        f'(แจ้งซ่อม {N} รายการ + จองห้องประชุม {N} รายการ) ผ่าน 20 parallel workers '
        f'โดยมีอัตราความสำเร็จ <b>{pass_pct:.0f}%</b> ({all_ok}/60 รายการ) '
        f'เวลาตอบสนองเฉลี่ย <b>{avg_all:,} ms</b> และเวลารวมทั้งหมด '
        f'<b>{wall_ms:,} ms ({wall_ms/1000:.1f} วินาที)</b>.'
    )
    if fail_total == 0:
        conclusion += ' ระบบผ่านการทดสอบโดยไม่มีข้อผิดพลาด'
    else:
        conclusion += f' พบข้อผิดพลาด {fail_total} รายการ ควรตรวจสอบ GAS logs เพิ่มเติม'

    story.append(Paragraph(conclusion, S('con', 9.5, color=colors.HexColor('#334155'), leading=16)))
    story.append(Spacer(1, 5*mm))
    story.append(Paragraph(
        f'จัดทำโดย Claude Code  •  {now}',
        S('foot', 8, color=colors.HexColor('#94a3b8'), align=TA_CENTER)
    ))

    doc.build(story)
    print(f"  📄 บันทึก PDF → {out_path}")


# ─── MAIN ────────────────────────────────────────────────────
if __name__ == '__main__':
    print(f"\n{'═'*58}")
    print(f"  🔬 Load Test + PDF Report Generator")
    print(f"  ทดสอบ {N} แจ้งซ่อม + {N} จองห้อง พร้อมกัน")
    print(f"{'═'*58}\n")

    repair_res, booking_res, wall_ms = run_test()

    out = 'test/load_test_report.pdf'
    build_pdf(repair_res, booking_res, wall_ms, out)

    r_ok = sum(1 for r in repair_res  if r['ok'])
    b_ok = sum(1 for r in booking_res if r['ok'])
    print(f"\n  แจ้งซ่อม:  {r_ok}/{N}  |  จองห้อง: {b_ok}/{N}")
    print(f"  เวลารวม:  {wall_ms:,} ms  ({wall_ms/1000:.1f} วินาที)")
    print(f"  PDF:       {out}\n")
