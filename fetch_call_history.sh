#!/bin/bash

# ==========================================
# Callyzer API Configuration
# ==========================================
API_TOKEN="17fa10ca-562e-4a96-b7d4-d67df8fb66eb"
# Use the LIVE API endpoint to fetch actual data from your dashboard
API_URL="https://api1.callyzer.co/api/v2.2/call-log/history"

# The specific client number you want the history for
TARGET_NUMBER="8668343489"

# Use dynamic dates (last 30 days) to include your July 19th calls!
CALL_FROM=$(date -d "30 days ago" +%s)
CALL_TO=$(date +%s)

echo "Fetching call history from $CALL_FROM to $CALL_TO..."

# ==========================================
# Make the API Request
# ==========================================
# We request all call types and provide the mandatory v2.2 parameters (call_method, call_mode)
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "call_from": '"$CALL_FROM"',
    "call_to": '"$CALL_TO"',
    "call_types": ["Incoming", "Outgoing", "Missed", "Rejected"],
    "call_method": "PhoneCall",
    "call_mode": "Voice",
    "client_numbers": ["'"$TARGET_NUMBER"'"] 
  }')

# Extract HTTP status and Body
HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

# ==========================================
# Handle the Response
# ==========================================
if [ "$HTTP_STATUS" -eq 200 ]; then
    echo "API call successful. Filtering results for number: $TARGET_NUMBER"
    
    # Print total records received to confirm the API actually returned data
    TOTAL_RECORDS=$(echo "$BODY" | jq '.result | length')
    echo "Total records returned by API: $TOTAL_RECORDS"

    echo "--- RAW API RESPONSE ---"
    echo "$BODY" | jq .
    echo "------------------------"

    # Use jq to filter the resulting call logs to match ONLY the TARGET_NUMBER.
    # We use 'endswith' to ensure it matches even if there is a country code prefix like '91'
    echo "$BODY" | jq --arg num "$TARGET_NUMBER" '
        [ .result[]? | select(.client_number | endswith($num)) | {
            id: .id,
            employee: .emp_name,
            client_name: .client_name,
            client_number: .client_number,
            call_type: .call_type,
            duration_seconds: .duration,
            call_date: .call_date,
            call_time: .call_time,
            call_method: .call_method,
            call_recording_url: .call_recording_url
        } ]
    '
    
elif [ "$HTTP_STATUS" -eq 429 ]; then
    echo "Error 429: Too Many Requests. Callyzer limits requests to 1 per 2 seconds. Please wait and try again."
elif [ "$HTTP_STATUS" -eq 401 ]; then
    echo "Error 401: Unauthorized. Please check your API_TOKEN."
else
    echo "Failed with status $HTTP_STATUS"
    echo "$BODY" | jq .
fi
