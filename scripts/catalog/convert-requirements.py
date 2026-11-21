# Convert saved catalog requirement lists (recv/cl_*, first sc_courselist table) into requirement files for draft plans.
import re, sys, os, html, collections
src, out = sys.argv[1], sys.argv[2]
XCODE = r'([A-Z]{2,4})(?:/[A-Z]{2,4})* (\d{4}H?)'
def tx(s): return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<sup.*?</sup>|<[^>]+>', ' ', s, flags=re.S)).replace('\xa0', ' ')).strip()
def codes(s): return [f'{a} {b}' for a, b in re.findall(XCODE, s)]
def clean(label, head):
    l = re.sub(r'\((\d*)\)', r'[\1]', label).strip(' :,')
    if re.match(r'(?i)select (one|two|three|four|five|six|\d+)( additional)?( courses?)?( of the following| from the following| from)?$', l) or re.match(r'(?i)select .* following', l):
        return (head or 'Requirement') + ' (choose from list)'
    l = re.sub(r'(?i)^select (\w+|\d+)( additional)? (credits?|hours?)( in| of| from)? ', '', l)
    l = re.sub(r'(?i)^select (remaining|the minimum number of) .*', 'Free electives', l)
    l = re.sub(r'(?i)^complete remaining credit hours.*', 'Free electives', l)
    l = (l[:1].upper() + l[1:]) or 'Requirement'
    return l if len(l) <= 70 else l[:67].rstrip() + '...'
report = collections.defaultdict(list); by_college = collections.defaultdict(list)
for f in sorted(os.listdir(src)):
    if not f.startswith('cl_'): continue
    raw = open(os.path.join(src, f), encoding='utf8').read()
    if '<hd>' not in raw: continue
    parts = f[3:].split('__'); college, slug = parts[0], parts[-1]
    if slug.startswith('associate-'): report['not-a-bachelor'].append(slug); continue
    name = raw.split('\n', 1)[0].split(' | ')[0].strip()
    m = re.search(r'<table.*?</table>', raw, flags=re.S)
    if not m: report['no-table'].append(slug); continue
    items, head, total = [], '', None   # item = [label, credits|None]
    for attrs, inner in re.findall(r'<tr\b([^>]*)>(.*?)</tr>', m.group(0), flags=re.S):
        cls = (re.search(r'class="([^"]*)"', attrs) or [0, ''])[1]
        tds = re.findall(r'<td\b([^>]*)>(.*?)</td>', inner, flags=re.S)
        if not tds: continue
        first = tx(tds[0][1]); h = tx(tds[-1][1]) if 'hourscol' in tds[-1][0] else ''
        if 'areaheader' in cls or 'areasubheader' in cls: head = first.strip(' :'); continue
        if 'listsum' in cls or first.lower().startswith('total'):
            mm = re.match(r'\d+', h); total = int(mm.group()) if mm and total is None else total; continue
        if first == 'Subtotal' or not first: continue
        indented = 'margin-left' in tds[0][1] or 'blockindent' in tds[0][1]
        cs = codes(first)
        coded = bool(re.match(XCODE, re.sub(r'^or ', '', first)))
        if 'orclass' in cls and items and coded:
            items[-1][0] += f' or {cs[0]}'; continue
        if h == '':
            if indented and items: items.append([cs[0] if coded else clean(first, head), None])
            else: report['dropped-row'].append(f'{slug}: {first[:50]}')
            continue
        mm = re.fullmatch(r'(\d+)(?:\s*-\s*(\d+))?', h)
        if not mm: report['odd-credits'].append(f'{slug}: {first[:40]} = {h}'); continue
        c = min(int(mm.group(1)), int(mm.group(2) or mm.group(1)))
        if coded:
            items.append([' or '.join(dict.fromkeys(cs)) if ' or ' in first else cs[0], c])
        else:
            label = clean(first, head); n = c // 3
            sizes = [c] if c <= 4 else [3] * (n - 1) + [c - 3 * (n - 1)]
            for s in sizes: items.append([label, s])
    got = sum(c for _, c in items if c is not None)
    if total is None: report['no-total'].append(slug); total = got
    if got < total:
        d = total - got; report['padded'].append(f'{slug}: +{d}')
        n = d // 3; sizes = [d] if d <= 4 else [3] * (n - 1) + [d - 3 * (n - 1)]
        for s in sizes: items.append(['Pathways, electives and other requirements', s])
    elif got > total:
        report['over'].append(f'{slug}: {got} vs {total}'); continue
    # keep choice lists short
    slim, run = [], 0
    for l, c in items:
        run = run + 1 if c is None else 0
        if c is None and (run > 12 or len(l) > 70): continue
        slim.append((l, c))
    by_college[college].append((slug, name, '/'.join(parts) + '/', slim, total))
os.makedirs(out, exist_ok=True)
for college, majors in by_college.items():
    with open(os.path.join(out, college + '.txt'), 'w', encoding='utf8') as fh:
        fh.write('# Graduation requirements for programs whose catalog page has no roadmap (2026-2027 VT Academic Catalog, Nov 21, 2026).\n# Converted by scripts/catalog/convert-requirements.py from the first requirements table. "REQ:" lines list what to take; there is no official term order.\n\n')
        for slug, name, path, items, total in majors:
            fh.write(f'## {slug} | {name} | {path}\nREQ: ' + ''.join(f'{l} ({"" if c is None else c}), ' for l, c in items) + f'\nTOTAL {total}\n\n')
    print(college, len(majors))
for k, v in sorted(report.items()):
    print(f'== {k}: {len(v)}'); [print('   ', x) for x in v[:14]]
