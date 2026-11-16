"""Apply reviewed official parcel after OSM/school regeneration. Offline; requires pyproj/shapely."""
import hashlib, json
from pathlib import Path
from pyproj import Transformer
from shapely.geometry import shape, mapping, Point
from shapely.ops import transform
root = Path(__file__).resolve().parents[1]
raw = root / "docs/validation/centum-park-2-parcel-5179.json"
assert hashlib.sha256(raw.read_bytes()).hexdigest() == "86924538b1e856aaf286f5553ed9089f14066bb8d1842a634326b111f198794b"
d = json.loads(raw.read_bytes())
assert len(d["features"]) == 1
f = d["features"][0]
assert f["properties"]["pnu"] == "2635010400111970000" and f["properties"]["jibun"] == "1197대"
g = shape(f["geometry"])
assert g.is_valid and 23990 < g.area < 24000
w = transform(Transformer.from_crs(5179, 4326, always_xy=True).transform, g)
inside = {"201": [129.123386658,35.17863395], "202": [129.123828689,35.17879875], "203": [129.122854783,35.17933575], "204": [129.123287289,35.17951365], "205": [129.122324658,35.18000315], "206": [129.122768814,35.18019895]}
outside = {"Centum Star A": [129.1250205,35.1774137], "Centum Star B": [129.1243196,35.1776042], "Centum Star C": [129.1242686,35.1782049], "Centum Park 1": [129.1216,35.1786]}
assert all(w.contains(Point(*xy)) for xy in inside.values())
assert not any(w.covers(Point(*xy)) for xy in outside.values())
url = "https://www.eum.go.kr/web/ar/lu/luLandDet.jsp?pnu=2635010400111970000"
ref = {"type":"official-parcel", "id": f["id"], "pnu":"2635010400111970000", "version":"20261014", "timestamp":"2026-11-16", "name":"부산광역시 해운대구 재송동 1197대", "url":url, "provider":"국토교통부 토지이음", "license":"KOGL-Type-1", "sourceCrs":"EPSG:5179"}
path = root / "src/data/complexFootprints.json"
fp = json.loads(path.read_text(encoding="utf-8"))
cid = "busan_centum_park_2"
fp["collection"]["features"] = [x for x in fp["collection"]["features"] if x["properties"]["complexId"] != cid]
fp["collection"]["features"].append({"type":"Feature", "geometry":mapping(w), "properties":{"complexId":cid, "name":"센텀파크2차", "sourceObjects":[ref]}})
fp["unavailable"].pop(cid, None)
fp.update(version="complex-footprints-20261116-v2", license="ODbL-1.0; KOGL-Type-1 (Centum Park 2)", attribution="© OpenStreetMap contributors; 국토교통부 토지이음 (센텀파크2차)")
path.write_text(json.dumps(fp,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
proof = {"checkedAt":"2026-11-16", "complexId":cid, "address":"부산광역시 해운대구 센텀중앙로 142 (재송동 1197)", "source":ref,
 "identitySources":["https://www.busan.go.kr/yesan/closing03/1520417", "https://www.haeundae.go.kr/index.do?menuCd=DOM_000000102005006002"],
 "query":{"url":"https://www.eum.ne.kr:9001/MapPlan/MapPlan", "params":{"req":"search","version":"20261014","layer":"FA","code":ref["pnu"]}, "discovery":"Official land detail HTML setTileVersion and public mpSearchMap.js getMpParcelPolygon; no key/login required"},
 "rawSha256":hashlib.sha256(raw.read_bytes()).hexdigest(), "rawFile":raw.name,
 "conversion":"EPSG:5179 to EPSG:4326 with always_xy=True; all original 13 vertices retained, no simplify/hull/buffer/manual split", "projectedAreaSqm":g.area,
 "buildingChecks":{"contained":inside,"excluded":outside,"positionsSource":"https://api.openstreetmap.org/api/0.6/map.json?bbox=129.119,35.171,129.129,35.182"},
 "licenseEvidence":{"page":url,"text":"데이터는 공공누리 출처표시 조건에 따라 자유이용이 가능합니다.","mark":"https://www.eum.go.kr/web/images/ar/nuri.png"},
 "caveat":"Official publicly displayed cadastral reference geometry, not a certified survey or legal boundary determination. Snapshot/version is not a guarantee of current surveyed boundaries."}
(root/"docs/validation/centum-park-2-evidence.json").write_text(json.dumps(proof,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("Applied exact official parcel; six apartment towers inside, Star/Park1 outside; 31 footprints")
