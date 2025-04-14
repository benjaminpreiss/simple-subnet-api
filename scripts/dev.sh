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

# Ensure NODE_CMD is provided
if [ -z "$1" ]; then
    echo "Error: No NODE_CMD provided."
    echo "Usage: $0 <NODE_CMD>"
    exit 1
fi

docker-compose down --volumes

# Define commands in variables
DOCKER_CMD="docker compose up -d --detach --wait"

# Execute DOCKER_CMD first
echo "Executing Docker Compose Up with --wait..."
${DOCKER_CMD}
if [ $? -ne 0 ]; then
    echo "Docker Compose failed to start. Exiting."
    exit 1
fi

# Define commands for parallel execution
NODE_CMD="$1"
DOCKER_ATTACH_CMD="docker compose up"

# Function to apply color
yellow='\033[1;33m'
green='\033[1;32m'
nc='\033[0m' # No Color

# Using the --tagstring and --rpl for custom colors
parallel --halt now,fail=1,sig=1 --line-buffer --tagstring "{=1 s/${DOCKER_ATTACH_CMD//\//\\/}/${yellow}Docker${nc}/;s/${NODE_CMD//\//\\/}/${green}Node${nc}/ =}" ::: \
    "${DOCKER_ATTACH_CMD}" "${NODE_CMD}"

echo "Script execution completed."
