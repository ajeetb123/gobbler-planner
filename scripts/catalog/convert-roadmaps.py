# Convert saved catalog plan grids (recv/rm_*) into the planner's roadmap text format.
import re, sys, os, html, collections
src, out = sys.argv[1], sys.argv[2]
CODE = r'[A-Z]{2,4} \d{4}H?'
def text(s):
    s = re.sub(r'<sup.*?</sup>', '', s, flags=re.S)
    s = re.sub(r'<br\s*/?>', ' ', s)
    s = re.sub(r'<[^>]+>', '', s)
    return re.sub(r'\s+', ' ', html.unescape(s).replace('\xa0', ' ')).strip()
report = collections.defaultdict(list)
by_college = collections.defaultdict(list)
for f in sorted(os.listdir(src)):
    if not f.startswith('rm_'): continue
    parts = f[3:].split('__'); college, slug = parts[0], parts[-1]
    raw = open(os.path.join(src, f), encoding='utf8').read()
    title, body = raw.split('\n', 1)
    name = title.split(' | ')[0].strip()
    tables = body.split('<!--T-->')
    if len(tables) > 1: report['multi-table'].append(slug)
    lines, year, term, items, total, ok = [], None, None, [], None, True
    sums_bad = []
    def flush(printed):
        global items
        if term is None: return
        s = sum(c for _, c in items if c is not None)
        if printed is None: printed = s
        if s != printed: sums_bad.append(f'{year} {term}: {s} vs {printed}')
        lines.append(f' {term}: ' + ''.join(f'{l} ({"" if c is None else c}), ' for l, c in items) + f'sum {printed}')
        items = []
    for tr in re.findall(r'<tr\b([^>]*)>(.*?)</tr>', tables[0], flags=re.S):
        attrs, inner = tr
        cls = (re.search(r'class="([^"]*)"', attrs) or [None, ''])[1]
        if 'plangridyear' in cls:
            if term is not None and items: flush(None)
            term = None
            y = text(inner); lines.append(y if y.endswith(' Year') else y + ' Year'); year = y; continue
        if 'plangridterm' in cls:
            if term is not None and items: flush(None)
            t = text(re.findall(r'<th\b.*?</th>', inner, flags=re.S)[0])
            m = re.match(r'(Fall|Spring|Summer)', t)
            if not m: report['odd-term'].append(f'{slug}: {t}'); ok = False; term = None; continue
            term = m.group(1); continue
        if 'plangridsum' in cls:
            n = text(re.findall(r'<td\b.*?</td>', inner, flags=re.S)[-1])
            m = re.match(r'(\d+)', n)
            flush(int(m.group(1)) if m else None); term = None if False else term; term_done = True; term = None; continue
        if 'plangridtotal' in cls:
            m = re.search(r'(\d+)', text(re.findall(r'<td\b.*?</td>', inner, flags=re.S)[-1])); total = int(m.group(1)) if m else None; continue
        tds = re.findall(r'<td\b([^>]*)>(.*?)</td>', inner, flags=re.S)
        if not tds or term is None: continue
        hours = text(tds[-1][1]) if 'hourscol' in tds[-1][0] else ''
        code_html = tds[0][1]
        indented = 'blockindent' in code_html.split('</a>')[0] or 'margin-left' in code_html.split('<a')[0]
        codes = re.findall(CODE, text(code_html))
        label = text(code_html)
        if 'colspan="2"' not in tds[0][0] and codes:
            main = text(code_html.split('<div')[0]) if '<div' in code_html else label
            alts = re.findall(CODE, text(code_html[code_html.find('<div'):])) if '<div' in code_html and re.search(r'>\s*or\b', code_html) else []
            label = main + ''.join(f' or {a}' for a in alts if a not in main)
        label = re.sub(r'\((\d*)\)', r'[\1]', label).replace(' ,', ',')
        label = re.sub(r', *$', '', label)
        if not label: continue
        if hours == '':
            if indented or (items and re.search(r'(select|choose|following|one of)', items[-1][0], re.I) ) or cls == 'orclass' or 'orclass' in cls:
                items.append((label, None))
            else: report['note-row'].append(f'{slug}: {label[:60]}')
            continue
        m = re.fullmatch(r'(\d+)(?:\s*-\s*(\d+))?', hours)
        if not m: report['odd-credits'].append(f'{slug}: {label[:40]} = {hours}'); ok = False; continue
        if m.group(2): report['range'].append(f'{slug}: {label[:40]} = {hours}')
        items.append((label, int(m.group(1))))
    if term is not None and items: flush(None)
    if total is None: report['no-total'].append(slug)
    if sums_bad: report['sum-mismatch'].append(f'{slug}: ' + '; '.join(sums_bad))
    nterms = sum(1 for l in lines if l.startswith(' '))
    report[f'terms={nterms}'].append(slug)
    by_college[college].append((slug, name, '/'.join(parts) + '/', lines, total, ok, bool(sums_bad)))
os.makedirs(out, exist_ok=True)
for college, majors in by_college.items():
    with open(os.path.join(out, college + '.txt'), 'w', encoding='utf8') as fh:
        for slug, name, path, lines, total, ok, bad in majors:
            fh.write(f'## {slug} | {name} | {path}\n' + '\n'.join(lines) + f'\nTOTAL {total}\n\n')
for k, v in sorted(report.items()):
    print(f'== {k}: {len(v)}'); [print('   ', x) for x in v[:12]]
