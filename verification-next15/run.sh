#!/usr/bin/env bash
# nextjs-builder 検証ハーネス（Next 15 版差）。verification/（Next 16）の姉妹。
# 目的は「対象が Next 15 のとき、エージェントが版に合わせて出す形が実ビルドできる」ことの固定。
# 検証する版差: middleware.ts（proxy.ts 改名前）/ 非同期リクエストAPI（await params・cookies）/
#               'use cache' 非使用（cacheComponents OFF）/ Route Handler の非キャッシュ既定。
# zod 等の実行時フットガンは版非依存なので 16 ハーネス（verification/runtime）に集約（ここでは重複させない）。
#
# 使い方: verification-next15/ で `bash run.sh`（初回は依存を install。node_modules は gitignore）。
# 順序に注意: next build が next-env.d.ts / .next/types を生成するため、typecheck は build の後に走らせる。
set -euo pipefail
cd "$(dirname "$0")"

echo "== 1/3 install (pinned: next 15.5.20 / react 19.0.0 / zod 4.4.3) =="
if [ ! -d node_modules ]; then
  npm install --no-audit --no-fund
else
  echo "  node_modules あり（再 install はスキップ。更新は node_modules を消してから）"
fi

echo "== 2/3 next build（版差パターンが Next 15 でビルドできるか） =="
npm run --silent build

echo "== 3/3 typecheck (tsc --strict) =="
npm run --silent typecheck

echo ""
echo "OK: Next 15 で next build + typecheck 通過。"
