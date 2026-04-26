# ==========================================
# 🏗️ Stage 1: Build the Frontend
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install --legacy-peer-deps --quiet
COPY client/ ./
RUN npm run build

# ==========================================
# 🚀 Stage 2: Production Image (High Performance)
# ==========================================
FROM node:20-slim

# Set Timezone and Install ffmpeg (for video transcoding)
ENV TZ="Asia/Kolkata"
RUN apt-get update && \
    apt-get install -y tzdata curl ffmpeg python3 make g++ && \
    ln -fs /usr/share/zoneinfo/Asia/Kolkata /etc/localtime && \
    echo "Asia/Kolkata" > /etc/timezone && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. Copy Server package files and install production dependencies
COPY server/package*.json ./
# We install with --omit=dev to keep the image small
# We use --build-from-source for sharp to ensure linux-x64 compatibility
RUN npm install --omit=dev

# 2. Copy Server source code
COPY server/ ./

# 3. Copy the Built Client from Stage 1
COPY --from=frontend-builder /app/client/dist ./public_html

# 4. Create necessary mutable directories
RUN mkdir -p logs uploads

# 5. Copy Entrypoint Script
COPY entrypoint.sh ./entrypoint.sh
RUN sed -i 's/\r$//' ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# 6. Set Environment Variables
ENV NODE_ENV=production
ENV PORT=5000
ENV CLIENT_BUILD_PATH=/app/public_html

# EXPOSE PORT
EXPOSE 5000

# Use Entrypoint to inject config before starting
ENTRYPOINT ["./entrypoint.sh"]

# RUN THE SERVER
# We use --max-old-space-size to allow Node to use more of your 32GB RAM
# We use node_dns_order to fix Meta CDN IPv6 issues
CMD ["node", "--max-old-space-size=3072", "server.js"]
