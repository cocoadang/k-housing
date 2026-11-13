"""Independent XML validation; does not import the TypeScript collector or its parser."""
import json
import pathlib
import re
import xml.etree.ElementTree as ET

base = pathlib.Path('data/private')
registry = {c['id']: c for c in json.loads((base / 'registered-complexes.json').read_text(encoding='utf-8'))}
source = json.loads((base / 'current-source/transactions.json').read_text(encoding='utf-8'))
raw = {}
for filename in (base / 'current-source').glob('*.xml'):
    district, month, _ = filename.stem.split('-')
    raw.setdefault((district, month), []).extend(ET.fromstring(filename.read_text(encoding='utf-8')).findall('./body/items/item'))

def normalize(value):
    return re.sub(r'[\s()_.\-·]', '', value or '').replace('아파트', '').lower()

for transaction in source:
    complex_info = registry[transaction['complexId']]
    names = {normalize(s) for s in [complex_info['name'], complex_info['shortName'], *complex_info.get('apiAliases', [])]}
    candidates = raw[(complex_info['lawdCd'], transaction['dealYmd'])]
    rows = [r for r in candidates
            if normalize(r.findtext('aptNm')) in names
            and normalize(r.findtext('umdNm')) == normalize(complex_info['dong'])
            and float(r.findtext('excluUseAr')) == transaction['exclusiveArea']
            and int(r.findtext('floor')) == transaction['floor']
            and int(r.findtext('dealDay')) == transaction['dealDay']
            and int(r.findtext('dealAmount').replace(',', '').strip()) == transaction['price']]
    valid = sum(not ((r.findtext('cdealType') or '').strip() == 'O' or (r.findtext('cdealDay') or '').strip()) for r in rows)
    assert valid == transaction['activeCount'], (transaction['id'], valid, transaction['activeCount'])
    assert len(rows) - valid == transaction['cancellationRowCount']
    assert set(transaction['sourceAptSeqs']) == {r.findtext('aptSeq') for r in rows if r.findtext('aptSeq')}

report = {'passed': True, 'checkedCanonicalGroups': len(source), 'method': 'Independent Python XML parsing, registered alias/dong checks, row-status counts and aptSeq provenance'}
pathlib.Path('data/independent-raw-verification.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report))
