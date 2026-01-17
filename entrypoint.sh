#!/bin/sh

# Generate config.js from Environment Variables
# This allows one Docker Image to serve multiple domains/configs
echo "Generating Runtime Config..."

cat <<EOF > /app/public_html/config.js
window.env = {
  VITE_SUPABASE_URL: "${SUPABASE_URL}",
  VITE_SUPABASE_ANON_KEY: "${SUPABASE_KEY}",
  VITE_CLIENT_URL: "${CLIENT_URL}",
  VITE_API_URL: "${API_URL:-/api}",
  VITE_MASTER_URL: "${VITE_MASTER_URL}",
  VITE_BRIDGE_DOMAIN: "${BRIDGE_DOMAIN}"
};
EOF

echo "Config generated at /app/public_html/config.js"

# Start the Node Server
echo "Starting Node Server..."
exec "$@"
