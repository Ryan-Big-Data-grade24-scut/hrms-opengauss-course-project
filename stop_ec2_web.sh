#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$script_dir"
db_container="opengauss-hrms"
backend_root="$repo_root/backend"
runtime_root="$repo_root/runtime/ec2"
backend_run_dir="$runtime_root/run"
backend_pid_file="$backend_run_dir/backend.pid"

run_as_root() {
  if [[ ${EUID:-$(id -u)} -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

docker_cmd() {
  if docker info >/dev/null 2>&1; then
    docker "$@"
  else
    sudo docker "$@"
  fi
}

stop_backend() {
  local backend_pid

  echo "Stopping backend..."
  if [[ -f "$backend_pid_file" ]]; then
    backend_pid="$(cat "$backend_pid_file")"
    if [[ -n "$backend_pid" ]] && kill -0 "$backend_pid" >/dev/null 2>&1; then
      run_as_root kill "$backend_pid" || true
      for _ in {1..10}; do
        if ! kill -0 "$backend_pid" >/dev/null 2>&1; then
          break
        fi
        sleep 1
      done
      if kill -0 "$backend_pid" >/dev/null 2>&1; then
        run_as_root kill -9 "$backend_pid" || true
      fi
      echo "Backend stopped: $backend_pid"
    else
      echo "Backend PID file exists but process is not running."
    fi
    rm -f "$backend_pid_file"
  else
    if pgrep -f "python3 $backend_root/app.py" >/dev/null 2>&1; then
      run_as_root pkill -f "python3 $backend_root/app.py" || true
      echo "Backend process stopped by pattern match."
    else
      echo "Backend is not running."
    fi
  fi
}

stop_nginx() {
  echo "Stopping nginx..."
  if systemctl is-active --quiet nginx; then
    run_as_root systemctl stop nginx
    echo "nginx stopped."
  else
    echo "nginx is not running."
  fi
}

stop_opengauss() {
  echo "Stopping openGauss container..."
  if docker_cmd inspect -f '{{.State.Running}}' "$db_container" >/dev/null 2>&1; then
    docker_cmd stop "$db_container" >/dev/null
    echo "openGauss container stopped: $db_container"
  else
    echo "openGauss container is not running."
  fi
}

stop_backend
stop_nginx
stop_opengauss

echo ""
echo "Web stack stopped."
echo "You can now modify scripts safely."