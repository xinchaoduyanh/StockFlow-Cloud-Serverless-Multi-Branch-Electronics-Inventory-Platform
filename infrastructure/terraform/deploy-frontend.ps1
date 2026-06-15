# ============================================================
# Phase 7 - Deploy frontend to S3 + CloudFront
# Run AFTER `terraform apply` created the web bucket + distribution.
# Usage (from infrastructure/terraform):
#   ./deploy-frontend.ps1
# ============================================================
$ErrorActionPreference = "Stop"

$tfDir    = $PSScriptRoot
$repoRoot = Resolve-Path "$tfDir\..\.."
$webDir   = "$repoRoot\apps\web"

# --- 1. Read infra values from terraform output ---
Push-Location $tfDir
$bucket = (terraform output -raw web_bucket).Trim()
$distId = (terraform output -raw cloudfront_distribution_id).Trim()
Pop-Location
Write-Host "Bucket = $bucket" -ForegroundColor Cyan
Write-Host "Distribution = $distId" -ForegroundColor Cyan

# --- 2. Generate apps/web/.env.production (NEXT_PUBLIC_* baked at build time) ---
# API has global prefix /api => keep the suffix (see apps/web/src/lib/api-client.ts).
# Cognito IDs are public, not secrets. Pusher key/cluster left blank until realtime is needed.
$envContent = @"
NEXT_PUBLIC_API_URL=https://api.vuduyanh.id.vn/api
NEXT_PUBLIC_AUTH_MODE=cognito
NEXT_PUBLIC_COGNITO_REGION=ap-southeast-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=ap-southeast-1_ITWsr9wwd
NEXT_PUBLIC_COGNITO_CLIENT_ID=4sqtgvsdfb2n3ko6j70a59u6ec
NEXT_PUBLIC_PUSHER_KEY=
NEXT_PUBLIC_PUSHER_CLUSTER=
"@
[System.IO.File]::WriteAllText("$webDir\.env.production", $envContent)
Write-Host "Wrote $webDir\.env.production" -ForegroundColor Green

# --- 3. Build static export (Next output: 'export' => apps/web/out) ---
Push-Location $repoRoot
npm run build:web
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "build:web failed" }
Pop-Location

# --- 4. Sync to S3 (delete stale) + 5. CloudFront invalidation ---
aws s3 sync "$webDir\out" "s3://$bucket/" --delete
if ($LASTEXITCODE -ne 0) { throw "s3 sync failed" }
aws cloudfront create-invalidation --distribution-id $distId --paths "/*" --query "Invalidation.Status" --output text
Write-Host "Deploy done. Wait for invalidation Completed, then open https://app.vuduyanh.id.vn" -ForegroundColor Green
