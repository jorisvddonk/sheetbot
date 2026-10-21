#!/bin/bash
# Production startup script for the application
export NODE_ENV=production
node --experimental-sqlite --experimental-strip-types main.ts --port 3042