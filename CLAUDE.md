# CLAUDE.md

このリポジトリで作業する Claude（および将来のセッション）向けのプロジェクトメモリ。

## このリポジトリは何か

**Next.js コードビルダーエージェント**そのもの（アプリではない）。中身は Claude Code の
**エージェント定義 + スキル**で、すべて**マークダウンのみ**。npm/pnpm 等のインストールは不要
（置くだけで Claude Code が読み込む）。目的は、Next.js のコードを **5軸**
（可読性 / ドメイン適合 / パフォーマンス / セキュリティ / SOLID）で最適化して
生成・機能追加・リファクタ・バグ修正・レビュー、および**要件からのスタック選定＋実装**を行うこと。

## 構成

```
.claude/
├── agents/nextjs-builder.md          # 呼び出し可能なサブエージェント定義（薄い行動プロトコル）
└── skills/nextjs-builder/
    ├── SKILL.md                      # 入口・不変則・タスク種別・未収載領域の一般手順
    └── references/                   # 詳細知識（必要時に読む・代表例であり網羅リストではない）
        ├── architecture.md           # App Router / RSC / Server Actions / キャッシュ(Cache Components)
        ├── performance.md            # バンドル削減 / ストリーミング / Turbopack
        ├── security.md               # 入力検証 / 認可(IDOR含む) / server-only / データ露出 / CSP
        ├── readability-solid.md      # 命名 / 型 / SOLID / アクセシビリティ
        ├── debugging.md              # バグ修正プロトコル + Next.js 頻出バグ診断
        ├── testing.md                # Vitest / Server Action / Zod / Playwright E2E
        ├── libraries.md              # ライブラリ選定・使用最適化（Zod 深掘り）
        ├── stack-selection.md        # 要件→選定→実装、カテゴリ別推奨デフォルト
        ├── data-access.md            # データアクセス層(DAL): 認可集約 / ORM最適化 / DTO
        ├── cloud-webhooks.md         # Webhook 署名検証 + クラウド(AWS/GCP)連携
        ├── checklist.md              # 実装前後の 5軸 + 種別別チェックリスト
        └── patterns.md               # 完成コード例（フォーム/並列取得/RouteHandler/donut/metadata 等）
README.md                             # 構成と使い方
```

## 対象バージョンの前提（重要）

- **Next.js 16 / React 19.2 / TypeScript 5.x / zod 4** を既定の前提とする。
- Next 16 の要点: Turbopack 既定 / 非同期リクエストAPI（`params`/`searchParams`/`cookies`/`headers`
  は await 必須・同期撤廃）/ Cache Components（`cacheComponents` + `'use cache'`、既定は動的）/
  `middleware.ts` → `proxy.ts`（旧 middleware は Edge で動作継続・非推奨）。
- zod 4 は書式 `z.email()`/`z.url()`/`z.uuid()` が推奨。
- **バージョン依存の挙動は記憶で断定せず、対象の `package.json` を確認し公式で裏取りする**
  （このリポジトリの記述はその方針で書かれている）。15 以前のプロジェクトではその作法に合わせる。

## 中核の原則

- Server Component が既定。`'use client'` は葉に押し下げる。
- 信頼境界（Server Action / Route Handler / Webhook）の先頭で**認証・認可（所有チェック含む）→ Zod 検証**。
  読み取り経路も認可対象（IDOR 回避）。UI の出し分けは防御ではない。
- データ取得・認可・ORM は `lib/data` の **DAL** に集約（DIP）。必要列のみ select、DTO 化。
- **既存に選択があれば尊重。新規/能力未導入なら 5軸で最適選定**し理由を添える。
  重大・不可逆な選定（DB/ORM/認証/デプロイ）と新規依存追加は**着手前に確認**。
- 未収載の領域は SKILL の「一般手順」（規約調査→仕様の裏取り→信頼境界特定→5軸判断→実検証）で対処。

## 作業の作法（このリポジトリを編集するとき）

- **コード例を追加/変更したら実コンパイルで裏取りする。** スクラッチパッドに実プロジェクト
  （Next 16 / React 19 / zod 4 / vitest）を作り `tsc --noEmit --strict` を通してから記述する
  （過去ラウンドでこの基準を確立。目視や記憶で断定しない）。
- ドキュメントは日本語。5軸のトーンと既存の見出し構成に合わせる。
- 個別ドメインの無限追加は避ける。代表例＋一般手順で汎化するのが本方針
  （ユーザーの「個別最適化はキリがない」という判断に沿う）。
- 3ファイル（agent / SKILL / checklist）で重複する規約（調査対象ファイル・認可の文言など）は
  食い違わないよう揃える。

## これまでの品質プロセス（経緯）

- 多観点レビュー（敵対的検証つきワークフロー）を計7ラウンド実施し、24→12→1→3件…と収束。
  中でも、middleware.ts の Next16 挙動は**ワークフローの指摘が逆で、公式で裏取りして正した**
  経緯がある（記憶やレビュー結果を鵜呑みにせず一次情報で確認する）。
- ラウンド7は「要件/設計からの実装（スタック選定）」経路に焦点。選定経路の自己検証ループを閉じ
  （checklist に選定種別ブロック新設・種別判定を6種に整合）、レート制限/濫用対策・認証の安全な既定
  （委譲優先＋Credentials 時の必須ガード）・データ特性/非同期の要件把握・§4 決定記録の
  セキュリティ前提＆永続化を横断追加。zod は `z.coerce.boolean()` のフットガンを `z.stringbool()` へ、
  Stripe 特定の webhook 例を汎用化＋公式 verifier 注記、presigned に allowlist/サイズ強制を追加。
- 全コードスニペットを実 Next 16.2.10 / React 19.2.7 / zod 4.4.3 / vitest で tsc 検証済み
  （ラウンド7の `z.stringbool` / presigned enum も zod 4.4.3 + tsc --strict で裏取り）。

## Git / ブランチ

- 開発ブランチ: **`claude/nextjs-builder-agent-i6m54v`**（このブランチで作業・コミット・プッシュ）。
- 現状このブランチが**リポジトリの唯一かつデフォルトブランチ**。別ベースが無いため PR は
  base=head になり作成不可（作業は実質本線）。PR フローが要るならベースブランチの用意が必要。
- コミット: 明確なメッセージ。フッタは `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
  と `Claude-Session: ...` を付ける（コミット/PR 等に model 識別子は入れない）。
- push は `git push -u origin claude/nextjs-builder-agent-i6m54v`。ネットワーク失敗時は指数バックオフで再試行。
