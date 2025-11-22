#!/bin/bash
# Production startup script for the application
export NODE_ENV=production
deno run --allow-all main.ts