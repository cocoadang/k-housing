"""Offline reviewed map build. python scripts/build_registered_map_data.py SCHOOL_SOURCE REVIEW_DIR
Requires pyshp, pyproj, shapely. No live API or credentials are used.
REVIEW_DIR contains reviewed-complex-polygons.json and osm-regions/*.json.
"""
import csv, hashlib, json, math, re, sys
from pathlib import Path
import shapefile
from pyproj import CRS, Transformer
from shapely.geometry import shape, Point, mapping
from shapely.ops import transform

root = Path(__file__).resolve().parents[1]
source, review = map(Path, sys.argv[1:3])
def read(p): return json.loads(p.read_text(encoding="utf-8"))
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def csv_rows(name): return list(csv.DictReader(next((source/name).glob("*.csv")).read_text(encoding="utf-8-sig").splitlines()))
catalog = read(source/"registered-complexes.json")
footprints = read(review/"reviewed-complex-polygons.json")
assert set(footprints) == {c["id"] for c in catalog["complexes"]}
base = [b for f in ["schoolinfo-0.json", "schoolinfo-01-0.json", "schoolinfo-02-0.json"] for b in read(source/f)["list"] if b.get("SCHUL_KND_SC_CODE")=="02" and b.get("ABSCH_YN")=="N"]
counts = {b["SCHUL_CODE"]:b for f in ["schoolinfo-09.json", "schoolinfo-01-09.json", "schoolinfo-02-09.json"] for b in read(source/f)["list"]}
positions = {p["학교ID"]:p for p in csv_rows("positions") if p["학교급구분"]=="초등학교" and p["운영상태"]=="운영" and p["시도교육청코드"] in ["7010000","7151000","7530000"]}
# Busan's public snapshot uses education code 7150000/7151000 in different releases; use explicit city prefix too.
positions.update({p["학교ID"]:p for p in csv_rows("positions") if p["학교급구분"]=="초등학교" and p["운영상태"]=="운영" and p["소재지도로명주소"].startswith("부산광역시 ")})
links = csv_rows("relations")
shp = next((source/"zones").glob("*.shp"));reader=shapefile.Reader(str(shp),encoding="euc-kr")
to_geo=Transformer.from_crs(CRS.from_wkt(shp.with_suffix(".prj").read_text()),"EPSG:4326",always_xy=True)
zones={}
for r in reader.iterRecords():
    if r["SD_CD"] not in ["11","26","41"]: continue
    g=transform(to_geo.transform,shape(reader.shape(r.oid).__geo_interface__))
    zones[r["HAKGUDO_ID"]]={"record":r.as_dict(),"geometry":mapping(g),"shape":g}
def distance(lat,lng,lat2,lng2):
    dlat,dlng=math.radians(lat2-lat),math.radians(lng2-lng)
    return 6371000*2*math.asin(math.sqrt(math.sin(dlat/2)**2+math.cos(math.radians(lat))*math.cos(math.radians(lat2))*math.sin(dlng/2)**2))
def normalize(v): return re.sub(r"[\s,]","",v).replace("서울특별시","서울").replace("부산광역시","부산")
manual={"B000003734":{"schoolinfoId":"S090002247","evidenceUrl":"https://snji-e.goesn.kr/snji-e/cm/cntnts/cntntsView.do?cntntsId=4671&mi=26203"},
        "B000002694":{"schoolinfoId":"S020001671","evidenceUrl":"https://note.pen.go.kr/main/uSchool/read/03/G0001002/630"}}
schools={};proof_rows={};exceptions=[]
def school(emac_id):
    if emac_id in schools: return schools[emac_id]
    pos=positions[emac_id]
    matches=[b for b in base if b["SCHUL_NM"]==pos["학교명"] and normalize(b.get("SCHUL_RDNMA",""))==normalize(pos["소재지도로명주소"])]
    if emac_id in manual:
        matches=[b for b in base if b["SCHUL_CODE"]==manual[emac_id]["schoolinfoId"]]
        assert len(matches)==1 and matches[0]["SCHUL_NM"]==pos["학교명"]
        assert distance(float(pos["위도"]),float(pos["경도"]),matches[0]["LTTUD"],matches[0]["LGTUD"])<200
    assert len(matches)==1,(emac_id,pos["학교명"],"unreviewed identity")
    b=matches[0];c=counts.get(b["SCHUL_CODE"]);valid=c and c.get("PBAN_EXCP_YN")=="N"
    required=["COL_S_SUM","COL_C_SUM"]+[f"COL_{a}{g}" for a in ["S","C"] for g in range(1,9)]
    valid=valid and all(isinstance(c.get(k),(float,int)) and c[k]>=0 for k in required)
    grades=[{"grade":g,"students":int(c[f"COL_S{g}"]),"classes":int(c[f"COL_C{g}"])} for g in range(1,7)] if valid else []
    special_students=int(c["COL_S7"]+c["COL_S8"]) if valid else None
    special_classes=int(c["COL_C7"]+c["COL_C8"]) if valid else None
    if valid:
        assert sum(g["students"] for g in grades)+special_students==int(c["COL_S_SUM"])
        assert sum(g["classes"] for g in grades)+special_classes==int(c["COL_C_SUM"])
    else: exceptions.append({"school":pos["학교명"],"reason":"2026 official count unavailable/excluded; never represented as zero"})
    website=b.get("HMPG_ADRES","").strip()
    if website.startswith("http://"): website="https://"+website[7:]
    elif website and not website.startswith("https://"): website="https://"+website
    if emac_id=="B000002694": website="https://school.busanedu.net/sinjae-e/main.do"
    item={"id":b["SCHUL_CODE"],"emacId":emac_id,"name":pos["학교명"],"address":pos["소재지도로명주소"],"latitude":float(pos["위도"]),"longitude":float(pos["경도"]),"positionAsOf":pos["데이터기준일자"],
        "students":int(c["COL_S_SUM"]) if valid else None,"classes":int(c["COL_C_SUM"]) if valid else None,"specialStudents":special_students,"specialClasses":special_classes,"grades":grades,"studentsAsOf":"2026-04-01","disclosureYear":2026,"website":website,
        "sourceUrl":"https://www.schoolinfo.go.kr/ei/ss/Pneiss_b01_s0.do?SHL_IDF_CD="+b["SHL_IDF_CD"]}
    schools[emac_id]=item;proof_rows[emac_id]={"basic":b,"counts":c,"position":pos,"manualIdentityReview":manual.get(emac_id)}
    return item
sources=read(root/"src/data/gwacheonSchools.json")["sources"];sources={k:v for k,v in sources.items() if k!="notice"}
region_output=root/"src/data/schools";region_output.mkdir(exist_ok=True)
manifest={};region_counts={};all_selected_zones=set()
for meta in catalog["regions"]:
    region=meta["id"];cs=[c for c in catalog["complexes"] if c["subRegion"]==region]
    anchors=[footprints[c["id"]].get("anchor",{"latitude":c["latitude"],"longitude":c["longitude"]}) for c in cs]
    selected={p["학교ID"] for p in positions.values() if min(distance(float(p["위도"]),float(p["경도"]),a["latitude"],a["longitude"]) for a in anchors)<=1500}
    if region=="과천":selected.update(p["학교ID"] for p in positions.values() if p["소재지도로명주소"].startswith("경기도 과천시 "))
    zone_ids={r["학구ID"] for r in links if r["학교ID"] in selected and r["학구ID"] in zones}
    # Retain every member of a selected official joint zone, even if that campus is farther away.
    selected.update(r["학교ID"] for r in links if r["학구ID"] in zone_ids and r["학교ID"] in positions)
    items=sorted([school(sid) for sid in selected],key=lambda s:s["name"])
    features=[]
    for zid in sorted(zone_ids):
        z=zones[zid];r=z["record"];assert z["shape"].is_valid, zid;members=sorted({school(link["학교ID"])["id"] for link in links if link["학구ID"]==zid and link["학교ID"] in positions})
        assert members
        features.append({"type":"Feature","geometry":z["geometry"],"properties":{"id":zid,"name":r["HAKGUDO_NM"],"kind":{"0":"single","1":"joint","2":"oneway"}[r["HAKGUDO_GB"]],"schoolIds":members,"unavailableMembers":[{"emacId":link["학교ID"],"name":link["학교명"],"reason":"공식 연계표에는 수록되어 있으나 현행 운영학교 위치자료 없음. 휴교·변경 사항은 교육지원청 확인 필요"} for link in links if link["학구ID"]==zid and link["학교ID"] not in positions],"asOf":r["BASE_DT"],"updatedAt":r["UPD_DT"]}})
    all_selected_zones.update(zone_ids)
    data={"version":"registered-schools-20261116-v1","checkedAt":"2026-11-16","region":region,"scope":"등록 단지 대표위치 주변 약 1.5km 및 공식 공동통학구역 연계 학교 (도보거리·배정 보장 아님)","sources":sources,"schools":items,"zones":{"type":"FeatureCollection","features":features}}
    (region_output/(region+".json")).write_text(json.dumps(data,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    manifest[region]=region+".json";region_counts[region]={"schools":len(items),"zones":len(features),"complexes":len(cs)}
features=[]
for c in catalog["complexes"]:
    f=footprints[c["id"]]
    if f["status"]=="available":
        assert shape(f["geometry"]).covers(Point(f["anchor"]["longitude"],f["anchor"]["latitude"]))
        features.append({"type":"Feature","geometry":f["geometry"],"properties":{"complexId":c["id"],"name":c["name"],"sourceObjects":f["sourceObjects"]}})
fp_data={"version":"complex-footprints-20261116-v1","checkedAt":"2026-11-16","license":"ODbL-1.0","attribution":"© OpenStreetMap contributors","licenseUrl":"https://www.openstreetmap.org/copyright","scope":"공개지도에 수록된 단지 외곽 참고도형. 법적 지적경계·측량 성과가 아닙니다.","anchors":{c["id"]:footprints[c["id"]].get("anchor",{"latitude":c["latitude"],"longitude":c["longitude"]}) for c in catalog["complexes"]},"unavailable":{cid:f for cid,f in footprints.items() if f["status"]!="available"},"collection":{"type":"FeatureCollection","features":features}}
(root/"src/data/complexFootprints.json").write_text(json.dumps(fp_data,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
proof={"version":"registered-map-20261116-v1","sources":sources,"regions":region_counts,"uniqueSchools":len(schools),"uniqueZones":len(all_selected_zones),"relations":[r for r in links if r["학구ID"] in all_selected_zones],"schoolRows":list(proof_rows.values()),"exceptions":exceptions,"manualIdentityReviews":manual,"complexFootprints":{"available":len(features),"unavailable":fp_data["unavailable"],"objects":{c["id"]:footprints[c["id"]].get("sourceObjects",[]) for c in catalog["complexes"]},"conversion":"Existing closed OSM rings joined only along original shared nodes; multipolygon inner rings subtracted; same-complex parts unioned without convex hull/buffer/hand-drawn fallback."},"sourceHashes":{f.name:sha(f) for f in sorted(source.glob("schoolinfo-*.json"))},"osmSourceHashes":{f.name:sha(f) for f in sorted((review/"osm-regions").glob("*.json"))},"snapshotAsOf":"2026-11-16; student counts 2026-04-01; EMAC zones 2026-09-20; positions 2026-10-01"}
(root/"docs/validation/registered-map-evidence.json").write_text(json.dumps(proof,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"regions":region_counts,"uniqueSchools":len(schools),"uniqueZones":len(all_selected_zones),"polygons":len(features),"exceptions":exceptions},ensure_ascii=False))
