#!/bin/bash

# <name>system-info-report</name>

# <capabilitiesSchema>
# {
#   "$schema": "http://json-schema.org/draft-07/schema#",
#   "type": "object",
#   "properties": {
#     "os": {
#       "type": "string"
#     },
#     "arch": {
#       "type": "string"
#     }
#   }
# }
# </capabilitiesSchema>

# <data>
# {
#   "sheet": "system-info"
# }
# </data>

set -euo pipefail

# Function to get data from task
getData() {
    curl -s -H "Authorization: ${SHEETBOT_AUTHORIZATION_HEADER:-}" "$SHEETBOT_TASK_BASEURL" | jq -r '.data'
}

# Function to submit data
submitData() {
    local data="$1"
    curl -s -X POST -H "Authorization: ${SHEETBOT_AUTHORIZATION_HEADER:-}" -H "Content-Type: application/json" -d "$data" "$SHEETBOT_TASK_DATAURL" > /dev/null
}

# Function to add data to sheet
addSheetData() {
    local sheet="$1"
    local data="$2"
    curl -s -X POST -H "Authorization: ${SHEETBOT_AUTHORIZATION_HEADER:-}" -H "Content-Type: application/json" -d "$data" "$SHEETBOT_BASEURL/sheets/$sheet/data" > /dev/null
}

# Get task data
taskData=$(getData)
sheet=$(echo "$taskData" | jq -r '.sheet // "system-info"')

# Collect system info
timestamp=$(date +%Y-%m-%dT%H:%M:%S 2>/dev/null || echo "1970-01-01T00:00:00")

# Load averages
if [ -f /proc/loadavg ]; then
    loadavg_1=$(awk '{print $1}' /proc/loadavg)
    loadavg_5=$(awk '{print $2}' /proc/loadavg)
    loadavg_15=$(awk '{print $3}' /proc/loadavg)
else
    # Fallback to uptime
    uptime_output=$(uptime)
    loadavg_1=$(echo "$uptime_output" | awk -F'load average:' '{print $2}' | awk -F',' '{print $1}' | tr -d ' ')
    loadavg_5=$(echo "$uptime_output" | awk -F'load average:' '{print $2}' | awk -F',' '{print $2}' | tr -d ' ')
    loadavg_15=$(echo "$uptime_output" | awk -F'load average:' '{print $2}' | awk -F',' '{print $3}' | tr -d ' ')
fi

# Free disk space (root filesystem)
disk_free=$(df / | tail -1 | awk '{print $4}')
disk_free_gb=$((disk_free / 1024 / 1024))  # Convert to GB

# Memory info
if [ -f /proc/meminfo ]; then
    mem_total=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    mem_free=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
    mem_total_gb=$((mem_total / 1024 / 1024))
    mem_free_gb=$((mem_free / 1024 / 1024))
else
    mem_total_gb="unknown"
    mem_free_gb="unknown"
fi

# Prepare result
result=$(jq -n \
    --arg timestamp "$timestamp" \
    --arg loadavg_1 "$loadavg_1" \
    --arg loadavg_5 "$loadavg_5" \
    --arg loadavg_15 "$loadavg_15" \
    --arg disk_free_gb "$disk_free_gb" \
    --arg mem_total_gb "$mem_total_gb" \
    --arg mem_free_gb "$mem_free_gb" \
    '{
        timestamp: $timestamp,
        loadavg: {
            "1min": ($loadavg_1 | tonumber),
            "5min": ($loadavg_5 | tonumber),
            "15min": ($loadavg_15 | tonumber)
        },
        disk_free_gb: ($disk_free_gb | tonumber),
        memory: {
            total_gb: (if $mem_total_gb == "unknown" then null else ($mem_total_gb | tonumber) end),
            free_gb: (if $mem_free_gb == "unknown" then null else ($mem_free_gb | tonumber) end)
        }
    }')

# Add to sheet
sheet_key="$timestamp"
sheet_data=$(jq -n --arg key "$sheet_key" --argjson result "$result" '{"key": $key} + $result')
echo "Sheet: $sheet" >&2
echo "Sheet key: $sheet_key" >&2
echo "Sheet data: $sheet_data" >&2

# Output data for agent completion
echo "Result: $result" >&2
printf '%s' "$result"

addSheetData "$sheet" "$sheet_data"