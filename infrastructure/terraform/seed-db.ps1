# ============================================================
# One-off DB tasks: prisma migrate deploy + seed, run INSIDE the VPC
# (Aurora is private; these run as Fargate tasks that can reach it.)
# Requires: system_on=true (NAT exists so the task can pull the ECR image
#           and reach Secrets Manager for DATABASE_URL).
# Usage (from infrastructure/terraform):
#   ./seed-db.ps1            # migrate then seed
#   ./seed-db.ps1 -SkipSeed  # migrate only
# ============================================================
param([switch]$SkipSeed)
$ErrorActionPreference = "Stop"
$region = "ap-southeast-1"
$family = "stockflow-api"
$container = "api"

Push-Location $PSScriptRoot
$cluster = (terraform output -raw ecs_cluster_name).Trim()
$sg      = (terraform output -raw api_security_group_id).Trim()
$subnets = (terraform output -json private_subnet_ids | ConvertFrom-Json)
Pop-Location
$subnetList = ($subnets -join ",")
$netCfg = "awsvpcConfiguration={subnets=[$subnetList],securityGroups=[$sg],assignPublicIp=DISABLED}"
Write-Host "Cluster=$cluster  SG=$sg  Subnets=$subnetList" -ForegroundColor Cyan

function Invoke-OneOff([string]$label, [string[]]$cmd) {
    Write-Host "`n=== $label ===" -ForegroundColor Yellow
    $cmdJson = ($cmd | ForEach-Object { '"' + $_ + '"' }) -join ","
    $overrides = '{"containerOverrides":[{"name":"' + $container + '","command":[' + $cmdJson + ']}]}'
    $tmp = "$env:TEMP\ecs-override-$label.json"
    [System.IO.File]::WriteAllText($tmp, $overrides)

    $arn = (aws ecs run-task --cluster $cluster --task-definition $family `
        --launch-type FARGATE --network-configuration $netCfg `
        --overrides "file://$tmp" --region $region `
        --query "tasks[0].taskArn" --output text)
    if (-not $arn -or $arn -eq "None") { throw "$label : run-task failed" }
    Write-Host "task $arn started, waiting..." -ForegroundColor Gray

    aws ecs wait tasks-stopped --cluster $cluster --tasks $arn --region $region
    $exit   = (aws ecs describe-tasks --cluster $cluster --tasks $arn --region $region --query "tasks[0].containers[0].exitCode" --output text)
    $reason = (aws ecs describe-tasks --cluster $cluster --tasks $arn --region $region --query "tasks[0].stoppedReason" --output text)
    if ($exit -ne "0") {
        Write-Host "$label FAILED (exitCode=$exit, reason=$reason)" -ForegroundColor Red
        Write-Host "Check logs: aws logs tail /ecs/stockflow-api --region $region --since 10m" -ForegroundColor Red
        throw "$label failed"
    }
    Write-Host "$label OK (exitCode=0)" -ForegroundColor Green
}

# Pin versions: prisma 7 dropped `url` in schema (P1012); the API uses @prisma/client 6.x.
# npx fetches these at runtime (NAT) so they don't need to be baked into the image.
Invoke-OneOff "migrate" @("npx", "--yes", "prisma@6.19.3", "migrate", "deploy")
if (-not $SkipSeed) {
    Invoke-OneOff "seed" @("npx", "--yes", "-p", "ts-node@10.9.2", "-p", "typescript@5.9.3", "ts-node", "--transpile-only", "prisma/seed.ts")
}
Write-Host "`nDone. Verify e.g.: aws logs tail /ecs/stockflow-api --region $region --since 10m" -ForegroundColor Green
