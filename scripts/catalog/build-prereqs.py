# Build data/prereqs.txt from saved subject pages (<dir>/pq_<subject>): keeps every course named in data/roadmaps or data/requirements.
# Usage: python3 scripts/catalog/build-prereqs.py <dir>   (run from the repo root). Prints codes with no catalog entry.
import sys, re, glob
allc = {}
for f in glob.glob(sys.argv[1] + '/pq_*'):
    for line in open(f, encoding='utf8'):
        p = [x.strip() for x in line.rstrip('\n').split(' | ')]
        if len(p) < 4: p = [x.strip() for x in line.rstrip('\n').split('|')]
        if len(p) == 4 and re.fullmatch(r'[A-Z]{2,4} \d{4}H?', p[0]): allc[p[0]] = p
text = ''.join(open(f, encoding='utf8').read() for f in glob.glob('data/roadmaps/*.txt') + glob.glob('data/requirements/*.txt'))
want = sorted(set(re.findall(r'[A-Z]{2,4} \d{4}H?', text)), key=lambda c: (c.split()[0], c.split()[1]))
head = ['# Prerequisites and corequisites for every course named on a saved roadmap or requirement list.',
        '# Read from catalog.vt.edu/course-descriptions/<subject>/ (2026-2027 catalog), Nov 21, 2026, one subject page at a time in a browser.',
        '# Format: CODE | title | prerequisites | corequisites   (text exactly as the catalog prints it)']
open('data/prereqs.txt', 'w', encoding='utf8').write('\n'.join(head + [' | '.join(allc[c]).replace(' |  | ', ' | | ').rstrip() for c in want if c in allc]) + '\n')
print(len(want), 'wanted;', 'missing:', ' '.join(c for c in want if c not in allc))
