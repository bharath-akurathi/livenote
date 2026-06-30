# ─── 1. BUILD STAGE ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Install build dependencies (often needed for native modules in yjs / bcrypt etc)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy the root package.json and workspace configuration
COPY package.json package-lock.json* ./
# Copy workspace package.jsons (to leverage Docker layer caching)
COPY apps/client/package.json ./apps/client/
COPY apps/server/package.json ./apps/server/

# Install all dependencies across workspaces
RUN npm install

# Copy the rest of the application code
COPY . .

# Build both the client (Vite) and the server (TypeScript)
RUN npm run build

# ─── 2. PRODUCTION STAGE ──────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json* ./

# Copy built server files and its package.json
COPY --from=builder /app/apps/server/package.json ./apps/server/
COPY --from=builder /app/apps/server/dist ./apps/server/dist

# Copy built client files
# The Node.js server is configured to serve static files from ../../client/dist
COPY --from=builder /app/apps/client/dist ./apps/client/dist

# Install ONLY production dependencies to keep the image small
RUN npm install --omit=dev --workspace=@livenote/server

# Expose the single port that Express handles (API + WebSockets + Static)
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production
ENV PORT=3000

# Command to run database migrations and then start the server
CMD ["sh", "-c", "cd apps/server && npm run migrate && node dist/index.js"]
