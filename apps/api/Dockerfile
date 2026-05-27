# ==========================================
# STAGE 1: Base image with system dependencies
# ==========================================
FROM node:20-slim AS base

# Install openssl and ca-certificates (required by Prisma and AWS SDK)
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ==========================================
# STAGE 2: Install ALL dependencies (Dev + Prod)
# ==========================================
FROM base AS dependencies

# Copy monorepo workspace configurations
COPY package.json package-lock.json tsconfig.base.json turbo.json ./

# Copy package.json files for all workspace apps/packages to satisfy npm workspace linking
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies including devDependencies for compilation (--ignore-scripts avoids husky hooks)
RUN npm ci --ignore-scripts

# ==========================================
# STAGE 3: Build the application
# ==========================================
FROM dependencies AS builder

# Copy local shared package and apps source code
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Build the shared monorepo package first
RUN npm run build --workspace=@stockflow/shared

# Generate Prisma Client (required for compiling NestJS API)
RUN npm run prisma:generate --workspace=@stockflow/api

# Build the NestJS API application
RUN npm run build --workspace=@stockflow/api

# ==========================================
# STAGE 4: Install PRODUCTION dependencies only
# ==========================================
FROM base AS prod-dependencies

# Copy monorepo configurations
COPY package.json package-lock.json tsconfig.base.json turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# Install only production dependencies (--ignore-scripts avoids husky hooks)
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# ==========================================
# STAGE 5: Final runtime runner image
# ==========================================
FROM base AS runner

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Copy production node_modules from STAGE 4
COPY --from=prod-dependencies /app/node_modules ./node_modules

# Copy compiled shared package dist and package.json from STAGE 3
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json

# Copy compiled NestJS API build output and package.json from STAGE 3
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

# Copy Prisma schema and generated clients from builder to prevent runtime client errors
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/node_modules/.prisma ./apps/api/node_modules/.prisma
COPY --from=builder /app/apps/api/node_modules/@prisma/client ./apps/api/node_modules/@prisma/client

# Set working directory to the API folder
WORKDIR /app/apps/api

# Start the NestJS application
CMD ["node", "dist/main.js"]
