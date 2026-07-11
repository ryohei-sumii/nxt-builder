#!/usr/bin/env bash
# nextjs-builder 検証ハーネス。skill のコードパターンを実 Next 16 アプリとしてビルドし、
# 実行時挙動（zod フットガン等）を固定する。マークダウンの .claude/ とは独立したメンテナ用ツール。
#
# 使い方: verification/ で `bash run.sh`（初回は依存を install。node_modules は gitignore）。
# 順序に注意: next build が next-env.d.ts / .next/types を生成するため、typecheck は build の後に走らせる。
set -euo pipefail
cd "$(dirname "$0")"

echo "== 1/4 install (pinned: next 16.2.10 / react 19.2.7 / zod 4.4.3) =="
if [ ! -d node_modules ]; then
  npm install --no-audit --no-fund
else
  echo "  node_modules あり（再 install はスキップ。更新は node_modules を消してから）"
fi

echo "== 2/4 next build（面の通し検証：全パターンが合成してビルドできるか） =="
npm run --silent build

echo "== 3/4 typecheck (tsc --strict：runtime テスト等も含め全 .ts/.tsx) =="
npm run --silent typecheck

echo "== 4/4 runtime behavior (vitest: zod フットガン / schema 契約) =="
npm run --silent test

echo ""
echo "OK: next build + typecheck + runtime asserts すべて通過。"
