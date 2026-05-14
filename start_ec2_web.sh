#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$script_dir"
db_container="opengauss-hrms"
db_password="OpenGauss123!"
frontend_dist="$repo_root/frontend/dist"
web_root="/var/www/hrms/frontend"
backend_root="$repo_root/backend"
nginx_conf_src="$repo_root/deploy/nginx/hrms.conf"
nginx_conf_dst="/etc/nginx/conf.d/hrms.conf"
ssl_cert_file="/etc/ssl/certs/hrms-selfsigned.crt"
ssl_key_file="/etc/ssl/private/hrms-selfsigned.key"
db_name="hrms"
db_user="omm"
db_port="5432"
migrations_dir="$repo_root/sql/migrations"
runtime_root="$repo_root/runtime/ec2"
backend_log_dir="$runtime_root/logs"
backend_run_dir="$runtime_root/run"
backend_log_file="$backend_log_dir/backend.log"
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

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
}

wait_for_opengauss() {
  local max_attempts=30
  local attempt=1
  local probe

  echo "Wait for openGauss to become ready"
  while [[ $attempt -le $max_attempts ]]; do
    if probe=$(docker_cmd exec "$db_container" /bin/bash -lc "export LD_LIBRARY_PATH=/usr/local/opengauss/lib && /usr/local/opengauss/bin/gsql -h 127.0.0.1 -p 5432 -d postgres -U omm -W '$db_password' -t -A -c 'SELECT 1;'" 2>/dev/null); then
      if [[ "$probe" == "1" ]]; then
        return 0
      fi
    fi

    echo "Waiting for openGauss... ($attempt/$max_attempts)"
    sleep 2
    attempt=$((attempt + 1))
  done

  echo "openGauss inside container '$db_container' is not ready yet." >&2
  exit 1
}

ensure_https_certificate() {
  local temp_dir
  local temp_cert
  local temp_key

  if [[ -f "$ssl_cert_file" && -f "$ssl_key_file" ]]; then
    return 0
  fi

  temp_dir="$(mktemp -d)"
  temp_cert="$temp_dir/hrms-selfsigned.crt"
  temp_key="$temp_dir/hrms-selfsigned.key"

  openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
    -keyout "$temp_key" \
    -out "$temp_cert" \
    -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

  run_as_root install -d -m 755 /etc/ssl/certs
  run_as_root install -d -m 700 /etc/ssl/private
  run_as_root install -m 644 "$temp_cert" "$ssl_cert_file"
  run_as_root install -m 600 "$temp_key" "$ssl_key_file"
  rm -rf "$temp_dir"
}

create_database_if_needed() {
  local exists

  echo "Prepare database '$db_name' and apply migrations"
  exists=$(docker_cmd exec "$db_container" /bin/bash -lc "export LD_LIBRARY_PATH=/usr/local/opengauss/lib && /usr/local/opengauss/bin/gsql -h 127.0.0.1 -p $db_port -d postgres -U $db_user -W '$db_password' -t -A -c \"SELECT 1 FROM pg_database WHERE datname='${db_name}';\"" 2>/dev/null || true)
  if [[ "$exists" != "1" ]]; then
    docker_cmd exec "$db_container" /bin/bash -lc "export LD_LIBRARY_PATH=/usr/local/opengauss/lib && /usr/local/opengauss/bin/gsql -h 127.0.0.1 -p $db_port -d postgres -U $db_user -W '$db_password' -c \"CREATE DATABASE ${db_name};\""
  fi

  docker_cmd exec "$db_container" /bin/bash -lc "export LD_LIBRARY_PATH=/usr/local/opengauss/lib && /usr/local/opengauss/bin/gsql -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $db_port -d $db_name -U $db_user -W '$db_password' -c \"CREATE TABLE IF NOT EXISTS schema_migration_history (version VARCHAR(50) PRIMARY KEY, filename VARCHAR(255) NOT NULL, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);\""

  shopt -s nullglob
  local migration_files=("$migrations_dir"/V*__*.sql)
  shopt -u nullglob

  if [[ ${#migration_files[@]} -eq 0 ]]; then
    echo "No migration files found in $migrations_dir"
    return 0
  fi

  local file
  local version
  local container_path
  local applied
  for file in "${migration_files[@]}"; do
    version="${file##*/}"
    version="${version%%__*}"
    applied=$(docker_cmd exec "$db_container" /bin/bash -lc "export LD_LIBRARY_PATH=/usr/local/opengauss/lib && /usr/local/opengauss/bin/gsql -t -A -h 127.0.0.1 -p $db_port -d $db_name -U $db_user -W '$db_password' -c \"SELECT 1 FROM schema_migration_history WHERE version='${version}';\"" 2>/dev/null || true)
    if [[ "$applied" == "1" ]]; then
      echo "Skipping ${file##*/} (already applied)"
      continue
    fi

    container_path="/tmp/${file##*/}"
    echo "Applying ${file##*/}"
    docker_cmd cp "$file" "${db_container}:${container_path}"
    docker_cmd exec "$db_container" /bin/bash -lc "export LD_LIBRARY_PATH=/usr/local/opengauss/lib && /usr/local/opengauss/bin/gsql -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $db_port -d $db_name -U $db_user -W '$db_password' -f $container_path"
    docker_cmd exec "$db_container" /bin/bash -lc "export LD_LIBRARY_PATH=/usr/local/opengauss/lib && /usr/local/opengauss/bin/gsql -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $db_port -d $db_name -U $db_user -W '$db_password' -c \"INSERT INTO schema_migration_history (version, filename) VALUES ('${version}', '${file##*/}');\""
  done
}

ensure_opengauss_container_running() {
  local existing_state

  existing_state=$(docker_cmd inspect -f '{{.State.Running}}' "$db_container" 2>/dev/null || true)
  if [[ -z "$existing_state" ]]; then
    echo "Starting openGauss container '$db_container'..."
    docker_cmd run --name "$db_container" \
      --privileged=true \
      -d \
      -e GS_PASSWORD="$db_password" \
      -e GS_NODENAME=gaussdb \
      -p 5432:5432 \
      -v opengauss-hrms-data:/var/lib/opengauss \
      opengauss/opengauss:latest >/dev/null
  elif [[ "$existing_state" != "true" ]]; then
    echo "Starting existing openGauss container '$db_container'..."
    docker_cmd start "$db_container" >/dev/null
  fi
}

ensure_backend_running() {
  mkdir -p "$backend_log_dir" "$backend_run_dir"

  if [[ -f "$backend_pid_file" ]] && kill -0 "$(cat "$backend_pid_file")" >/dev/null 2>&1; then
    echo "Backend is already running: $(cat "$backend_pid_file")"
    return 0
  fi

  if pgrep -f "python3 $backend_root/app.py" >/dev/null 2>&1; then
    echo "Backend process is already running"
    return 0
  fi

  nohup env \
    HRMS_BACKEND_HOST=127.0.0.1 \
    HRMS_BACKEND_PORT=18080 \
    HRMS_DB_CONTAINER="$db_container" \
    HRMS_DB_NAME=hrms \
    HRMS_DB_USER=omm \
    HRMS_DB_PASSWORD="$db_password" \
    HRMS_DB_HOST=127.0.0.1 \
    HRMS_DB_PORT=5432 \
    python3 "$backend_root/app.py" \
    > "$backend_log_file" 2>&1 &
  echo $! > "$backend_pid_file"
  echo "Backend started with pid $(cat "$backend_pid_file")"
}

require_command docker
require_command python3
require_command nginx
require_command openssl

if [[ ! -d "$frontend_dist" ]]; then
  echo "Frontend build not found at $frontend_dist. Run deploy_ec2.sh once first." >&2
  exit 1
fi

run_as_root mkdir -p "$web_root"
run_as_root rm -rf "$web_root/dist"
run_as_root cp -r "$frontend_dist" "$web_root/"

run_as_root systemctl enable --now docker
run_as_root systemctl enable --now nginx

if ! docker_cmd info >/dev/null 2>&1; then
  echo "Docker Engine is unavailable. Start Docker before launching the web stack." >&2
  exit 1
fi

ensure_opengauss_container_running
wait_for_opengauss
create_database_if_needed
ensure_https_certificate
run_as_root rm -f /etc/nginx/sites-enabled/default
run_as_root cp "$nginx_conf_src" "$nginx_conf_dst"
run_as_root nginx -t
if systemctl is-active --quiet nginx; then
  run_as_root systemctl reload nginx
else
  run_as_root systemctl enable --now nginx
fi
ensure_backend_running

echo ""
echo "Web stack is up."
echo "Frontend: https://<ec2-public-ip>/"
echo "HTTP:     redirects to HTTPS on port 80"
echo "Backend:  http://127.0.0.1:18080"
echo "Logs:     $backend_log_file"