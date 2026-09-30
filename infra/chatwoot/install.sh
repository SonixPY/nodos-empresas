#!/usr/bin/env bash
# Instala NODOS Inbox (Chatwoot CE + asistente) en una VM Ubuntu 22.04/24.04.
# Uso, dentro de la VM:  bash install.sh
set -euo pipefail
cd "$(dirname "$0")"

echo "==> 1/5 Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER" || true
fi

echo "==> 2/5 Firewall de la VM (las imágenes Ubuntu de Oracle bloquean 80/443 por defecto)"
if command -v iptables >/dev/null; then
  for p in 80 443; do
    sudo iptables -C INPUT -p tcp --dport "$p" -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport "$p" -j ACCEPT
  done
  command -v netfilter-persistent >/dev/null && sudo netfilter-persistent save || true
fi

echo "==> 3/5 Secretos (.env)"
if [ ! -f .env ]; then
  cp env.example .env
  gen() { openssl rand -hex "$1"; }
  sed -i "s/^SECRET_KEY_BASE=.*/SECRET_KEY_BASE=$(gen 64)/" .env
  sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(gen 24)/" .env
  sed -i "s/^REDIS_PASSWORD=.*/REDIS_PASSWORD=$(gen 24)/" .env
  sed -i "s/^ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY=.*/ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY=$(gen 32)/" .env
  sed -i "s/^ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY=.*/ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY=$(gen 32)/" .env
  sed -i "s/^ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT=.*/ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT=$(gen 32)/" .env
  sed -i "s/^FB_VERIFY_TOKEN=.*/FB_VERIFY_TOKEN=$(gen 16)/" .env
  sed -i "s/^IG_VERIFY_TOKEN=.*/IG_VERIFY_TOKEN=$(gen 16)/" .env
  chmod 600 .env
  echo "    .env creado. Guardá una copia en un lugar seguro (sin ella no se recuperan los datos cifrados)."
else
  echo "    .env ya existe, no lo toco."
fi

echo "==> 4/5 Base de datos"
sudo docker compose pull
sudo docker compose up -d postgres redis
sleep 8
sudo docker compose run --rm chatwoot-rails bundle exec rails db:chatwoot_prepare

echo "==> 5/5 Levantando todo"
sudo docker compose up -d --build
DOM=$(grep ^CHAT_DOMAIN= .env | cut -d= -f2)
echo
echo "Listo. En unos minutos abrí https://$DOM y creá la cuenta de administrador."
echo "Siguiente: README.md, paso 5 (crear el asistente)."
