#!/bin/bash

# 1. Apna System User Token aur Page ID yaha daalo
SYSTEM_TOKEN="EAAialqCpZCtoBSNWHNtaUP8BciDArez27DDkmFc31EIZCJbZCz5iUVcgZCM5Y9ZA9wNJ3zzITsWOJW13rpR1ikdtv7ZAcVYaLZACfeNYfPi1O9ZC7j1su4FQaMydc2L6beLe5LEIIcZBY38GP6iZAYZCZBmQzo6nk5giTZAH7eaYNBvwaJVZCguhAjwDgMvJigmkr3HqX0QQZD"
PAGE_ID="1042529798935395"

echo "Step 1: Page Access Token nikal rahe hain..."
# 2. Page Token nikalo
PAGE_TOKEN=$(curl -s -X GET "https://graph.facebook.com/v19.0/$PAGE_ID?fields=access_token" \
-H "Authorization: Bearer $SYSTEM_TOKEN" | jq -r '.access_token')

if [ "$PAGE_TOKEN" == "null" ] || [ -z "$PAGE_TOKEN" ]; then
  echo "Error: Page Token nahi mila. System User ko Page ka access hai kya?"
  exit 1
fi

echo "Page Token mil gaya ✅"
echo ""
echo "Step 2: Lead Forms fetch kar rahe hain..."
# 3. Page Token se Lead Forms nikalo
curl -X GET "https://graph.facebook.com/v19.0/$PAGE_ID/leadgen_forms" \
-H "Authorization: Bearer $PAGE_TOKEN" \
-d "fields=id,name,created_time,status"