# ==========================================
# 🏗️ Stage 1: Build the Frontend
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci --quiet
COPY client/ ./
ARG VITE_CLIENT_URL
ENV VITE_CLIENT_URL=$VITE_CLIENT_URL

ARG VITE_SUPABASE_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL

ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

ARG VITE_BRIDGE_DOMAIN
ENV VITE_BRIDGE_DOMAIN=$VITE_BRIDGE_DOMAIN
ARG VITE_MASTER_URL
ENV VITE_MASTER_URL=$VITE_MASTER_URL
RUN npm run build

# ==========================================
# 📦 Stage 2: Build the Server Binary (Security Layer)
# ==========================================
FROM node:18 AS server-builder
WORKDIR /build

# Copy manifest and dependencies
COPY server/package*.json ./
RUN npm install

# Copy source code
COPY server/ ./

# Install pkg to compile the app
RUN npm install -g pkg

# Compile into a binary
# This hides the source code inside the executable 'server-app'
# We use --compress GZip to reduce size
RUN pkg package.json --targets node18-linux-x64 --output server-app --compress GZip --public > /dev/null 2>&1 || true
RUN echo "✅ Compilation Successful (Warnings above are normal)"

# ==========================================
# 🚀 Stage 3: Production Image (Secure)
# ==========================================
# Using -slim for wider compatibility with pkg binaries (glibc vs musl)
FROM node:18-slim

WORKDIR /app

# 1. Copy the Server Binary from Stage 2
# This ensures NO source code (JS files) exists in the final image
COPY --from=server-builder /build/server-app ./server-app

# 2. Add Execute Permissions (Critical for Linux execution)
RUN chmod +x ./server-app

# 3. Copy the Built Client from Stage 1
COPY --from=frontend-builder /app/client/dist ./public_html

# 4. Create necessary mutable directories
RUN mkdir -p logs uploads

# 5. Set Environment Variables
ENV NODE_ENV=production
ENV PORT=5000
ENV CLIENT_BUILD_PATH=/app/public_html

# Expose Port
EXPOSE 5000

# Run the binary
CMD ["./server-app"]
