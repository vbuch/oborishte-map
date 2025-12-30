# Multi-stage build for minimal image size
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Install Playwright browsers (needed for crawlers)
RUN npx playwright install --with-deps chromium

# Copy source code
COPY . .

# Build if needed (tsx runs TypeScript directly, so optional)
# RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Install system dependencies for Playwright/Chromium
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libatspi2.0-0 \
    libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

# Install only production dependencies
COPY package*.json ./
RUN npm ci --production

# Install Playwright (needed at runtime for crawlers)
RUN npm install playwright

# Copy Playwright browsers from builder stage
COPY --from=builder /root/.cache/ms-playwright /root/.cache/ms-playwright

# Copy built application and source (tsx needs source)
COPY --from=builder /app .

# Install tsx globally for running TypeScript
RUN npm install -g tsx

# Set environment to production
ENV NODE_ENV=production

# Default command (will be overridden by Cloud Run Job)
CMD ["tsx", "crawl.ts", "--help"]
