#!/bin/sh

# Generate config.js from Environment Variables
# This allows one Docker Image to serve multiple domains/configs
# MULTI-DOMAIN NOTE: VITE_CLIENT_URL uses __DYNAMIC_ORIGIN__ so AppConfig.ts
# resolves it to window.location.origin at runtime — ensuring each domain
# (clickube.com, apiautomation.in, etc.) gets its OWN correct client URL.
echo "Generating Runtime Config..."

cat <<EOF > /app/public_html/config.js
window.env = {
  VITE_SUPABASE_URL: "${SUPABASE_URL}",
  VITE_SUPABASE_ANON_KEY: "${SUPABASE_KEY}",
  VITE_CLIENT_URL: "__DYNAMIC_ORIGIN__",
  VITE_API_URL: "${API_URL:-/api}",
  VITE_MASTER_URL: "${VITE_MASTER_URL}",
  VITE_BRIDGE_DOMAIN: "${BRIDGE_DOMAIN}"
};
EOF

echo "Config generated at /app/public_html/config.js"

# Start the Node Server
echo "Starting Node Server..."
exec "$@"

