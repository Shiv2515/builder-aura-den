# PulseSignal AI - Production Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install pnpm and dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Set environment variables for build
ENV NODE_ENV=production
ENV OPENAI_API_KEY=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
ENV SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Build the application
RUN pnpm run build

# Production stage
FROM node:18-alpine AS runner

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.env ./

# Install only production dependencies
RUN npm install -g pnpm
RUN pnpm install --prod --frozen-lockfile

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV OPENAI_API_KEY=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

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/api/ping || exit 1

# Start the application
CMD ["node", "dist/server/node-build.mjs"]
