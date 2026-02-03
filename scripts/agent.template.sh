#!/bin/bash

# Sheetbot Bash Agent Template
# This script implements the agent runtime for bash-based task execution

set -euo pipefail

# Check for required dependencies
if ! command -v curl >/dev/null 2>&1; then
    echo "Error: curl is required but not found" >&2
    exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
    echo "Error: jq is required but not found" >&2
    exit 1
fi

# Set base URL from environment or template placeholders
if [ -z "${SHEETBOT_BASEURL:-}" ]; then
    SHEETBOT_BASEURL="${req.protocol}://${req.get('host')}"
fi
export SHEETBOT_BASEURL

# Function to check for HTTP errors
check_for_errors() {
    local status="$1"
    if [ "$status" -eq 401 ]; then
        echo "Unauthenticated" >&2
        exit 1
    elif [ "$status" -eq 403 ]; then
        echo "Unauthorized" >&2
        exit 1
    elif [ "$status" -eq 500 ]; then
        echo "Internal server error" >&2
        exit 1
    elif [ "$status" -ne 200 ]; then
        echo "Some error occurred: $status" >&2
        exit 1
    fi
}

# Authentication
headers=()
if [ -n "${SHEETBOT_AUTH_APIKEY:-}" ]; then
    echo "Attempting authentication with API key" >&2
    auth_output=$(curl -s -w "%{http_code}" -X POST "$SHEETBOT_BASEURL/login" \
        -H "Content-Type: application/json" \
        -d "{\"apiKey\":\"$SHEETBOT_AUTH_APIKEY\"}")
    auth_status="${auth_output: -3}"
    auth_body="${auth_output%???}"
    echo "Auth status: $auth_status" >&2
    check_for_errors "$auth_status"
    token=$(echo "$auth_body" | jq -r '.token')
    echo "Token obtained: ${token:0:10}..." >&2
    headers+=(-H "Authorization: Bearer $token")
elif [ -n "${SHEETBOT_AUTH_USER:-}" ] && [ -n "${SHEETBOT_AUTH_PASS:-}" ]; then
    echo "Attempting authentication with user: $SHEETBOT_AUTH_USER" >&2
    auth_output=$(curl -s -w "%{http_code}" -X POST "$SHEETBOT_BASEURL/login" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$SHEETBOT_AUTH_USER\",\"password\":\"$SHEETBOT_AUTH_PASS\"}")
    auth_status="${auth_output: -3}"
    auth_body="${auth_output%???}"
    echo "Auth status: $auth_status" >&2
    check_for_errors "$auth_status"
    token=$(echo "$auth_body" | jq -r '.token')
    echo "Token obtained: ${token:0:10}..." >&2
    headers+=(-H "Authorization: Bearer $token")
else
    echo "No authentication credentials provided" >&2
fi

# Clean up all auth environment variables
unset SHEETBOT_AUTH_USER SHEETBOT_AUTH_PASS SHEETBOT_AUTH_APIKEY

# Load capabilities
local_capabilities="{}"
if [ -f "./.capabilities.json" ]; then
    local_capabilities=$(jq -s '.[0] * .[1]' <(echo "$local_capabilities") ./.capabilities.json)
fi

if [ -f "./.capabilities.dynamic.sh" ]; then
    # Source the dynamic capabilities script
    source "./.capabilities.dynamic.sh"
    if command -v getCapabilities >/dev/null 2>&1; then
        dynamic_caps=$(getCapabilities "$local_capabilities")
        local_capabilities=$(jq -s '.[0] * .[1]' <(echo "$local_capabilities") <(echo "$dynamic_caps"))
    fi
fi

if [ -f "./.capabilities.override.json" ]; then
    local_capabilities=$(jq -s '.[0] * .[1]' <(echo "$local_capabilities") ./.capabilities.override.json)
fi

echo "capabilities: $local_capabilities" >&2

# Get system capabilities
os=$(uname -s | tr '[:upper:]' '[:lower:]')
arch=$(uname -m)
hostname=$(hostname)

capabilities=$(jq -n \
    --arg os "$os" \
    --arg arch "$arch" \
    --arg hostname "$hostname" \
    --argjson local "$local_capabilities" \
    '{os: $os, arch: $arch, hostname: $hostname} + $local')

echo "Final capabilities: $capabilities" >&2

# Poll for tasks
echo "Polling for tasks at: $SHEETBOT_BASEURL/tasks/get" >&2
task_output=$(curl -s -w "%{http_code}" "${headers[@]}" -X POST "$SHEETBOT_BASEURL/tasks/get" \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"bash\",\"capabilities\":$capabilities}")
task_status="${task_output: -3}"
task_body="${task_output%???}"
echo "Task status: $task_status" >&2
check_for_errors "$task_status"

# Check if task available
if echo "$task_body" | jq -e '.script' >/dev/null 2>&1; then
    task_id=$(echo "$task_body" | jq -r '.id')
    export SHEETBOT_TASK_ID="$task_id"
    export SHEETBOT_AUTHORIZATION_HEADER="Bearer $token"
    export SHEETBOT_TASK_BASEURL="$SHEETBOT_BASEURL/tasks/$task_id"
    export SHEETBOT_TASK_ACCEPTURL="$SHEETBOT_BASEURL/tasks/$task_id/accept"
    export SHEETBOT_TASK_COMPLETEURL="$SHEETBOT_BASEURL/tasks/$task_id/complete"
    export SHEETBOT_TASK_FAILEDURL="$SHEETBOT_BASEURL/tasks/$task_id/failed"
    export SHEETBOT_TASK_DATAURL="$SHEETBOT_BASEURL/tasks/$task_id/data"
    export SHEETBOT_TASK_ARTEFACTURL="$SHEETBOT_BASEURL/tasks/$task_id/artefacts"

    # Accept task
    accept_response=$(curl -s -w "%{http_code}" "${headers[@]}" -X POST "$SHEETBOT_TASK_ACCEPTURL" \
        -H "Content-Type: application/json" \
        -d "{}")
    accept_status="${accept_response: -3}"
    check_for_errors "$accept_status"

    # Fetch and execute script
    script_url=$(echo "$task_body" | jq -r '.script')
    script_content=$(curl -s "$script_url")

    # Execute script
    if echo "$script_content" | head -1 | grep -q "^#!/"; then
        # Script with shebang, execute directly
        temp_script=$(mktemp)
        echo "$script_content" > "$temp_script"
        chmod +x "$temp_script"
        if data=$("$temp_script"); then
            # data contains the script's stdout output
            echo "Captured data: '$data'" >&2
            curl -s "${headers[@]}" -X POST "$SHEETBOT_TASK_COMPLETEURL" \
                -H "Content-Type: application/json" \
                -d "{\"data\":$data}"
        else
            curl -s "${headers[@]}" -X POST "$SHEETBOT_TASK_FAILEDURL" \
                -H "Content-Type: application/json" \
                -d "{}"
        fi
        rm "$temp_script"
    else
        # Inline script, source it
        if echo "$script_content" | bash; then
            # Assume data is set in environment or output
            data="${data:-{}}"
            curl -s "${headers[@]}" -X POST "$SHEETBOT_TASK_COMPLETEURL" \
                -H "Content-Type: application/json" \
                -d "{\"data\":$data}"
        else
            curl -s "${headers[@]}" -X POST "$SHEETBOT_TASK_FAILEDURL" \
                -H "Content-Type: application/json" \
                -d "{}"
        fi
    fi
fi