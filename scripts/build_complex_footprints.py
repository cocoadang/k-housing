"""Compile reviewed OSM objects offline: python scripts/build_complex_footprints.py REVIEW_DIR. Requires shapely, pyproj. No source writes, no convex-hull/buffer fallback."""
import pathlib,json,sys
from shapely.geometry import Polygon,LineString,MultiPolygon,mapping
from shapely.ops import polygonize,unary_union
from pyproj import Geod
sys.stdout.reconfigure(encoding='utf-8');review=pathlib.Path(sys.argv[1]);p=review/'osm-regions';es={}
for f in p.glob('*.json'):
 for e in json.loads(f.read_text(encoding='utf-8'))['data']['elements']:es[e['type'],e['id']]=e
nodes={i:(e['lon'],e['lat']) for (t,i),e in es.items() if t=='node'}
refs={'banpo_acro':[('way',412614475)],'banpo_xi':[('way',165196918)],'banpo_raemian':[('way',305066918)],'mapo_raemian_prugio':[('relation',20973335)],'mapo_prestige_xi':[('relation',19439075)],'seongdong_oxu_riverzen':[('way',381941451),('way',582849967)],'seongdong_seoulforest_riverview_xi':[('way',472826085)],'yongsan_ichon_hangaram':[('relation',6197031)],'gwacheon_wieverfield':[('way',382451312),('way',382848575)],'gwacheon_xi':[('way',382848589)],'gwacheon_raemian_sur':[('way',382451313),('way',382848576)],'sanseong_foreastia':[('way',240976626)],'sanseong_xi_prugio':[('relation',18339431)],'e_pyeonhansesang_grandmaison':[('relation',19683053)],'gireum_centerpiece':[('way',877560586)],'gireum_newtown_6':[('way',877362548)],'gangdong_olympic_park':[('relation',19585227)],'gangdong_gracium':[('relation',9312278)],'gangdong_arteon':[('relation',11807078)],'busan_samick_beach':[('way',781167127)],'busan_namcheon_xi':[('way',365870582)],'busan_centum_park_1':[('way',781191130)],'busan_centum_park_2':[],'jamsil_els':[('relation',6114967)],'jamsil_ricenz':[('relation',6114968)],'jamsil_trizium':[('relation',6114970)],'gaepo_raemian_forest':[('way',392455561)],'gaepo_xi_presidence':[('way',357824808)],'gaepo_raemian_blessige':[('way',689125593)],'daechi_raemian_palace':[('way',443011156),('way',443011306)],'daechi_ipark':[('way',614507249)]}
def wayline(w):return LineString([nodes[n] for n in w['nodes']])
def geometry(ref):
 e=es[ref]
 if ref[0]=='way':
  assert e['nodes'][0]==e['nodes'][-1];return Polygon(wayline(e))
 assert e['tags']['type']=='multipolygon'
 outer=[];inner=[]
 for m in e['members']:
  assert m['type']=='way';w=es['way',m['ref']];line=wayline(w);(inner if m['role']=='inner' else outer).append(line)
 o=list(polygonize(unary_union(outer)));i=list(polygonize(unary_union(inner)));assert o
 return unary_union(o).difference(unary_union(i))
manifest={};geod=Geod(ellps='WGS84')
for cid,rs in refs.items():
 if not rs:manifest[cid]={'refs':[],'status':'unavailable','reason':'Public OSM polygon for Centum Star also covers Centum Park 2; not used as a false apartment-specific boundary. Separate campus outline needs an authoritative source.'};continue
 try:
  gs=[geometry(r) for r in rs];g=unary_union(gs);assert g.is_valid and g.geom_type in ['Polygon','MultiPolygon'];area=abs(geod.geometry_area_perimeter(g)[0]);assert 5000<area<1000000
  parts=list(g.geoms) if g.geom_type=='MultiPolygon' else [g];main=max(parts,key=lambda a:a.area);pt=main.representative_point();manifest[cid]={'refs':[list(r) for r in rs],'status':'available','geometry':mapping(g),'anchor':{'latitude':round(pt.y,7),'longitude':round(pt.x,7)},'areaSqm':round(area),'sourceObjects':[{'type':r[0],'id':r[1],'version':es[r].get('version'),'timestamp':es[r].get('timestamp'),'name':es[r]['tags'].get('name'),'url':f'https://www.openstreetmap.org/{r[0]}/{r[1]}'} for r in rs]};print(cid,round(area),manifest[cid]['anchor'])
 except Exception as ex:print('FAILED',cid,type(ex).__name__,str(ex))
manifest['busan_centum_park_2'].update({'anchor':{'latitude':35.1795137,'longitude':129.1232873},'anchorSource':'https://www.openstreetmap.org/way/784126254','reason':'독립된 단지 외곽 도형을 확인하지 못했습니다. 센텀스타 도형에 2차 단지가 함께 포함되어 있어 대신 사용하지 않습니다. 마커는 204동 위치를 참고합니다.'});out=review/'reviewed-complex-polygons.json';out.write_text(json.dumps(manifest,ensure_ascii=False),encoding='utf-8');print('compiled',len(manifest),'available',sum(x['status']=='available' for x in manifest.values()))
