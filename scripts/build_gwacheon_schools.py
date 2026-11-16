"""Offline build from official public downloads. No credentials or runtime collection.
Usage: python scripts/build_gwacheon_schools.py INPUT_DIR
Dependencies: pyshp, pyproj. INPUT_DIR contains schoolinfo-{0,09}.json and
positions/, relations/ CSVs and zones/ SHP downloaded from sources in provenance.
"""
import csv
import hashlib
import json
import sys
from pathlib import Path
import shapefile
from pyproj import CRS, Transformer

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1])
def load(name):
    return json.loads((source / name).read_text(encoding="utf-8"))
def csv_rows(folder):
    return list(csv.DictReader(next((source / folder).glob("*.csv")).read_text(encoding="utf-8-sig").splitlines()))
def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

base = [r for r in load("schoolinfo-0.json")["list"] if r.get("ADRCD_NM") == "경기도 과천시" and r.get("SCHUL_KND_SC_CODE") == "02" and r.get("ABSCH_YN") == "N"]
counts = {r["SCHUL_CODE"]: r for r in load("schoolinfo-09.json")["list"]}
positions = [r for r in csv_rows("positions") if r["소재지도로명주소"].startswith("경기도 과천시 ") and r["학교급구분"] == "초등학교" and r["운영상태"] == "운영"]
assert len(base) == len(positions) == 6
schools = []
evidence = []
for b in base:
    matches = [r for r in positions if r["학교명"] == b["SCHUL_NM"] and r["소재지도로명주소"].strip() == b["SCHUL_RDNMA"].strip()]
    assert len(matches) == 1, b["SCHUL_NM"]
    pos = matches[0]
    c = counts[b["SCHUL_CODE"]]
    assert c["PBAN_EXCP_YN"] == "N" and c["SCHUL_NM"] == b["SCHUL_NM"]
    grades = [{"grade": g, "students": int(c[f"COL_S{g}"]), "classes": int(c[f"COL_C{g}"])} for g in range(1, 7)]
    special_students = int(c["COL_S7"] + c["COL_S8"])
    special_classes = int(c["COL_C7"] + c["COL_C8"])
    assert sum(g["students"] for g in grades) + special_students == int(c["COL_S_SUM"])
    assert sum(g["classes"] for g in grades) + special_classes == int(c["COL_C_SUM"])
    schools.append({"id": b["SCHUL_CODE"], "emacId": pos["학교ID"], "name": b["SCHUL_NM"], "address": b["SCHUL_RDNMA"],
        "latitude": float(pos["위도"]), "longitude": float(pos["경도"]), "positionAsOf": pos["데이터기준일자"],
        "students": int(c["COL_S_SUM"]), "classes": int(c["COL_C_SUM"]), "specialStudents": special_students, "specialClasses": special_classes,
        "grades": grades, "studentsAsOf": "2026-04-01", "disclosureYear": 2026,
        "website": b["HMPG_ADRES"] if b["HMPG_ADRES"].startswith("https://") else "https://" + b["HMPG_ADRES"],
        "sourceUrl": "https://www.schoolinfo.go.kr/ei/ss/Pneiss_b01_s0.do?SHL_IDF_CD=" + b["SHL_IDF_CD"]})
    evidence.append({"basic": b, "counts": c, "position": pos})
ids = {s["emacId"]: s["id"] for s in schools}
links = [r for r in csv_rows("relations") if r["학교ID"] in ids]
zids = {r["학구ID"] for r in links}
shp = next((source / "zones").glob("*.shp"))
transformer = Transformer.from_crs(CRS.from_wkt(shp.with_suffix(".prj").read_text()), "EPSG:4326", always_xy=True)
def coordinates(value):
    if isinstance(value[0], (float, int)):
        x, y = transformer.transform(*value[:2])
        assert 126 < x < 128 and 37 < y < 38
        return [round(x, 7), round(y, 7)]
    return [coordinates(v) for v in value]
features = []
reader = shapefile.Reader(str(shp), encoding="euc-kr")
for record in reader.iterRecords():
    if record["HAKGUDO_ID"] not in zids:
        continue
    assert record["SD_CD"] == "41" and record["SGG_CD"] == "290"
    geometry = reader.shape(record.oid).__geo_interface__
    features.append({"type": "Feature", "geometry": {"type": geometry["type"], "coordinates": coordinates(geometry["coordinates"])},
        "properties": {"id": record["HAKGUDO_ID"], "name": record["HAKGUDO_NM"], "kind": "single" if record["HAKGUDO_GB"] == "0" else "joint",
        "schoolIds": sorted({ids[r["학교ID"]] for r in links if r["학구ID"] == record["HAKGUDO_ID"]}),
        "asOf": record["BASE_DT"], "updatedAt": record["UPD_DT"]}})
assert len(features) == 7 and {f["properties"]["id"] for f in features} == zids
sources = {
    "students": {"name": "학교알리미 학년별·학급별 학생수 (2026)", "url": "https://www.schoolinfo.go.kr/ng/go/pnnggo_a01_l2.do", "asOf": "2026-04-01"},
    "positions": {"name": "한국교육시설안전원 초중등학교 위치", "url": "https://schoolzone.emac.kr/publicData/publicDataFileDownload.do?nttId=2967&atchFileId=FILE_000000100002997&fileSn=0", "asOf": "2026-10-01"},
    "zones": {"name": "한국교육시설안전원 초등학교 통학구역 및 공동통학구역", "url": "https://schoolzone.emac.kr/publicData/publicDataFileDownload.do?nttId=2966&atchFileId=FILE_000000100002996&fileSn=0", "asOf": "2026-09-20"},
    "relations": {"name": "한국교육시설안전원 학교-학구도 연계정보", "url": "https://schoolzone.emac.kr/publicData/publicDataFileDownload.do?nttId=2961&atchFileId=FILE_000000100002991&fileSn=0", "asOf": "2026-09-20"},
    "notice": {"name": "2026학년도 과천시 초등학교 통학구역 확정 공고 안내", "url": "https://www.goeay.kr/yulmok-e/na/ntt/selectNttInfo.do?bbsId=5581&mi=10976&nttSn=1293946", "publishedAt": "2025-11-04"}}
data = {"version": "gwacheon-schools-20261116-v1", "checkedAt": "2026-11-16", "sources": sources, "schools": schools,
        "zones": {"type": "FeatureCollection", "features": features}}
(root / "src/data/gwacheonSchools.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
proof = {"version": data["version"], "sources": sources, "sourceHashes": {str(f.relative_to(source)): digest(f) for f in sorted(source.rglob("*")) if f.is_file() and f.suffix in [".zip", ".shp", ".dbf", ".shx", ".prj", ".cpg"]},
    "schoolinfoHashes": {n: digest(source / n) for n in ["schoolinfo-0.json", "schoolinfo-09.json"]}, "schoolRows": evidence, "relations": links,
    "transform": "Source PRJ Korea 2000 Central Belt 2010 (EPSG:5186) to EPSG:4326, always_xy, 7 decimal places; no simplification or fabricated boundaries",
    "noticeStatus": "Notice listing confirmed via official web source; attachment unavailable by direct HTTP (404). Geometry and school relations are from EMAC public downloads, not reconstructed from notice text.",
    "runtime": "Versioned static snapshot; no keys, upstream requests, AI, Firestore writes or scheduler required."}
(root / "docs/validation/gwacheon-school-evidence.json").write_text(json.dumps(proof, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"schools": len(schools), "students": sum(s["students"] for s in schools), "zones": len(features), "bytes": (root / "src/data/gwacheonSchools.json").stat().st_size}))
