#!/bin/sh
# Restart the production server on port 3100 without matching this script.
PORT=${1:-3100}
PID=$(cat /tmp/slippery-server.pid 2>/dev/null)
if [ -n "$PID" ]; then kill "$PID" >/dev/null 2>&1; fi
sleep 1
cd /home/user/Slippery || exit 1
nohup npx next start -p "$PORT" > /tmp/next.log 2>&1 &
echo $! > /tmp/slippery-server.pid
sleep 5
exit 0
