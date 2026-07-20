# AWS Serverless Lambda Workers & Infrastructure Deployment Guide

This workspace contains the codebase for the asynchronous serverless workers. Terraform in `infrastructure/terraform` is the only production infrastructure owner.

---

## 🏗️ Folder Directory Structure

```text
apps/lambdas/
├── import-recovery-worker/                # Terminal execution event persistence + stale scan
├── README.md                             # This deployment manual
├── import-validator/                     # Security Check & Header verification handler
├── import-parser/                        # ExcelJS Event-driven stream parser handler
├── import-approval-token-register/      # Step Functions taskToken recorder handler
├── import-job-fail-handler/              # SFN Failure handler
└── import-writer/                        # High-speed chunk database committer handler
```

---

## 🛠️ Step 1: Pre-requisites & Compiler Bundling

AWS Lambda environments are resource-constrained and charge per millisecond of execution. To maximize performance and keep cold-start latency under **100 milliseconds**, we bundle and minify our handlers using `esbuild` rather than uploading raw `node_modules` folders.

1. **Verify your local Node.js environment:**
   Ensure you have Node.js 20.x installed.
2. **Build and package Lambda handlers:**
   Run the monorepo-level compiler command to bundle all handlers to `dist/lambdas/*`:
   ```bash
   npm run build:lambdas
   ```

---

## 🚀 Step 2: Infrastructure ownership

Terraform is the only production deployment owner. Verify Terraform before creating a plan:

```bash
terraform -version
```

### 1. Terraform validation

```bash
terraform -chdir=../../infrastructure/terraform validate
```

### 2. Build & plan

```bash
npm run build:lambdas
terraform -chdir=../../infrastructure/terraform plan
```

Do not run a second SAM/CloudFormation deployment for these handlers.

---

## 🧪 Step 3: Local Testing & Validation

Run the repository test and build gates locally:

```bash
npm test -- --runInBand
npm run build:lambdas
terraform -chdir=../../infrastructure/terraform fmt -check
terraform -chdir=../../infrastructure/terraform validate
```

---

## 🛡️ Best Practices & Database Connection Pooling

> [!WARNING]
> **Database Pool Size Limit:**
> To protect the Neon PostgreSQL server from connection starvation during serverless scaling, every Lambda handler holds exactly 1 connection in its internal pool. Ensure your `DATABASE_URL` parameter includes:
> `&pgbouncer=true&connection_limit=1`
