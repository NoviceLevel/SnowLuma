#!/bin/sh
set -eu
cd "$(dirname "$0")"
node_executable="node"
if [ -x "./runtime/bin/node" ]; then
  node_executable="./runtime/bin/node"
fi
exec "$node_executable" --env-file-if-exists=config.env multi.mjs
