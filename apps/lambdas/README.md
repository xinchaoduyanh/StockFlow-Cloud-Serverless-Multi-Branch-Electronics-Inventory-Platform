# AWS Serverless Lambda Workers & Infrastructure Deployment Guide

This workspace contains the codebase for all high-performance, asynchronous serverless workers, accompanied by an AWS SAM (Serverless Application Model) blueprint to provision the cloud infrastructure.

---

## 🏗️ Folder Directory Structure

```text
apps/lambdas/
├── template.yaml                         # AWS SAM Infrastructure template
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

## 🚀 Step 2: Deployment via AWS SAM (Serverless Application Model)

We use AWS SAM CLI to compile cloud blueprints, upload packages to S3, and trigger CloudFormation deployments.

### 1. Installation & Login
Verify that AWS SAM CLI and AWS CLI are installed, and you have configured active credentials:
```bash
aws configure
sam --version
```

### 2. SAM Validation
Verify that the `template.yaml` resource properties are valid and conform to CloudFormation schemas:
```bash
sam validate -t template.yaml
```

### 3. Build & Package
Prepare SAM artifacts for deployment:
```bash
sam build -t template.yaml
```

### 4. SAM Guided Deployment
Perform a guided deployment to create the cloud resources and configure environment parameters:
```bash
sam deploy --guided
```

#### Guided Prompts Configuration:
* **Stack Name:** `stockflow-serverless-pipeline`
* **AWS Region:** `ap-southeast-1` (Singapore, recommended)
* **Parameter DATABASE_URL:** Provide your high-performance pooled database connection URL (e.g., Neon `pgbouncer` pooler link).
* **Confirm changes before deploy:** `Yes`
* **Allow SAM CLI IAM role creation:** `Yes`
* **Save arguments to configuration file:** `Yes` (creates `samconfig.toml`)

---

## 🧪 Step 3: Local Testing & Validation

You can invoke individual Lambda handlers locally using SAM CLI local execution simulators:

### 1. Test Validator Handler:
Create a mockup S3 notification event payload `event.json` and invoke locally:
```bash
sam local invoke ImportValidatorFunction --event event.json
```

### 2. Test Parser Handler:
```bash
sam local invoke ImportParserFunction --event parser_event.json
```

---

## 🛡️ Best Practices & Database Connection Pooling

> [!WARNING]
> **Database Pool Size Limit:**
> To protect the Neon PostgreSQL server from connection starvation during serverless scaling, every Lambda handler holds exactly 1 connection in its internal pool. Ensure your `DATABASE_URL` parameter includes:
> `&pgbouncer=true&connection_limit=1`
