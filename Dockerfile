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
    apt-get install -y tzdata curl ffmpeg && \
    ln -fs /usr/share/zoneinfo/Asia/Kolkata /etc/localtime && \
    echo "Asia/Kolkata" > /etc/timezone && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. Copy Server package files and install production dependencies
COPY server/package*.json ./
# We install build tools, run npm install, then instantly purge build tools to save 500MB+
RUN apt-get update && apt-get install -y python3 make g++ \
    && npm install --omit=dev \
    && apt-get purge -y python3 make g++ \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

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
# NOTE: Memory limits are now managed safely by docker-compose.yml NODE_OPTIONS
CMD ["node", "server.js"]
