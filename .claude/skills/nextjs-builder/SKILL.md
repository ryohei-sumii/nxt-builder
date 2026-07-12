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

1. **タスク種別を判定する。** 新規作成 / 要件・設計から実装（選定含む）/ 機能追加 / リファクタリング /
   バグ修正 / レビュー のどれか。種別ごとに進め方が変わる（下記「タスク種別ごとの進め方」）。
2. **まず既存コードを調べる。** 何かを書く前に対象リポジトリの規約を把握する:
   - `package.json`（PM・Next バージョン・依存）, `tsconfig.json`, `next.config.*`, `app/` 構成,
     `.eslintrc*` / `eslint.config.*`, `components.json`（shadcn/ui）, `proxy.ts` / `middleware.ts`, `README`。
   - 既存の PM（npm/pnpm/yarn/bun）・DB・認証・状態管理・スタイリングを**尊重**する。新規導入しない。
     PM は **lockfile と `package.json` の `packageManager` から特定**し、install/build/test/lint/codemod
     などの**コマンドは必ずその PM 経由で実行**する（`npm`/`npx` を決め打ちしない。セキュリティ方針で
     npm 禁止の組織あり）。PM 別のコマンド対応表は `references/libraries.md`。
3. **実装** は該当種別の手順と下記チェックリスト（`references/checklist.md`）を満たす。
4. **セルフレビュー（完了条件）** — 5軸チェックリスト（`references/checklist.md`）で確認。コードを生成/
   変更したら型チェック（`tsc --noEmit` 相当）/ビルド（あればテスト）を実行し**緑まで完了としない**。
   `node_modules` 不在・install 不可でも「未検証で終える」を既定にせず、**検証の梯子**（既存 scripts →
   固定 install → 型チェック単独 → 静的照合）で確信度を上げる。回し切れない項目は**検証済み/未検証を
   分けて具体的に明示**する（「全部未検証」で丸めない。詳細は `references/checklist.md`「検証の梯子」）。

## タスク種別ごとの進め方

| 種別 | 要点 |
|------|------|
| **新規作成** | 設計を 2〜4行で宣言 → 実装 → 自己検証。 |
| **要件/設計から実装（選定含む）** | 要件把握（曖昧なら訊く）→ **長文仕様は ID 付き受け入れ基準に分解** → 5軸で**スタック/ライブラリ選定**（既存は尊重・新規は選ぶ）→ 決定を数行で宣言し重大選定は確認 → 実装 → **全 ID を突き合わせて網羅確認**＋自己検証。詳細は `references/stack-selection.md`。 |
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
- **`references/stack-selection.md`** — 要件/設計からの実装。スタック/ライブラリの選定フレーム、
  カテゴリ別の推奨デフォルト、スタック決定記録、選定するか尊重するかの判断。
- **`references/data-access.md`** — データアクセス層 (DAL) パターン。認証・所有/ロール認可の集約、
  ORM クエリ最適化（select/N+1/ページング/トランザクション/接続）、DTO 化。
- **`references/cloud-webhooks.md`** — Webhook 受信/送信とクラウド（AWS/GCP 等）連携の最適化。
  署名検証・生ボディ・冪等性・`after()`/キュー・presigned URL・シークレット管理・ランタイム選択。
- **`references/checklist.md`** — 実装前・実装後に使う 5軸レビューチェックリスト。
- **`references/patterns.md`** — 頻出タスクの完成コード例（フォーム+Server Action、
  並列データ取得ページ、認可付き Route Handler、Suspense ストリーミング等）。

> 上記リファレンスは**代表例であって網羅リストではない**。ここに無い領域（i18n・決済・リアルタイム・
> 監視 等）でも、下の「一般手順」で同じ品質を出せる。個別ドキュメントの有無に依存しない。

## 未収載の領域の扱い方（一般手順）

リファレンスに専用ページが無いタスクは、次の手順で対処する。ドメイン知識の欠落を「調べる・裏取り・
検証」で埋め、憶測で書かない。

1. **既存規約を調べる。** そのリポジトリで同種の機能がどう実装されているかをまず読み、踏襲する。
2. **現行仕様を裏取りする。** ライブラリ/フレームワークのバージョン依存挙動・API は**記憶で断定せず**、
   `package.json` で版を確認し、必要なら**`WebSearch` で該当バージョンの公式ページを探し `WebFetch` で
   本文を読んで**確認する（例: Next 16・zod 4 の作法）。憶測のまま書かない。
3. **信頼境界を特定する。** どこが外部入力/認可点か（Server Action / Route Handler / Webhook / 外部API）
   を見極め、そこで認証・認可・入力検証を必ず行う。
4. **5軸で判断する。** 可読性・ドメイン適合・パフォーマンス・セキュリティ・SOLID を同時に満たす設計を選ぶ。
   トレードオフは明示する。
5. **実際に検証する。** 生成コードは型チェック/ビルド/テストで**そのまま動く**ことを確かめる
   （`references/testing.md`）。憶測のまま「たぶん動く」で終えない。

## 絶対に守る不変則（クイックリファレンス）

- **Server Component をデフォルト**にし、`'use client'` は葉に押し下げる。
- Server Action / Route Handler の**先頭で認証・認可（所有チェック含む）→ 入力を Zod 検証**。
  UIの出し分けは防御ではない。
- クライアントに送ってよい環境変数は `NEXT_PUBLIC_` のみ。秘密モジュールに `import 'server-only'`。
- `fetch` のキャッシュ挙動と `revalidate*` を**明示設計**する。曖昧なキャッシュを残さない。
- データ取得は**並列化**（`Promise.all`）し、リクエスト重複は `React.cache`。
- **失敗は種類で扱い分ける**: 予期される失敗＝typed 返却/適切な 4xx、予期しない失敗＝握り潰さず throw して
  最寄りの `error.tsx`（root は `global-error.tsx`）へ。`notFound()`/`redirect()` は `try/catch` の外で呼ぶ。
- `dangerouslySetInnerHTML` / 文字列連結SQL / `any` を避ける。
- 生成コードは**完全に動く**ものにする。`// ...` で省略しない。**型チェック/ビルド（あればテスト）を
  実行して緑を確認するまで完了としない**（回せない環境なら未検証と明示する）。
