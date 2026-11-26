#!/usr/bin/env bash
set -euo pipefail

project=gen-lang-client-0064554427
project_number=9298525505
database=ai-studio-khousing-38852770-f782-474c-b219-956fbb846237
pool=khousing-github-verify
provider=refresh-check
account=khousing-gh-verify
service_account="$account@$project.iam.gserviceaccount.com"
repository_id=1456707008
owner_id=191457380
branch=refs/heads/codex/retain-source-refresh
workflow="cocoadang/k-housing/.github/workflows/check-cloud-refresh.yml@$branch"
issuer=https://token.actions.githubusercontent.com
mapping='google.subject=assertion.sub,attribute.repository_id=assertion.repository_id'
condition="assertion.repository_owner_id == '$owner_id' && assertion.repository_id == '$repository_id' && assertion.ref == '$branch' && assertion.workflow_ref == '$workflow'"

actual_number="$(gcloud projects describe "$project" --format='value(projectNumber)')"
[[ "$actual_number" == "$project_number" ]] || { echo 'Google Cloud project number mismatch' >&2; exit 1; }
gcloud firestore databases describe --project="$project" --database="$database" --format=none
gcloud secrets describe khousing-molit --project="$project" --format=none
gcloud services enable iamcredentials.googleapis.com sts.googleapis.com --project="$project" --quiet

if ! gcloud iam service-accounts describe "$service_account" --project="$project" --format=none 2>/dev/null; then
  gcloud iam service-accounts create "$account" --project="$project" \
    --display-name='K-Housing GitHub verification' --quiet
fi
if ! gcloud iam workload-identity-pools describe "$pool" --project="$project" --location=global --format=none 2>/dev/null; then
  gcloud iam workload-identity-pools create "$pool" --project="$project" --location=global \
    --display-name='K-Housing GitHub verification' --quiet
fi
if ! gcloud iam workload-identity-pools providers describe "$provider" --project="$project" \
    --location=global --workload-identity-pool="$pool" --format=none 2>/dev/null; then
  gcloud iam workload-identity-pools providers create-oidc "$provider" --project="$project" \
    --location=global --workload-identity-pool="$pool" --display-name='K-Housing refresh verification' \
    --issuer-uri="$issuer" --attribute-mapping="$mapping" --attribute-condition="$condition" --quiet
fi

# Bind only to the exact provider policy expected by the GitHub workflow.
provider_description=''
for attempt in {1..13}; do
  if provider_description="$(gcloud iam workload-identity-pools providers describe "$provider" \
      --project="$project" --location=global --workload-identity-pool="$pool" --format=json 2>&1)"; then
    break
  fi
  if [[ "$provider_description" != *NOT_FOUND* || "$attempt" == 13 ]]; then
    printf '%s\n' "$provider_description" >&2
    exit 1
  fi
  printf '%s\n' 'Waiting for the Cloud identity provider to become visible…' >&2
  sleep 10
done
python3 -c '
import json, sys
provider = json.load(sys.stdin)
expected_mapping = {"google.subject": "assertion.sub", "attribute.repository_id": "assertion.repository_id"}
if (provider.get("oidc", {}).get("issuerUri") != sys.argv[1] or provider.get("attributeCondition") != sys.argv[2]
        or provider.get("attributeMapping") != expected_mapping or provider.get("state") != "ACTIVE"
        or provider.get("disabled", False)):
    raise SystemExit("Existing provider does not match the restricted verification workflow")
' "$issuer" "$condition" <<<"$provider_description"

principal="principalSet://iam.googleapis.com/projects/$project_number/locations/global/workloadIdentityPools/$pool/attribute.repository_id/$repository_id"
gcloud iam service-accounts add-iam-policy-binding "$service_account" --project="$project" \
  --member="$principal" --role=roles/iam.workloadIdentityUser --quiet --format=none
gcloud projects add-iam-policy-binding "$project" --member="serviceAccount:$service_account" \
  --role=roles/datastore.viewer \
  --condition="expression=resource.name == 'projects/$project/databases/$database',title=khousing-verification-database-only" \
  --quiet --format=none
gcloud secrets add-iam-policy-binding khousing-molit --project="$project" \
  --member="serviceAccount:$service_account" --role=roles/secretmanager.secretAccessor --quiet --format=none
printf '%s\n' 'KHOUSING_GITHUB_VERIFY_CONNECTED'
