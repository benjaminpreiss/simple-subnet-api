#!/bin/bash

# Check if GNU Parallel is installed
if ! command -v parallel &> /dev/null; then
    echo "GNU Parallel is not installed. Please install it first."
    echo "You can install it on most systems with:"
    echo "  - Debian/Ubuntu: sudo apt-get install parallel"
    echo "  - CentOS/RHEL: sudo yum install parallel"
    echo "  - macOS: brew install parallel"
    exit 1
fi

# Define commands in variables
DOCKER_CMD="docker compose up"
NODE_CMD="node bin/simple-subnet-api.js"

# Function to apply color
yellow='\033[1;33m'
green='\033[1;32m'
nc='\033[0m' # No Color

# Using the --tagstring and --rpl for custom colors
parallel --halt now,fail=1,sig=1 --line-buffer --tagstring "{=1 s/${DOCKER_CMD//\//\\/}/${yellow}Docker Compose${nc}/;s/${NODE_CMD//\//\\/}/${green}Node API${nc}/ =}" ::: \
    "${DOCKER_CMD}" "${NODE_CMD}"

echo "Script execution completed."
