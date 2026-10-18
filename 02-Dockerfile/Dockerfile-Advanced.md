# 2 - Dockerfile Advanced

Verdieping bij de [Dockerfile-les](Dockerfile-Intro.md). Ken je de basis (FROM, COPY, RUN, CMD, build en push)?
Dan vind je hier de technieken voor kleinere, veiligere en productieklare images.
Een overzicht van alle instructies staat in de [Dockerfile cheatsheet](Dockerfile-Cheatsheet.md).

**Inhoud**

- A. Van container naar image zonder Dockerfile (`docker commit`)
- B. Multi-stage builds
- C. Images kleiner maken en builds debuggen
- D. Security best practices
- E. Production-ready Dockerfile en CI/CD
- 1–11. Meer instructies en technieken: ARG, ONBUILD, STOPSIGNAL, SHELL, HEALTHCHECK, LABEL,
  geavanceerde multi-stage, `.dockerignore`, security, BuildKit, praktische voorbeelden

---

## A. Van container naar image zonder Dockerfile (`docker commit`)

### Methode 1: Container modificatie en commit

**Het oude handmatige proces:**

```bash
# Stap 1: Start een basis container
docker run -it --name website-builder nginx:1.27-alpine sh

# Stap 2: Ga in de container en maak wijzigingen
# (In een nieuwe terminal)
docker exec -it website-builder sh

# Binnen de container:
cd /usr/share/nginx/html
rm index.html
echo "<h1>Mijn website</h1><p>Versie 1.0</p>" > index.html
exit

# Stap 3: Stop de container
docker stop website-builder

# Stap 4: Commit de wijzigingen naar een nieuwe image
docker commit website-builder mijn-website:v1.0

# Stap 5: Test de nieuwe image
docker run --rm -p 8080:80 mijn-website:v1.0

# Stap 6: Cleanup
docker rm website-builder
```

**Problemen met deze aanpak:**
- 🔥 **Niet reproduceerbaar**: Handmatige stappen kunnen vergeten worden
- 🔥 **Geen documentatie**: Niemand weet wat er precies is gedaan
- 🔥 **Foutgevoelig**: Menselijke fouten creëpen erin
- 🔥 **Niet automatiseerbaar**: Geen deel van CI/CD pipeline
- 🔥 **Geen versie controle**: Moeilijk om wijzigingen bij te houden

---

## B. Multi-stage builds

### Het probleem met grote development images

**Traditionele build met development tools:**
```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install              # Inclusief devDependencies
COPY . .
RUN npm run build           # Build tools blijven in image
EXPOSE 3000
CMD ["npm", "start"]
```

**Problemen:**
- 🔥 **Grote image size**: Development tools blijven in productie image
- 🔥 **Security risico**: Onnodige tools en dependencies
- 🔥 **Slow deployments**: Grote images betekenen langere push/pull tijden

### Multi-stage build oplossing

**Scheiding van build en runtime:**

```dockerfile
# Stage 1: Build stage
FROM node:18 AS builder
WORKDIR /app

# Installeer alle dependencies (inclusief dev)
COPY package*.json ./
RUN npm ci

# Kopieer source code en build
COPY . .
RUN npm run build

# Stage 2: Production stage
FROM node:18-alpine AS production
WORKDIR /app

# Installeer alleen productie dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Kopieer alleen de gebouwde bestanden uit build stage
COPY --from=builder /app/dist ./dist

# Security: non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs
USER nodejs

EXPOSE 3000
CMD ["node", "dist/server.js"]
```

### Praktisch voorbeeld: React applicatie

```dockerfile
# Stage 1: Build React app
FROM node:18 AS build
WORKDIR /app

# Dependencies installeren
COPY package*.json ./
RUN npm ci

# Source code en build
COPY . .
RUN npm run build

# Stage 2: Serve met nginx
FROM nginx:1.27-alpine AS production

# Kopieer build output naar nginx
COPY --from=build /app/build /usr/share/nginx/html

# Custom nginx configuratie voor SPA
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Nginx configuratie voor SPA (nginx.conf):**
```nginx
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    
    server {
        listen 80;
        server_name localhost;
        root /usr/share/nginx/html;
        index index.html;

        # SPA routing: alle requests naar index.html
        location / {
            try_files $uri $uri/ /index.html;
        }

        # Caching voor static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

### Voordelen van multi-stage builds

**Size vergelijking:**
```bash
# Single stage build
docker build -t my-app:single-stage .
# Image size: ~500MB (met development tools)

# Multi-stage build
docker build -t my-app:multi-stage --target production .
# Image size: ~150MB (alleen runtime)

# Size vergelijking
docker images | grep my-app
```

**Security voordelen:**
- ✅ **Kleinere attack surface**: Geen development tools
- ✅ **Fewer vulnerabilities**: Minder geïnstalleerde packages
- ✅ **Clean runtime**: Alleen wat nodig is voor productie

### Geavanceerde multi-stage technieken

**Verschillende targets voor verschillende omgevingen:**

```dockerfile
# Base stage
FROM node:18 AS base
WORKDIR /app
COPY package*.json ./

# Development stage
FROM base AS development
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build
RUN npm ci
COPY . .
RUN npm run build
RUN npm run test

# Production stage
FROM node:18-alpine AS production
WORKDIR /app
RUN npm ci --only=production
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.js"]

# Testing stage
FROM build AS testing
RUN npm run test:coverage
CMD ["npm", "run", "test:watch"]
```

**Bouwen van specifieke stages:**
```bash
# Development image
docker build --target development -t my-app:dev .

# Production image  
docker build --target production -t my-app:prod .

# Testing image
docker build --target testing -t my-app:test .
```

---

---

## C. Images kleiner maken en builds debuggen
### Image grootte optimalisatie

**Technieken voor kleinere images:**

1. **Alpine Linux basis images:**
```dockerfile
# Groot: ~900MB
FROM node:18

# Klein: ~150MB  
FROM node:18-alpine
```

2. **Multi-stage builds:**
```dockerfile
FROM node:18 AS builder
# ... build steps

FROM node:18-alpine AS production
COPY --from=builder /app/dist ./dist
```

3. **Package cleanup:**
```dockerfile
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl \
        nginx \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
```

4. **Distroless images voor ultieme security:**
```dockerfile
FROM gcr.io/distroless/nodejs18-debian11
COPY --from=builder /app/dist /app
WORKDIR /app
CMD ["server.js"]
```

### Build debugging

**Inspecteer build stappen:**
```bash
# Bekijk build geschiedenis
docker history my-app:latest

# Debug build met intermediate containers
docker build --no-cache .

# Stop build bij specifieke stage voor debugging
docker build --target development .
docker run -it my-app:dev sh
```

**Troubleshooting veelvoorkomende problemen:**

1. **"COPY failed: no such file or directory"**
```bash
# Check build context
docker build --no-cache --progress=plain .

# Verify .dockerignore
cat .dockerignore
```

2. **"Package not found" errors:**
```dockerfile
# Update package index voor installaties
RUN apt-get update && apt-get install -y package-name

# Voor Alpine
RUN apk update && apk add package-name
```

3. **Permission denied errors:**
```dockerfile
# Set correct ownership
COPY --chown=user:group file destination

# Or fix permissions
RUN chown -R user:group /app
```

---

---

## D. Security best practices

### Container security fundamentals

**1. Non-root gebruikers:**
```dockerfile
# Maak dedicated user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Switch naar non-root
USER appuser

# Voor Alpine
RUN addgroup -g 1001 -S appgroup \
    && adduser -S appuser -u 1001 -G appgroup

# Voor Ubuntu/Debian
RUN groupadd -r appgroup && useradd -r -g appgroup appuser
```

**2. Minimale privileges:**
```dockerfile
# Alleen nodige capabilities
FROM nginx:alpine
RUN apk add --no-cache curl
# Geen sudo, geen package managers in production image
```

**3. Read-only root filesystem:**
```dockerfile
# Maak writable directories
RUN mkdir -p /app/tmp /app/logs \
    && chown appuser:appgroup /app/tmp /app/logs

USER appuser

# Run met read-only root
# docker run --read-only --tmpfs /app/tmp my-app
```

### Vulnerability scanning

**Scan images voor kwetsbaarheden:**
```bash
# Docker Scout (built-in)
docker scout quickview my-app:latest
docker scout cves my-app:latest

# Trivy scanner
trivy image my-app:latest

# Snyk scanner
snyk container test my-app:latest
```

**Security in CI/CD:**
```yaml
# GitHub Actions voorbeeld
name: Security Scan
on: [push]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build image
        run: docker build -t ${{ github.sha }} .
      - name: Run Trivy scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ github.sha }}
          format: 'sarif'
          output: 'trivy-results.sarif'
```

### Secrets management

**❌ NEVER do this:**
```dockerfile
# SLECHT: Secrets in Dockerfile
ENV DATABASE_PASSWORD=secret123
ENV API_KEY=abc123def456

# SLECHT: Secrets in build args
ARG DATABASE_PASSWORD
ENV DATABASE_PASSWORD=$DATABASE_PASSWORD
```

**✅ Proper secrets handling:**
```dockerfile
# Gebruik environment variabelen tijdens runtime
ENV DATABASE_PASSWORD_FILE=/run/secrets/db_password

# Of verwijs naar secret management systeem
ENV DATABASE_PASSWORD_FROM=vault:secret/db#password
```

**Runtime secrets:**
```bash
# Met Docker secrets (Swarm)
echo "secret123" | docker secret create db_password -
docker service create --secret db_password my-app

# Met environment files
docker run --env-file .env.production my-app

# Met externe secret management
docker run -e DATABASE_PASSWORD="$(vault kv get -field=password secret/db)" my-app
```

---

---

## E. Production-ready Dockerfile en CI/CD

### Complete productie voorbeeld

**Volledig geoptimaliseerde Dockerfile voor Node.js:**

```dockerfile
# Multi-stage build for Node.js application
ARG NODE_VERSION=18
ARG ALPINE_VERSION=3.18

# Stage 1: Base with dependencies
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS base

# Install security updates
RUN apk update && apk upgrade && \
    apk add --no-cache \
        dumb-init \
        curl \
        tzdata \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Stage 2: Dependencies installation
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci --include=dev && npm cache clean --force

# Stage 3: Build application
FROM deps AS build
WORKDIR /app

# Copy source code
COPY . .

# Build application
RUN npm run build

# Run tests
RUN npm run test

# Stage 4: Production runtime
FROM base AS production

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Metadata
LABEL maintainer="your-email@company.com"
LABEL version="1.0.0"
LABEL description="Production Node.js application"

WORKDIR /app

# Copy package files and install only production deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application from build stage
COPY --from=build --chown=nodejs:nodejs /app/dist ./dist

# Create necessary directories with correct permissions
RUN mkdir -p /app/logs /app/tmp && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Expose port
EXPOSE ${PORT}

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
```

**.dockerignore voor productie:**
```
# Development files
node_modules
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build outputs (will be generated)
dist
build
coverage
.nyc_output

# Environment files
.env*
!.env.example

# Git
.git
.gitignore

# IDE
.vscode
.idea
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Documentation
README.md
*.md
docs/

# Docker
Dockerfile*
.dockerignore
docker-compose*.yml

# Testing
test/
tests/
__tests__/
*.test.js
*.spec.js

# Logs
logs/
*.log

# Temporary files
tmp/
temp/
```

### CI/CD integratie

**GitHub Actions workflow:**
```yaml
name: Build and Deploy
on:
  push:
    branches: [main]
    tags: ['v*']

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    
    steps:
      - name: Checkout
        uses: actions/checkout@v3
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
      
      - name: Log in to Container Registry
        uses: docker/login-action@v2
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v4
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
      
      - name: Build and push
        uses: docker/build-push-action@v4
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          build-args: |
            BUILD_DATE=${{ fromJSON(steps.meta.outputs.json).labels['org.opencontainers.image.created'] }}
            VERSION=${{ fromJSON(steps.meta.outputs.json).labels['org.opencontainers.image.version'] }}
            COMMIT_SHA=${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

---

---

# Meer instructies en technieken

## 1. ARG - Build-time Variabelen

De `ARG` instructie definieert variabelen die tijdens de build-tijd kunnen worden doorgegeven.

### Basis Gebruik

```dockerfile
# Definieer een build argument
ARG NODE_VERSION=18

# Gebruik het argument in FROM
FROM node:${NODE_VERSION}

# Definieer meer argumenten met standaardwaarden
ARG APP_ENV=production
ARG BUILD_DATE
ARG VERSION=1.0.0

# Gebruik argumenten in andere instructies
LABEL build_date=${BUILD_DATE}
LABEL version=${VERSION}
LABEL environment=${APP_ENV}
```

### Build met Argumenten

```bash
# Build met standaardwaarden
docker build -t myapp .

# Build met custom waarden
docker build \
  --build-arg NODE_VERSION=20 \
  --build-arg APP_ENV=development \
  --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
  --build-arg VERSION=2.1.0 \
  -t myapp:dev .
```

### Geavanceerd ARG Gebruik

```dockerfile
# Globale ARGs (beschikbaar in alle stages)
ARG BUILDPLATFORM
ARG TARGETPLATFORM

FROM --platform=${BUILDPLATFORM} alpine AS builder
ARG TARGETPLATFORM
RUN echo "Ik bouw op ${BUILDPLATFORM} voor ${TARGETPLATFORM}"

# Stage-specifieke ARGs
FROM node:18 AS runtime
ARG APP_ENV
ARG DEBUG_ENABLED=false

# ARG herdefiniëren na FROM
ARG VERSION
LABEL app.version=${VERSION}
```

## 2. ONBUILD - Trigger Instructies

`ONBUILD` instructies worden uitgevoerd wanneer de image als basis wordt gebruikt voor een andere build.

### Parent Image met ONBUILD

```dockerfile
# mybase:latest
FROM node:18

# Deze instructies worden uitgevoerd in child images
ONBUILD COPY package*.json ./
ONBUILD RUN npm ci --only=production
ONBUILD COPY . .

WORKDIR /app
EXPOSE 3000
CMD ["node", "index.js"]
```

### Child Image

```dockerfile
# Deze build zal automatisch de ONBUILD instructies uitvoeren
FROM mybase:latest

# Automatisch uitgevoerd:
# COPY package*.json ./
# RUN npm ci --only=production  
# COPY . .
```

### Praktisch Voorbeeld

```dockerfile
# Base image voor Node.js apps
FROM node:18-alpine AS nodebase

WORKDIR /app

# Setup voor alle Node.js projecten
ONBUILD COPY package*.json ./
ONBUILD RUN npm ci --only=production && npm cache clean --force
ONBUILD COPY . .
ONBUILD RUN chown -R node:node /app

USER node
EXPOSE 3000
```

## 3. STOPSIGNAL - Graceful Shutdown

Definieer welk signaal naar de container wordt gestuurd om deze stop te zetten.

```dockerfile
FROM nginx:alpine

# Gebruik SIGQUIT voor nginx (standaard is SIGTERM)
STOPSIGNAL SIGQUIT

# Voor Node.js applicaties
# STOPSIGNAL SIGTERM

# Voor Java applicaties  
# STOPSIGNAL SIGTERM
```

### Graceful Shutdown in Node.js

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Zorg voor graceful shutdown
STOPSIGNAL SIGTERM

# Script dat SIGTERM afhandelt
CMD ["node", "server.js"]
```

```javascript
// server.js - graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM ontvangen, server wordt afgesloten...');
  server.close(() => {
    console.log('Server afgesloten');
    process.exit(0);
  });
});
```

## 4. SHELL - Custom Shell

Wijzig de standaard shell voor RUN, CMD en ENTRYPOINT instructies.

### Windows Containers

```dockerfile
FROM mcr.microsoft.com/windows/servercore:ltsc2019

# Gebruik PowerShell in plaats van cmd
SHELL ["powershell", "-Command", "$ErrorActionPreference = 'Stop';"]

RUN Write-Host 'Hello from PowerShell!'

# Of gebruik cmd met specifieke opties
SHELL ["cmd", "/S", "/C"]
RUN echo "Hello from cmd"
```

### Linux met Custom Shell

```dockerfile
FROM ubuntu:20.04

# Gebruik bash met strikte foutafhandeling
SHELL ["/bin/bash", "-euxo", "pipefail", "-c"]

# Nu zullen alle RUN commands deze shell gebruiken
RUN apt-get update
RUN apt-get install -y python3

# Reset naar standaard shell
SHELL ["/bin/sh", "-c"]
```

## 5. HEALTHCHECK - Container Health Monitoring

Definieer hoe Docker de health van je container kan controleren.

### Basis Healthcheck

```dockerfile
FROM nginx:alpine

# Eenvoudige HTTP healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:80/ || exit 1

# Installeer curl voor healthcheck
RUN apk add --no-cache curl
```

### Geavanceerde Healthcheck

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Custom healthcheck script
COPY healthcheck.js ./

# Geavanceerde healthcheck configuratie
HEALTHCHECK \
  --interval=30s \
  --timeout=10s \
  --start-period=60s \
  --retries=3 \
  CMD node healthcheck.js

EXPOSE 3000
CMD ["node", "server.js"]
```

```javascript
// healthcheck.js
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/health',
  timeout: 5000
};

const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    process.exit(0); // Healthy
  } else {
    process.exit(1); // Unhealthy
  }
});

req.on('error', () => {
  process.exit(1); // Unhealthy
});

req.on('timeout', () => {
  req.destroy();
  process.exit(1); // Unhealthy
});

req.end();
```

### Database Healthcheck

```dockerfile
FROM postgres:15-alpine

# PostgreSQL healthcheck
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD pg_isready -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-postgres} || exit 1
```

## 6. LABEL - Metadata en Annotaties

Voeg metadata toe aan je images voor betere organisatie en automatisering.

### Standaard Labels

```dockerfile
FROM node:18-alpine

# OCI (Open Container Initiative) labels
LABEL org.opencontainers.image.title="My Application"
LABEL org.opencontainers.image.description="Een voorbeeldapplicatie"
LABEL org.opencontainers.image.version="1.2.3"
LABEL org.opencontainers.image.authors="john@example.com"
LABEL org.opencontainers.image.url="https://github.com/user/repo"
LABEL org.opencontainers.image.source="https://github.com/user/repo"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
LABEL org.opencontainers.image.revision="${GIT_COMMIT}"

# Custom labels
LABEL com.company.team="devops"
LABEL com.company.environment="production"
LABEL maintainer="devops@company.com"
```

### Multi-line Labels

```dockerfile
# Efficiënte manier om meerdere labels te definiëren
LABEL org.opencontainers.image.title="My App" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.description="Een geweldige applicatie" \
      maintainer="dev@company.com"
```

### Labels bekijken

```bash
# Bekijk labels van een image
docker image inspect myapp:latest | jq '.[0].Config.Labels'

# Filter images op labels
docker images --filter "label=org.opencontainers.image.version=1.0.0"
```

## 7. Multi-stage Builds Geavanceerd

### Named Stages en Selective Copy

```dockerfile
# Build stage
FROM node:18-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Test stage
FROM dependencies AS test
COPY . .
RUN npm test

# Build stage
FROM dependencies AS build
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html

# Development stage met alle dependencies
FROM dependencies AS development
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]
```

### Build Specific Stages

```bash
# Build alleen de test stage
docker build --target test -t myapp:test .

# Build alleen production
docker build --target production -t myapp:prod .

# Build development
docker build --target development -t myapp:dev .
```

### Cross-platform Builds

```dockerfile
FROM --platform=$BUILDPLATFORM node:18-alpine AS build
ARG TARGETPLATFORM
ARG BUILDPLATFORM

RUN echo "Ik bouw op $BUILDPLATFORM, target is $TARGETPLATFORM"

# Install dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Build application
COPY . .
RUN npm run build

# Runtime stage
FROM --platform=$TARGETPLATFORM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
```

## 8. .dockerignore Geavanceerd

### Complexe Ignore Patterns

```dockerignore
# Negatie patterns
*
!src/
!package*.json
!public/
!*.config.js

# Specifieke uitzonderingen
**/*.log
**/*.tmp
!important.log

# Conditionele patterns
**/.git
**/node_modules
**/.env.local
**/.env.*.local

# Build artifacts
dist/
build/
*.tgz
*.tar.gz

# Test files
**/__tests__/
**/*.test.js
**/*.spec.js
coverage/

# Documentation
docs/
*.md
!README.md

# IDE files
.vscode/
.idea/
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db
```

## 9. Security Best Practices

### Non-root User

```dockerfile
FROM node:18-alpine

# Maak een specifieke user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S -u 1001 -G nodejs nodejs

WORKDIR /app

# Kopieer en installeer als root
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Verander ownership
COPY --chown=nodejs:nodejs . .

# Switch naar non-root user
USER nodejs

EXPOSE 3000
CMD ["node", "server.js"]
```

### Minimale Attack Surface

```dockerfile
FROM node:18-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Distroless image voor minimale attack surface
FROM gcr.io/distroless/nodejs18-debian11

WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

EXPOSE 3000
CMD ["dist/server.js"]
```

### Secrets Handling

```dockerfile
FROM alpine:latest

# NOOIT secrets in de image
# FOUT: ENV DATABASE_PASSWORD=secret123

# Gebruik mount secrets (BuildKit)
RUN --mount=type=secret,id=db_password \
    DB_PASSWORD=$(cat /run/secrets/db_password) && \
    echo "Connecting with password from secret..."

# Of gebruik multi-stage zonder secrets in final image
FROM alpine AS config
RUN --mount=type=secret,id=config \
    cp /run/secrets/config /tmp/config

FROM alpine AS final
COPY --from=config /tmp/config /app/config
```

```bash
# Build met secrets
echo "mysecret" | docker build --secret id=db_password,src=- .
```

## 10. BuildKit Features

### Cache Mounts

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Cache npm downloads
RUN --mount=type=cache,target=/root/.npm \
    npm install -g npm@latest

COPY package*.json ./

# Cache node_modules
RUN --mount=type=cache,target=/app/node_modules \
    --mount=type=cache,target=/root/.npm \
    npm ci

COPY . .
RUN npm run build
```

### Bind Mounts

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Bind mount voor local files tijdens build
RUN --mount=type=bind,source=.,target=. \
    npm run test
```

### SSH Mounts

```dockerfile
FROM alpine:latest

# SSH mount voor private repositories
RUN --mount=type=ssh \
    apk add --no-cache git openssh-client && \
    git clone git@github.com:company/private-repo.git
```

## 11. Praktische Voorbeelden

### Production-ready Node.js Application

```dockerfile
# syntax=docker/dockerfile:1
FROM node:18-alpine AS base

# Installeer dumb-init voor proper signal handling
RUN apk add --no-cache dumb-init

# Maak app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S -u 1001 -G nodejs nodejs

WORKDIR /app
RUN chown nodejs:nodejs /app

# Dependencies stage
FROM base AS dependencies

# Cache npm dependencies
RUN --mount=type=cache,target=/root/.npm \
    npm config set cache /root/.npm

COPY --chown=nodejs:nodejs package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production && \
    npm cache clean --force

# Development dependencies
FROM dependencies AS dev-dependencies
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Build stage
FROM dev-dependencies AS build
COPY --chown=nodejs:nodejs . .
RUN npm run build
RUN npm run test

# Production stage
FROM base AS production

# Copy production dependencies
COPY --from=dependencies --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy built application
COPY --from=build --chown=nodejs:nodejs /app/dist ./dist
COPY --chown=nodejs:nodejs package*.json ./

USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD node dist/healthcheck.js

EXPOSE 3000

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
```

### Multi-architecture Build

```dockerfile
# syntax=docker/dockerfile:1
FROM --platform=$BUILDPLATFORM node:18-alpine AS build

ARG TARGETPLATFORM
ARG BUILDPLATFORM
ARG TARGETOS
ARG TARGETARCH

RUN echo "Building on $BUILDPLATFORM for $TARGETPLATFORM"

WORKDIR /app

# Platform-specific optimizations
RUN --mount=type=cache,target=/root/.npm \
    if [ "$TARGETARCH" = "arm64" ]; then \
        npm config set target_arch arm64; \
    fi

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

COPY . .
RUN npm run build

# Runtime
FROM --platform=$TARGETPLATFORM node:18-alpine

WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package*.json ./

USER 1001
CMD ["node", "dist/server.js"]
```

## Conclusie

Deze geavanceerde Dockerfile instructies geven je veel meer controle over je container builds. Door deze technieken te gebruiken kun je:

- **Flexibelere builds** maken met ARG en ONBUILD
- **Betere monitoring** implementeren met HEALTHCHECK
- **Veiligere containers** bouwen met proper user management
- **Efficiëntere builds** creëren met cache mounts en multi-stage builds
- **Platform-agnostische images** ontwikkelen

Experimenteer met deze technieken in je eigen projecten en zie hoe ze je Docker workflow kunnen verbeteren!

## Nuttige Links

- [Dockerfile Reference](https://docs.docker.com/engine/reference/builder/)
- [BuildKit Features](https://docs.docker.com/build/buildkit/)
- [Multi-platform Builds](https://docs.docker.com/build/building/multi-platform/)
- [Security Best Practices](https://docs.docker.com/develop/security/)