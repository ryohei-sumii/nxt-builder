---
name: nextjs-builder
description: >-
  Next.js (App Router + TypeScript) のコードを、可読性・ドメイン適合・パフォーマンス・
  セキュリティ・SOLID の5軸で最適化して生成/レビュー/リファクタリングするための知識ベース。
  ページ・ルート・Server/Client Component・Server Action・Route Handler・データ取得・
  キャッシュ設計・フォーム・認可を実装するとき、または既存 Next.js コードの品質を上げるときに使う。
  トリガー例: "Next.jsで〜を作って", "App Routerで", "Server Action", "RSC", "route handler",
  "next/image", "revalidate", "この Next コードをレビュー/改善して"。
---

# Next.js Builder — 最適化ビルダーの知識ベース

Next.js **App Router + TypeScript** のコードを 5軸で最適化するための実務ガイド。
インストール不要（マークダウンのみ）。エージェント `nextjs-builder` と併用できる。

## 使い方（このスキルを読んだら）

1. **まず既存コードを調べる。** 何かを書く前に対象リポジトリの規約を把握する:
   - `package.json`（PM・Next バージョン・依存）, `tsconfig.json`, `next.config.*`, `app/` 構成,
     `.eslintrc*` / `eslint.config.*`, `components.json`（shadcn/ui）, `middleware.ts`。
   - 既存の PM（npm/pnpm/yarn/bun）・DB・認証・状態管理・スタイリングを**尊重**する。新規導入しない。
2. **設計を 2〜4行で宣言** してから実装する（ファイル配置と server/client 境界）。
3. **実装** は下記チェックリスト（`references/checklist.md`）を満たす。
4. **セルフレビュー** — 5軸チェックリストで確認し、可能なら型チェック/リンタ/ビルドを走らせる。

## 5つの最適化軸（原則の要約）

| 軸 | 一言原則 | 詳細 |
|----|----------|------|
| 可読性 | 半年後の自分が即読める | `references/readability-solid.md` |
| ドメイン適合 | RSC の思想に沿う | `references/architecture.md` |
| パフォーマンス | サーバー優先・最小バンドル | `references/performance.md` |
| セキュリティ | 全入力を検証・秘密を守る | `references/security.md` |
| SOLID | 変更に強い責任分割 | `references/readability-solid.md` |

## リファレンス（必要になったら読む）

- **`references/architecture.md`** — App Router / RSC / Server Actions / Route Handlers /
  ルーティング規約 / データ取得 / キャッシュ・再検証の設計。ファイル構成の指針。
- **`references/performance.md`** — バンドル削減 / ストリーミング / `next/image` `next/font` /
  動的import / メモ化 / データ取得の並列化。
- **`references/security.md`** — 入力検証(Zod) / 認可 / server-only 秘密 / XSS・CSRF・SSRF・
  オープンリダイレクト対策 / env 取り扱い / DBアクセス。
- **`references/readability-solid.md`** — 命名 / コンポーネント責務分割 / SOLID の React への適用 /
  型の付け方 / エラーハンドリング。
- **`references/checklist.md`** — 実装前・実装後に使う 5軸レビューチェックリスト。
- **`references/patterns.md`** — 頻出タスクの完成コード例（フォーム+Server Action、
  並列データ取得ページ、認可付き Route Handler、Suspense ストリーミング等）。

## 絶対に守る不変則（クイックリファレンス）

- **Server Component をデフォルト**にし、`'use client'` は葉に押し下げる。
- Server Action / Route Handler の**先頭で認可 → 入力を Zod 検証**。UIの出し分けは防御ではない。
- クライアントに送ってよい環境変数は `NEXT_PUBLIC_` のみ。秘密モジュールに `import 'server-only'`。
- `fetch` のキャッシュ挙動と `revalidate*` を**明示設計**する。曖昧なキャッシュを残さない。
- データ取得は**並列化**（`Promise.all`）し、リクエスト重複は `React.cache`。
- `dangerouslySetInnerHTML` / 文字列連結SQL / `any` を避ける。
- 生成コードは**完全に動く**ものにする。`// ...` で省略しない。
