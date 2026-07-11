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
**Next.js 16 / React 19.2 前提**（Turbopack 既定・非同期リクエストAPI・Cache Components・
`proxy.ts`）。インストール不要（マークダウンのみ）。エージェント `nextjs-builder` と併用できる。

> 対象プロジェクトの Next.js バージョンは `package.json` で確認し、15 以前なら該当機能
> （`use cache` / `proxy.ts` 等）は使わず、そのバージョンの作法に合わせること。

## 使い方（このスキルを読んだら）

1. **タスク種別を判定する。** 新規作成 / 機能追加 / リファクタリング / バグ修正 / レビュー のどれか。
   種別ごとに進め方が変わる（下記「タスク種別ごとの進め方」）。
2. **まず既存コードを調べる。** 何かを書く前に対象リポジトリの規約を把握する:
   - `package.json`（PM・Next バージョン・依存）, `tsconfig.json`, `next.config.*`, `app/` 構成,
     `.eslintrc*` / `eslint.config.*`, `components.json`（shadcn/ui）, `proxy.ts` / `middleware.ts`, `README`。
   - 既存の PM（npm/pnpm/yarn/bun）・DB・認証・状態管理・スタイリングを**尊重**する。新規導入しない。
3. **実装** は該当種別の手順と下記チェックリスト（`references/checklist.md`）を満たす。
4. **セルフレビュー** — 5軸チェックリストで確認し、可能なら型チェック/リンタ/ビルド（あればテスト）を走らせる。

## タスク種別ごとの進め方

| 種別 | 要点 |
|------|------|
| **新規作成** | 設計を 2〜4行で宣言 → 実装 → 自己検証。 |
| **機能追加** | 呼び出し元・型・データ層・近接ルートを先に読み、**既存パターンを踏襲**して追加。影響範囲を把握してから着手。 |
| **リファクタリング** | **振る舞いを変えない**が最優先の制約。小さいステップで変更し、各ステップで型/リンタ/ビルド（あればテスト）で保全を確認。**依頼スコープを勝手に広げない**。 |
| **バグ修正** | **再現 → 根本原因 → 最小修正 → 検証 → 再発防止**。Next.js 特有バグは `references/debugging.md` の診断カタログを参照。 |
| **レビュー** | 実装せず 5軸で観点を洗い、「該当箇所・理由・具体的な修正案」で返す。 |

### リファクタリングの安全弁
- 入出力・副作用を先に把握し、**外から見た振る舞いを一致させたまま**内部を変える。
- 1コミット1目的。整形・改名・ロジック変更を1つに混ぜない。
- 「ついでの改善」を勝手に入れない。見つけた別課題は**提案として別途**挙げる。

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
- **`references/debugging.md`** — バグ修正プロトコル + Next.js 頻出バグ診断カタログ
  （hydration mismatch / RSC 境界 / キャッシュ未更新 / `params` await 漏れ / 動的レンダリング等）。
- **`references/testing.md`** — データ層/Server Action/Zod のユニットテストと E2E の方針（再発防止）。
- **`references/libraries.md`** — ライブラリの選定・使用の最適化（Zod の使い方深掘り、
  カテゴリ別指針、バンドル/RSC/セキュリティ観点、アンチパターン）。
- **`references/checklist.md`** — 実装前・実装後に使う 5軸レビューチェックリスト。
- **`references/patterns.md`** — 頻出タスクの完成コード例（フォーム+Server Action、
  並列データ取得ページ、認可付き Route Handler、Suspense ストリーミング等）。

## 絶対に守る不変則（クイックリファレンス）

- **Server Component をデフォルト**にし、`'use client'` は葉に押し下げる。
- Server Action / Route Handler の**先頭で認証・認可（所有チェック含む）→ 入力を Zod 検証**。
  UIの出し分けは防御ではない。
- クライアントに送ってよい環境変数は `NEXT_PUBLIC_` のみ。秘密モジュールに `import 'server-only'`。
- `fetch` のキャッシュ挙動と `revalidate*` を**明示設計**する。曖昧なキャッシュを残さない。
- データ取得は**並列化**（`Promise.all`）し、リクエスト重複は `React.cache`。
- `dangerouslySetInnerHTML` / 文字列連結SQL / `any` を避ける。
- 生成コードは**完全に動く**ものにする。`// ...` で省略しない。
