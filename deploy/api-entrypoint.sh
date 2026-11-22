#!/bin/sh
# A mounted volume arrives owned by root (always on Fly.io, sometimes under Docker), and the API runs as the
# unprivileged "node" user. So: start as root just long enough to hand /data to "node", then drop to it for good.
set -e
if [ "$(id -u)" = "0" ]; then
  chown node:node /data
  exec su-exec node "$@"
fi
exec "$@"
