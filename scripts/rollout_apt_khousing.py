#!/usr/bin/env python3
"""Roll out the exact verified K-Housing and Apt commits using Cloud Shell IAM."""
import json
import re
import shutil
import subprocess
import tarfile
import tempfile
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

KH_PROJECT = "gen-lang-client-0064554427"
APT_PROJECT = "busan-redevelopment"
KH_REGION = "asia-northeast3"
KH_SERVICE = "k-housing"
APT_SERVICE = "busan-redevelopment-news-monitor"
KH_COMMIT = "1a477a19885fdec0897faf0b80893701295fc681"
APT_COMMIT = "b53b30786864625f6e017a4025601f186c20059f"
DATABASE = "ai-studio-khousing-38852770-f782-474c-b219-956fbb846237"
ARCHIVE_BUCKET = "run-sources-gen-lang-client-0064554427-asia-northeast3"
COLLECTOR = "khousing-collector"
SCHEDULE = "khousing-daily"
OLD_PREVIEW = "r20261125084348_907cfe39"
REVISION_RE = re.compile(r"r[0-9]{14}_[a-f0-9]{8}")
DB_PATH = f"projects/{KH_PROJECT}/databases/{DATABASE}/documents"
DB_URL = f"https://firestore.googleapis.com/v1/{DB_PATH}"
ACTIVE = "priceRevisions/active"
FINISHED_EXECUTIONS = {"True", "False"}


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def run(*args, cwd=None, capture=False):
    return subprocess.run(
        args, cwd=cwd, text=True, check=True,
        stdout=subprocess.PIPE if capture else None,
    ).stdout


def cloud(*args, capture=False):
    return run("gcloud", *args, "--quiet", capture=capture)


def cloud_json(*args):
    return json.loads(cloud(*args, "--format=json", capture=True))


def check_resource(project, number):
    actual = cloud("projects", "describe", project, "--format=value(projectNumber)", capture=True)
    require(actual.strip() == number, f"Unexpected project number for {project}")


def describe_service(project, region, service):
    return cloud_json("run", "services", "describe", service, "--project", project, "--region", region)


def apt_location():
    for region in ("asia-northeast3", "asia-south1"):
        result = subprocess.run(
            ["gcloud", "run", "services", "describe", APT_SERVICE,
             "--project", APT_PROJECT, "--region", region, "--format=json", "--quiet"],
            capture_output=True, text=True,
        )
        if result.returncode == 0:
            return region, json.loads(result.stdout)
        if not re.search(r"not found|could not find|does not exist", result.stderr, re.I):
            raise RuntimeError(f"Cannot inspect Apt Cloud Run in {region}. {result.stderr.strip()}")
    raise RuntimeError("The existing Apt service was not found")


def db_request(path, writes=None):
    token = cloud("auth", "print-access-token", capture=True).strip()
    headers = {"Authorization": f"Bearer {token}"}
    body = None
    if writes is not None:
        body = json.dumps({"writes": writes}).encode()
        headers["Content-Type"] = "application/json"
    url = DB_URL + path if path == ":commit" else f"{DB_URL}/{path}"
    with urlopen(Request(url, data=body, headers=headers), timeout=35) as response:
        return json.load(response)


def field(document, key, kind="stringValue"):
    return document["fields"][key][kind]


def read_active():
    active = db_request(ACTIVE)
    rev = field(active, "revision")
    require(re.fullmatch(r"r[0-9]{14}(?:_[a-f0-9]{8})?", rev), "Invalid active Firestore revision")
    return active


def point_at(document, expected_update_time):
    db_request(":commit", [{
        "update": {"name": f"{DB_PATH}/{ACTIVE}", "fields": document["fields"]},
        "currentDocument": {"updateTime": expected_update_time},
    }])


def checkout(name, commit, root):
    path = root / name
    run("git", "init", "-q", str(path))
    run("git", "fetch", "-q", "--depth=1", f"https://github.com/cocoadang/{name}.git", commit, cwd=path)
    run("git", "checkout", "-q", "--detach", "FETCH_HEAD", cwd=path)
    require(run("git", "rev-parse", "HEAD", cwd=path, capture=True).strip() == commit,
            f"Unexpected source commit in {name}")
    return path


def build(path, project, region, image):
    # Use the pinned Git tree as the build context. Cloud SDK's default
    # .gcloudignore imports .gitignore, which can drop tracked source data.
    archive = path.parent / f"{path.name}-build-source.tar.gz"
    run("git", "archive", "--format=tar.gz", f"--output={archive}", "HEAD", cwd=path)
    required = {"Dockerfile", "package.json", "package-lock.json"}
    if project == KH_PROJECT:
        required.update({"src/data/complexFootprints.json", "src/data/gwacheonSchools.json"})
    if project == APT_PROJECT:
        required.update({"src/tests/fixtures/documents/compat-sample-5017.hwp",
                         "src/tests/fixtures/documents/association-1.pdf"})
    context = path.parent / f"{path.name}-build-context"
    context.mkdir(mode=0o700)
    with tarfile.open(archive) as source:
        source.extractall(context, filter="data")
    missing = sorted(name for name in required if not (context / name).is_file())
    require(not missing, f"Build context for {path.name} is missing: {', '.join(missing)}")

    # A custom ignore file prevents gcloud from importing .gitignore.
    # The context already consists of tracked files from the pinned commit.
    ignore = path.parent / "cloud-build.ignore"
    ignore.write_text("# Build context generated from the pinned Git commit.\n")
    print(f"Verified {path.name} build context contains required source files", flush=True)
    cloud("builds", "submit", str(context), "--ignore-file", str(ignore),
          "--project", project, "--region", region, "--tag", image, "--timeout", "1200s")


def traffic_of(service):
    result = {}
    for target in service["status"]["traffic"]:
        if target.get("percent", 0):
            revision = target["revisionName"]
            result[revision] = result.get(revision, 0) + target["percent"]
    require(sum(result.values()) == 100, "The live traffic allocation could not be determined")
    return result


def change_traffic(project, region, service, traffic):
    mapping = ",".join(f"{revision}={percent}" for revision, percent in traffic.items())
    cloud("run", "services", "update-traffic", service, "--project", project,
          "--region", region, "--to-revisions", mapping)


def remove_build_annotations(metadata):
    annotations = metadata.get("annotations", {})
    for key in list(annotations):
        if key.startswith("run.googleapis.com/") and ("source" in key or "build" in key):
            annotations.pop(key)


def deploy_tagged(root, project, region, service, image, tag, env, drop, original, original_export):
    require(traffic_of(describe_service(project, region, service)) == original,
            f"Live traffic changed while preparing {service}")
    # Cloud Run export can contain literal environment values. Keep it in a private temp file.
    path = root / f"{tag}.yaml"
    import yaml
    spec = yaml.safe_load(original_export)
    template = spec["spec"]["template"]
    remove_build_annotations(spec["metadata"])
    remove_build_annotations(template.setdefault("metadata", {}))
    revision = f"{service}-{tag}"
    require(len(revision) <= 63, f"Cloud Run revision name is too long: {service}")
    template["metadata"]["name"] = revision
    containers = template["spec"]["containers"]
    require(len(containers) == 1, f"Unexpected container count for {service}")
    containers[0]["image"] = image
    previous_env = containers[0].get("env", [])
    containers[0]["env"] = [item for item in previous_env if item["name"] not in set(env) | set(drop)]
    containers[0]["env"].extend({"name": key, "value": value} for key, value in env.items())
    traffic = spec["spec"].get("traffic", [])
    saved_tags = {item["tag"] for item in traffic if item.get("tag")}
    require(tag not in saved_tags, f"Cloud Run preview tag already exists: {tag}")
    current = describe_service(project, region, service)
    require(traffic_of(current) == original, f"Live traffic changed before deploying {service}")
    status_tags = current["status"]["traffic"]
    require(not any(item.get("tag") == tag for item in status_tags), f"Candidate tag already exists: {tag}")
    spec["spec"]["traffic"] = [{"revisionName": rev, "percent": pct} for rev, pct in original.items()]
    spec["spec"]["traffic"].extend({"revisionName": item["revisionName"], "tag": item["tag"]}
                                  for item in status_tags if item.get("tag"))
    spec["spec"]["traffic"].append({"revisionName": revision, "tag": tag})
    path.write_text(yaml.safe_dump(spec, sort_keys=False))
    cloud("run", "services", "replace", str(path), "--project", project, "--region", region)
    path.unlink()
    reported = describe_service(project, region, service)
    require(traffic_of(reported) == original, f"Tagged deployment changed live traffic for {service}")
    target = next((item for item in reported["status"]["traffic"]
                   if item.get("tag") == tag and item.get("revisionName") == revision), None)
    require(target and target.get("url"), f"Candidate tag was not published for {service}")
    return revision, target["url"]


def describe_collector():
    pub = cloud_json("run", "jobs", "describe", COLLECTOR,
                     "--project", KH_PROJECT, "--region", KH_REGION)
    return pub["spec"]["template"]["spec"]["template"]["spec"]


def collector_executions(job):
    return cloud_json("run", "jobs", "executions", "list", "--job", job,
                      "--project", KH_PROJECT, "--region", KH_REGION, "--limit", "30")


def collect_stage(image, job, baseline):
    old = describe_collector()
    require(old.get("serviceAccountName"), "The existing collector has no configured runtime identity")
    values = {
        "GOOGLE_CLOUD_PROJECT": KH_PROJECT, "FIRESTORE_DATABASE_ID": DATABASE,
        "SOURCE_ARCHIVE_BUCKET": ARCHIVE_BUCKET, "COLLECTOR_STAGE_ONLY": "true",
        "COLLECTOR_EXPECTED_PREVIEW_REVISION": OLD_PREVIEW, "COLLECTOR_EXTRA_BUCKETS": "11440/202601",
    }
    cloud("run", "jobs", "deploy", job, "--image", image, "--project", KH_PROJECT,
          "--region", KH_REGION, "--service-account", old["serviceAccountName"],
          "--command=node", "--args=dist/collector.cjs", "--tasks=1", "--max-retries=0",
          "--task-timeout=900s", "--cpu=1", "--memory=1Gi",
          "--set-env-vars", ",".join(f"{k}={v}" for k, v in values.items()),
          "--set-secrets=MOLIT_API_KEY=khousing-molit:latest")
    cloud("run", "jobs", "execute", job, "--wait", "--project", KH_PROJECT, "--region", KH_REGION)
    executions = collector_executions(job)
    require(len(executions) == 1, "The isolated staging job did not have exactly one execution")
    name = executions[0]["metadata"]["name"]
    query = (f'resource.type="cloud_run_job" AND resource.labels.job_name="{job}" '
             f'AND labels."run.googleapis.com/execution_name"="{name}"')
    for _ in range(12):
        entries = cloud_json("logging", "read", query, "--project", KH_PROJECT, "--limit", "200")
        for entry in entries:
            record = entry.get("jsonPayload")
            if not isinstance(record, dict) and entry.get("textPayload", "").startswith("{"):
                record = json.loads(entry["textPayload"])
            if not isinstance(record, dict) or record.get("stageOnly") is not True:
                continue
            revision = record["revision"]
            require(REVISION_RE.fullmatch(revision) and record["baselineRevision"] == field(baseline, "revision")
                    and record["verifiedPreviewGroups"] == 1018 and record["groups"] >= 1033
                    and record["candidateRecommendationRows"] > 0 and record["requiresAptReceiptRefresh"] is False,
                    "The isolated collector did not prove the expected transaction coverage")
            print(json.dumps({"stage": revision, "groups": record["groups"],
                              "recommendations": record["candidateRecommendationRows"]}), flush=True)
            return revision, record["groups"]
        time.sleep(5)
    raise RuntimeError("The isolated collector completed without a readable verification report")


def api_json(origin, path):
    with urlopen(Request(origin + path, headers={"Accept": "application/json",
                                                "User-Agent": "Apt-KHousing-Rollout/1.0"}), timeout=25) as response:
        return json.load(response)


def verify_public(apt, kh, expected, month):
    status = api_json(kh, "/api/data-status")
    require(status.get("revision") == expected, "K-Housing public reader returned another active revision")
    budget = api_json(apt, "/api/housing/apartment-budget")
    require(budget.get("revision") == expected and budget.get("incomplete") is False and budget.get("results"),
            "Apt public recommendations did not serve the expected release")
    query = urlencode({"complex": "gwacheon_raemian_sur", "family": "raemian_sur_59",
                       "start": month, "end": month})
    history = api_json(apt, "/api/housing/apartment-trade-history?" + query)
    require(history.get("source") == "K_HOUSING_SAVED_MOLIT" and history.get("rows"),
            "Apt public saved trade history is empty")
    plans = api_json(apt, "/api/housing/floor-plans/raemian-sur")
    require(isinstance(plans, list) and plans, "Apt public stored floor plans are empty")
    image = plans[0].get("image", "")
    require(image.startswith("/api/housing/floor-plans/raemian-sur?"), "Public floor plan URL is invalid")
    with urlopen(apt + image, timeout=25) as response:
        require(response.headers.get_content_type() in {"image/jpeg", "image/png", "image/webp"}
                and len(response.read(32)) == 32, "Apt public floor plan image was not returned")


def smoke_preview(apt_repo, kh_url, apt_url, revision, month):
    run("env", f"KHOUSING_PREVIEW_ORIGIN={kh_url}", f"APT_PREVIEW_ORIGIN={apt_url}",
        f"KHOUSING_EXPECTED_REVISION={revision}", f"KHOUSING_HISTORY_FIXTURE_MONTH={month}",
        "node", "ops/verify-khousing-preview.mjs", cwd=apt_repo)


def scheduler(action):
    cloud("scheduler", "jobs", action, SCHEDULE, "--project", KH_PROJECT, "--location", KH_REGION)


def safely(label, action):
    try:
        action()
        return True
    except Exception as error:
        print(f"ROLLBACK FAILED ({label}): {error}", flush=True)
        return False


def rollback_traffic(project, region, service, candidate, original):
    current = traffic_of(describe_service(project, region, service))
    if current == original:
        return
    require(current == {candidate: 100}, f"{service} traffic was modified outside this rollout")
    change_traffic(project, region, service, original)


def verify_live(expected, month, apt_region, kh_ready, apt_ready, kh_origin):
    for attempt in range(5):
        try:
            require(traffic_of(describe_service(KH_PROJECT, KH_REGION, KH_SERVICE)) == {kh_ready: 100}
                    and traffic_of(describe_service(APT_PROJECT, apt_region, APT_SERVICE)) == {apt_ready: 100},
                    "Cloud Run did not report the target revisions at 100%")
            verify_public("https://apt.dsoom.com", kh_origin, expected, month)
            return
        except (RuntimeError, URLError, TimeoutError) as error:
            if attempt == 4:
                raise
            print(f"Waiting for live verification ({error})", flush=True)
            time.sleep(8)


def rollout(root):
    import yaml  # Cloud Shell normally includes PyYAML.
    del yaml
    for name in ("gcloud", "git", "node"):
        require(shutil.which(name), f"Required command is unavailable: {name}")
    check_resource(KH_PROJECT, "9298525505")
    check_resource(APT_PROJECT, "432348267432")
    kh_before = describe_service(KH_PROJECT, KH_REGION, KH_SERVICE)
    apt_region, apt_before = apt_location()
    kh_traffic, apt_traffic = traffic_of(kh_before), traffic_of(apt_before)
    kh_export = cloud("run", "services", "describe", KH_SERVICE, "--project", KH_PROJECT,
                      "--region", KH_REGION, "--format=export", capture=True)
    apt_export = cloud("run", "services", "describe", APT_SERVICE, "--project", APT_PROJECT,
                       "--region", apt_region, "--format=export", capture=True)
    old_active = read_active()
    source_job = describe_collector()
    require(len(source_job["containers"]) == 1, "Unexpected collector container count")
    existing = source_job["containers"][0]
    old_image = existing["image"]
    require(all(item.get("name") not in {"COLLECTOR_STAGE_ONLY", "COLLECTOR_VALIDATE_ONLY",
                                        "COLLECTOR_EXPECTED_PREVIEW_REVISION"}
                for item in existing.get("env", [])), "The live collector has unexpected override settings")
    old_schedule = cloud_json("scheduler", "jobs", "describe", SCHEDULE,
                              "--project", KH_PROJECT, "--location", KH_REGION)
    require(old_schedule["state"] in {"ENABLED", "PAUSED"}, "The existing daily scheduler is not runnable")

    nonce = format(int(time.time()), "x")
    kh_repo, apt_repo = checkout("k-housing", KH_COMMIT, root), checkout("k-busan", APT_COMMIT, root)
    kh_image = f"{KH_REGION}-docker.pkg.dev/{KH_PROJECT}/cloud-run-source-deploy/k-housing:apt-{nonce}"
    apt_image = f"{apt_region}-docker.pkg.dev/{APT_PROJECT}/kbusan-images/k-busan:kh-{nonce}"
    build(kh_repo, KH_PROJECT, KH_REGION, kh_image)
    build(apt_repo, APT_PROJECT, apt_region, apt_image)
    candidate, groups = collect_stage(kh_image, f"khousing-apt-stage-{nonce}", old_active)
    manifest = db_request(f"priceRevisions/{candidate}")
    require(field(manifest, "status") == "READY" and field(manifest, "revision") == candidate,
            "The staged Firestore manifest was not sealed")
    require(read_active()["updateTime"] == old_active["updateTime"], "The active revision moved during verification")
    months = manifest["fields"]["months"]["arrayValue"]["values"]
    month = max(item["stringValue"] for item in months)
    apt_flags = {"IMPORT_FLOOR_PLANS_ON_START": "false", "IMPORT_FLOOR_PLANS_ON_POLL": "false"}
    preview_flags = {**apt_flags, "ENABLE_INTERNAL_SCHEDULER": "false"}
    _, kh_url = deploy_tagged(root, KH_PROJECT, KH_REGION, KH_SERVICE, kh_image, f"kv-{nonce}",
                              {"APT_RECOMMENDATION_PREVIEW_REVISION": candidate}, [], kh_traffic, kh_export)
    _, apt_url = deploy_tagged(root, APT_PROJECT, apt_region, APT_SERVICE, apt_image, f"av-{nonce}",
                               {**preview_flags, "APT_TRADE_MODE": "khousing-api-preview",
                                "APT_KHOUSING_PREVIEW_ORIGIN": kh_url,
                                "APT_KHOUSING_PREVIEW_REVISION": candidate},
                               ["APT_CANONICAL_TRADE_PREVIEW_REVISION"], apt_traffic, apt_export)
    smoke_preview(apt_repo, kh_url, apt_url, candidate, month)

    kh_ready, _ = deploy_tagged(root, KH_PROJECT, KH_REGION, KH_SERVICE, kh_image, f"kp-{nonce}", {},
                                ["APT_RECOMMENDATION_PREVIEW_REVISION"], kh_traffic, kh_export)
    apt_ready, _ = deploy_tagged(root, APT_PROJECT, apt_region, APT_SERVICE, apt_image, f"ap-{nonce}",
                                 {**apt_flags, "APT_TRADE_MODE": "khousing-api"},
                                 ["APT_KHOUSING_PREVIEW_ORIGIN", "APT_KHOUSING_PREVIEW_REVISION",
                                  "APT_CANONICAL_TRADE_PREVIEW_REVISION"], apt_traffic, apt_export)
    require(traffic_of(describe_service(KH_PROJECT, KH_REGION, KH_SERVICE)) == kh_traffic
            and traffic_of(describe_service(APT_PROJECT, apt_region, APT_SERVICE)) == apt_traffic,
            "Live traffic changed after the staged verification")

    paused = job_changed = pointer_changed = kh_changed = apt_changed = False
    try:
        if old_schedule["state"] == "ENABLED":
            paused = True
            scheduler("pause")
        live_executions = collector_executions(COLLECTOR)
        require(not any(
            not item.get("status", {}).get("completionTime")
            and not any(c.get("type") == "Completed" and c.get("status") in FINISHED_EXECUTIONS
                        for c in item.get("status", {}).get("conditions", []))
            for item in live_executions
        ), "A production collector execution is still running")
        job_changed = True
        cloud("run", "jobs", "update", COLLECTOR, "--image", kh_image,
              "--project", KH_PROJECT, "--region", KH_REGION)
        require(read_active()["updateTime"] == old_active["updateTime"],
                "The active Firestore revision changed before cutover")
        pointer_changed = True
        point_at(manifest, old_active["updateTime"])
        kh_changed = True
        change_traffic(KH_PROJECT, KH_REGION, KH_SERVICE, {kh_ready: 100})
        apt_changed = True
        change_traffic(APT_PROJECT, apt_region, APT_SERVICE, {apt_ready: 100})
        verify_live(candidate, month, apt_region, kh_ready, apt_ready, kh_before["status"]["url"])
        if paused:
            scheduler("resume")
        print(json.dumps({"production": "verified", "revision": candidate, "groups": groups,
                          "apt": "https://apt.dsoom.com", "collectorImage": kh_image}), flush=True)
    except BaseException:
        # Roll back only resources this execution attempted to change.
        restored = []
        if apt_changed:
            restored.append(safely("Apt Cloud Run traffic", lambda: rollback_traffic(APT_PROJECT, apt_region,
                            APT_SERVICE, apt_ready, apt_traffic)))
        if kh_changed:
            restored.append(safely("K-Housing Cloud Run traffic", lambda: rollback_traffic(KH_PROJECT, KH_REGION,
                            KH_SERVICE, kh_ready, kh_traffic)))
        if pointer_changed:
            def restore_pointer():
                current = read_active()
                if field(current, "revision") == candidate:
                    point_at(old_active, current["updateTime"])
            restored.append(safely("Firestore active revision", restore_pointer))
        if job_changed:
            restored.append(safely("daily collector image", lambda: cloud("run", "jobs", "update", COLLECTOR,
                            "--image", old_image, "--project", KH_PROJECT, "--region", KH_REGION)))
        if paused and all(restored):
            safely("daily scheduler", lambda: scheduler("resume"))
        elif paused:
            print("The collector stays paused while the failed rollback is investigated.", flush=True)
        raise


if __name__ == "__main__":
    with tempfile.TemporaryDirectory(prefix="apt-khousing-rollout-") as tmp:
        try:
            rollout(Path(tmp))
        except (RuntimeError, HTTPError, subprocess.CalledProcessError) as failure:
            raise SystemExit(f"ROLLOUT STOPPED: {failure}") from None
