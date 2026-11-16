"""Rebuild all reviewed official footprints offline from the retained public parcel snapshot.
Requires pyproj/shapely; never collects data, calls AI or sends notifications.
"""
import hashlib,json
from pathlib import Path
from pyproj import Transformer
from shapely.geometry import shape,Point,mapping
from shapely.ops import transform,unary_union
root=Path(__file__).resolve().parents[1]
source=root/"docs/validation/registered-parcel-source-20261116.json"
assert hashlib.sha256(source.read_bytes()).hexdigest()=="1cdab303181925765e8a00b681cb2d271c94a8f8031b279a270485dde287ff13"
d=json.loads(source.read_text(encoding="utf-8"))
path=root/"src/data/complexFootprints.json";fp=json.loads(path.read_text(encoding="utf-8"))
assert set(d["items"])==set(fp["anchors"]) and len(d["items"])==31
forward=Transformer.from_crs(5179,4326,always_xy=True);reverse=Transformer.from_crs(4326,5179,always_xy=True)
features=[];reviews={};pnus=set()
for cid,item in d["items"].items():
 parcels=item["parcels"];geometries=[shape(x["geometry"]) for x in parcels]
 assert all(g.is_valid and g.geom_type in ["Polygon","MultiPolygon"] for g in geometries)
 g=unary_union(geometries);assert g.is_valid and g.geom_type in ["Polygon","MultiPolygon"]
 w=transform(forward.transform,g);old=transform(reverse.transform,shape(item["baseline"]["geometry"]))
 a=fp["anchors"][cid];assert w.covers(Point(a["longitude"],a["latitude"]))
 for b in item["buildingPositions"]:
  assert w.covers(Point(*b["point"]))==b["included"],(cid,b["id"],b["name"])
 refs=[]
 for f in parcels:
  pnu=f["properties"]["pnu"];assert len(pnu)==19 and pnu.isdigit();assert pnu not in pnus;pnus.add(pnu)
  refs.append({"type":"official-parcel","id":f["id"],"pnu":pnu,"version":d["version"],"timestamp":d["checkedAt"],"name":f["properties"]["jibun"],"url":"https://www.eum.go.kr/web/ar/lu/luLandDet.jsp?pnu="+pnu,"provider":d["provider"],"license":d["license"],"sourceCrs":d["crs"]})
 features.append({"type":"Feature","geometry":mapping(w),"properties":{"complexId":cid,"name":item["name"],"sourceObjects":refs}})
 reviews[cid]={"name":item["name"],"pnus":[x["pnu"] for x in refs],"parcels":len(parcels),"oldAreaSqm":round(old.area,2),"officialReferenceAreaSqm":round(g.area,2),"intersectionOverUnion":round(old.intersection(g).area/old.union(g).area,6),"removedAreaSqm":round(old.difference(g).area,2),"addedAreaSqm":round(g.difference(old).area,2),"geometryChanged":not old.equals_exact(g,0.01),"checkedBuildingPositions":len(item["buildingPositions"]),"excludedBuildingPositions":[x for x in item["buildingPositions"] if not x["included"]]}
fp.update(version="official-parcel-footprints-20261116-v1",checkedAt=d["checkedAt"],license=d["license"],attribution=d["provider"],licenseUrl="https://www.eum.go.kr/web/am/amMain.jsp",scope="국토교통부 토지이음 공개 필지 자료를 대조한 단지 외곽 참고도형. 법적 경계 확정·측량 성과가 아닙니다.",unavailable={},collection={"type":"FeatureCollection","features":features})
path.write_text(json.dumps(fp,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
proof={"checkedAt":d["checkedAt"],"complexes":31,"newlyCompared":30,"previouslyVerified":"busan_centum_park_2","parcelCount":len(pnus),"sourceFile":source.name,"sourceSha256":hashlib.sha256(source.read_bytes()).hexdigest(),"sourceVersion":d["version"],"method":"Manually reviewed membership; original complete parcel rings transformed EPSG:5179 to EPSG:4326, selected same-complex parcels unioned only. No simplify, hull, buffer, clipping to old footprint, or straight-line bridges. K-apt corroboration and OSM building positions retained with explicit limits.","notes":["Gaepo Forest excludes neighbouring Gaepo Xi Rene parcel 1283; includes Forest 1282/1282-1.","Grandmaison retains all six K-apt subcomplex parcels 1001/1003/1008/1016/1020/1009. Old outline already covered all six; intervening roads/open areas are removed, not claimed as missing buildings.","Acro includes main 2-12 and related 2-13; querying one representative point alone misses a parcel.","Hangaram has six occupied parcels, not only its representative lot.","K-apt occasionally retains old representative numbers; current returned cadastral PNU is retained independently.","OSM building positions are corroboration, not a complete official tower inventory.","Public parcel map reference material is not a legal surveyed-boundary certification."],"reviews":reviews}
(root/"docs/validation/registered-parcel-audit-20261116.json").write_text(json.dumps(proof,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("Verified",len(features),"complexes using",len(pnus),"official parcels")
