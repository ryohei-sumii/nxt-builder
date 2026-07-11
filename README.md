# nxt-builder — Next.js コードビルダーエージェント

**可読性 / ドメイン適合 / パフォーマンス / セキュリティ / SOLID** の5軸で最適化された
Next.js (App Router + TypeScript) コードを扱う Claude Code エージェント。
**新規作成・機能追加・リファクタリング・バグ修正・レビュー**のすべてに対応します。
**Next.js 16 / React 19.2** を既定の前提とし（対象プロジェクトのバージョンは自動で確認して合わせます）。

> **インストール不要。** npm / pnpm / yarn / bun での依存追加は一切いりません。
> 中身はマークダウン定義だけなので、リポジトリに置くだけで Claude Code が読み込みます。

## 構成

```
.claude/
├── agents/
│   └── nextjs-builder.md          # 呼び出し可能なサブエージェント定義
└── skills/
    └── nextjs-builder/
        ├── SKILL.md               # 知識ベースの入口 + 常時遵守の不変則
        └── references/
            ├── architecture.md    # App Router / RSC / Server Actions / キャッシュ設計
            ├── performance.md     # バンドル削減 / ストリーミング / 並列取得
            ├── security.md        # 入力検証 / 認可 / server-only / XSS・SSRF 対策
            ├── readability-solid.md  # 命名 / 型 / SOLID / アクセシビリティ
            ├── debugging.md       # バグ修正プロトコル + Next.js 頻出バグ診断カタログ
            ├── testing.md         # データ層 / Server Action / Zod のテストと E2E 方針
            ├── libraries.md       # ライブラリ選定・使用の最適化（Zod 深掘り / カテゴリ別指針）
            ├── checklist.md       # 実装前後の 5軸 + 種別別レビューチェックリスト
            └── patterns.md        # 頻出タスクの完成コード例
```

- **サブエージェント** (`.claude/agents/nextjs-builder.md`): Next.js のタスクで自動的に、
  または「nextjs-builder エージェントで〜」と指定して呼び出せる専門エージェント。
- **スキル** (`.claude/skills/nextjs-builder/`): 5軸の詳細な知識ベースとチェックリスト。
  エージェントおよびメインの Claude が、複雑な実装時に該当リファレンスを参照します。

## 使い方

このリポジトリ（または `.claude/` をコピーした任意のプロジェクト）を Claude Code で開き、
次のように依頼するだけです。

- **新規作成**: 「App Router で、認可付きの投稿作成フォームを Server Action で作って」
- **機能追加**: 「この一覧ページにページネーションを追加して」
- **リファクタリング**: 「このページの Client Component を減らしてバンドルを軽くして」
- **バグ修正**: 「hydration mismatch のエラーが出る。原因を特定して直して」
- **レビュー**: 「この Route Handler をセキュリティ観点でレビューして」

エージェントはまずタスク種別を見極め、実装前に既存の規約（パッケージマネージャ・Next.js
バージョン・DB・認証・スタイリング・ESLint 設定）を調べ、それに合わせて作業します。
種別ごとに手順が変わります（バグ修正は「再現→根本原因→最小修正→検証→再発防止」、
リファクタは「振る舞いを変えない・スコープを広げない」を厳守）。

## 設計方針（5つの最適化軸）

| 軸 | 一言原則 |
|----|----------|
| 可読性 | 半年後の自分が即読める（命名・単一責任・浅いネスト） |
| ドメイン適合 | RSC の思想に沿う（Server Component 既定・正しいルーティング） |
| パフォーマンス | サーバー優先・最小バンドル・並列取得・ストリーミング |
| セキュリティ | 全境界入力を検証・認可を先頭で・秘密を漏らさない |
| SOLID | 単一責任と依存の逆転で変更に強い設計 |
