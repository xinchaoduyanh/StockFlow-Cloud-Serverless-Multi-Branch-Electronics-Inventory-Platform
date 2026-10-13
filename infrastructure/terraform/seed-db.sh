#!/usr/bin/env bash
# ============================================================
# Chạy migrate + seed thẳng từ máy dev tới Neon qua DIRECT_URL.
# Neon nằm ngoài AWS nên không cần ECS task hay VPC như thời Aurora.
#
# Cách dùng (từ thư mục gốc repo):
#   export DIRECT_URL='postgresql://...'   # direct URL của Neon, KHÔNG dán vào chat/commit
#   infrastructure/terraform/seed-db.sh            # migrate rồi seed
#   infrastructure/terraform/seed-db.sh --skip-seed  # chỉ migrate
# ============================================================
set -euo pipefail

if [[ -z "${DIRECT_URL:-}" ]]; then
  echo "DIRECT_URL chưa được đặt. Đặt direct URL của Neon rồi chạy lại." >&2
  exit 1
fi

cd "$(dirname "$0")/../../apps/api"

# prisma migrate cần kết nối trực tiếp (không qua pgbouncer); seed dùng cùng URL cho đơn giản.
export DATABASE_URL="$DIRECT_URL"

echo "=== migrate ==="
npx prisma migrate deploy

if [[ "${1:-}" != "--skip-seed" ]]; then
  echo "=== seed ==="
  npm run db:seed
fi

echo "Done."
