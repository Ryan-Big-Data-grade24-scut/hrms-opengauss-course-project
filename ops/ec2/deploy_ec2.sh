#!/usr/bin/env bash

set -euo pipefail

# EC2 deployment script:
# install prerequisites if needed, prepare database, build frontend assets,
# deploy Nginx config, and start the backend.

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
db_container="opengauss-hrms"
db_name="hrms"
db_user="omm"
db_password="OpenGauss123!"
db_port="5432"
frontend_root="$repo_root/frontend"
backend_root="$repo_root/backend"
nginx_conf_src="$repo_root/deploy/nginx/hrms.conf"
nginx_conf_dst="/etc/nginx/conf.d/hrms.conf"
web_root="/var/www/hrms/frontend"
runtime_root="$repo_root/runtime/ec2"
backend_log_dir="$runtime_root/logs"
backend_run_dir="$runtime_root/run"
backend_log_file="$backend_log_dir/backend.log"
backend_pid_file="$backend_run_dir/backend.pid"
migrations_dir="$repo_root/sql/migrations"

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

ensure_base_dependencies() {
  local missing_packages=()

  if ! command -v docker >/dev/null 2>&1; then
    missing_packages+=(docker.io)
  fi
  if ! command -v nginx >/dev/null 2>&1; then
    missing_packages+=(nginx)
  fi
  if ! command -v node >/dev/null 2>&1; then
    missing_packages+=(nodejs)
  fi
  if ! command -v npm >/dev/null 2>&1; then
    missing_packages+=(npm)
  fi
  if ! command -v python3 >/dev/null 2>&1; then
    missing_packages+=(python3)
  fi
  if ! command -v openssl >/dev/null 2>&1; then
    missing_packages+=(openssl)
  fi

  if [[ ${#missing_packages[@]} -gt 0 ]]; then
    echo "Step 1/6: install missing packages: ${missing_packages[*]}"
    run_as_root env DEBIAN_FRONTEND=noninteractive apt-get update
    run_as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y "${missing_packages[@]}"
  else
    echo "Step 1/6: base packages already available"
  fi

  run_as_root systemctl enable --now docker
  run_as_root systemctl enable --now nginx
}

ensure_opengauss_container() {
  local existing_state

  echo "Step 2/6: ensure openGauss container is running"
  existing_state=$(docker_cmd inspect -f '{{.State.Running}}' "$db_container" 2>/dev/null || true)
  if [[ -z "$existing_state" ]]; then
    docker_cmd run --name "$db_container" \
      --privileged=true \
      -d \
      -e GS_PASSWORD="$db_password" \
      -e GS_NODENAME=gaussdb \
      -p "${db_port}:5432" \
      -v opengauss-hrms-data:/var/lib/opengauss \
      opengauss/opengauss:latest >/dev/null
  elif [[ "$existing_state" != "true" ]]; then
    docker_cmd start "$db_container" >/dev/null
  fi
}

ensure_base_dependencies

require_command docker
require_command node
require_command npm
require_command python3
require_command nginx
require_command openssl

if ! docker_cmd info >/dev/null 2>&1; then
  echo "Docker Engine is unavailable. Start Docker before starting the web environment." >&2
  exit 1
fi

ssl_cert_file="/etc/ssl/certs/hrms-selfsigned.crt"
ssl_key_file="/etc/ssl/private/hrms-selfsigned.key"

wait_for_opengauss() {
  local max_attempts=30
  local attempt=1
  local probe

  echo "Step 3/6: wait for openGauss to become ready"
  while [[ $attempt -le $max_attempts ]]; do
    if probe=$(docker_cmd exec "$db_container" /bin/bash -lc "export LD_LIBRARY_PATH=/usr/local/opengauss/lib && /usr/local/opengauss/bin/gsql -h 127.0.0.1 -p $db_port -d postgres -U $db_user -W '$db_password' -t -A -c 'SELECT 1;'" 2>/dev/null); then
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

  echo "Step 5/6: prepare HTTPS certificate"
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

  echo "Step 3/6: prepare database '$db_name' and apply migrations"
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

ensure_opengauss_container
wait_for_opengauss
create_database_if_needed

echo "Step 4/6: build frontend"
cd "$frontend_root"
npm ci
npm run build

ensure_https_certificate

echo "Step 5/6: publish frontend dist and deploy nginx config"
run_as_root mkdir -p "$web_root"
run_as_root rm -rf "$web_root/dist"
run_as_root cp -r "$frontend_root/dist" "$web_root/"
run_as_root cp "$nginx_conf_src" "$nginx_conf_dst"
run_as_root rm -f /etc/nginx/sites-enabled/default
run_as_root nginx -t
if systemctl is-active --quiet nginx; then
  run_as_root systemctl reload nginx
else
  run_as_root systemctl enable --now nginx
fi

echo "Step 6/6: start backend"
mkdir -p "$backend_log_dir" "$backend_run_dir"

if [[ -f "$backend_pid_file" ]] && kill -0 "$(cat "$backend_pid_file")" >/dev/null 2>&1; then
  echo "Backend is already running: $(cat "$backend_pid_file")"
else
  nohup env \
    HRMS_BACKEND_HOST=127.0.0.1 \
    HRMS_BACKEND_PORT=18080 \
    HRMS_DB_CONTAINER="$db_container" \
    HRMS_DB_NAME="$db_name" \
    HRMS_DB_USER="$db_user" \
    HRMS_DB_PASSWORD="$db_password" \
    HRMS_DB_HOST=127.0.0.1 \
    HRMS_DB_PORT="$db_port" \
    python3 "$backend_root/app.py" \
    > "$backend_log_file" 2>&1 &
  echo $! > "$backend_pid_file"
  echo "Backend started with pid $(cat "$backend_pid_file")"
fi

echo ""
echo "Deployment complete."
echo "Frontend: Nginx on https://<ec2-public-ip>/"
echo "HTTP:     redirects to HTTPS on port 80"
echo "Backend:  http://127.0.0.1:18080"
echo "Logs:     $backend_log_file"