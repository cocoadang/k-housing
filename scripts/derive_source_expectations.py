import os,json,pathlib,xml.etree.ElementTree as E,hashlib,statistics
p=pathlib.Path(os.environ.get('COLLECTOR_OUTPUT','data/private/area-resolution-source'));reg=json.loads((p/'registry.json').read_text());base=json.loads((pathlib.Path(os.environ['VERIFICATION_SNAPSHOT_DIR'])/'snapshot-monthlyComplexPrices_v2.json').read_text());plan=json.loads((p/'revision-plan.json').read_text());covered=set(plan['manifest']['covered']);out={}
normalize=lambda v:''.join(c for c in (v or '').replace('아파트','') if c not in ' ()_.-·\t\r\n').lower()
for cid,fid,district,apt,dong in [('banpo_xi','banpo_xi_59','11650','반포자이','반포동'),('banpo_xi','banpo_xi_84','11650','반포자이','반포동'),('busan_samick_beach','samick_61','26500','삼익비치','남천동')]:
 exact=next(f['exactAreas'] for f in reg[cid] if f['id']==fid);normalized={int(a*100+0.5) for a in exact};months=set(r['dealYmd'] for r in base if r['complexId']==cid and r['areaFamilyId']==fid and cid+'/'+r['dealYmd'] not in covered)
 for file in p.glob(district+'-*.xml'):
  for r in E.fromstring(file.read_text(encoding='utf-8')).findall('.//item'):
   if normalize(r.findtext('aptNm'))==normalize(apt) and normalize(r.findtext('umdNm'))==normalize(dong) and int(float(r.findtext('excluUseAr'))*100+0.5) in normalized and not ((r.findtext('cdealType') or '').strip()=='O' or (r.findtext('cdealDay') or '').strip()):months.add(file.name.split('-')[1])
 out[fid]=len(months)
fixture=pathlib.Path('docs/validation/source-expectations.json');old=json.loads(fixture.read_text());old['seriesCounts']=out;old['sourceSha256']=plan['manifest']['sourceSha256'];old['basis']='Independent Python XML parser and preserved historical baseline excluding covered months; follows registered exact-area matching to 0.01 sqm, retains raw precision. Registry 189 families; historical base 187 active families.';fixture.write_text(json.dumps(old,ensure_ascii=False,indent=2),encoding='utf-8');print(out)
