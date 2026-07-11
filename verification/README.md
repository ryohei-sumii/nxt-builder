# verification — メンテナ用の通し検証ハーネス

`.claude/`（配布物・マークダウンのみ）とは**独立したメンテナ専用ツール**。目的は、スキルが
`references/` で示すコードパターンが **実 Next.js 16 環境で本当にコンパイル・ビルドでき、
バージョン依存の実行時挙動が主張どおりか**を機械的に固定すること。

> このディレクトリはエージェントの動作には不要（`.claude/` を対象プロジェクトへ置くだけで動く）。
> `verification/` はリポジトリを**保守する側**が品質を回帰チェックするために置いている。

## 何を検証するか（3層）

1. **面の通し検証（`next build`）** — `app/` は SKILL の代表パターン（Server Action + Zod +
   `useActionState` フォーム / 認可付き並列取得ページ + Suspense / Route Handler / Webhook 署名検証 /
   presigned アップロード / donut / env 分割 / `generateMetadata` / DAL）を1つの**実ビルド可能な
   Next 16 アプリ**に組んだもの。個々のスニペットではなく、**合成してビルドが通るか**を見る。
2. **型検証（`tsc --strict`）** — `app/` と `runtime/` を含む全 `.ts/.tsx` を strict で型検査する。
3. **実行時挙動（`vitest`）** — tsc をすり抜ける**実行時の落とし穴**を固定する。特に:
   - `z.coerce.boolean()` が `"false"/"0"/"off"` を `true` にする**フットガン**（→ `z.stringbool()` 推奨）。
   - `z.coerce.number()` の空文字 → `0`。
   - presigned の contentType allowlist(enum)、Zod 4 の `z.email()/z.url()` top-level 書式。
   - 実アプリの `CreatePostSchema` の境界（`lib/validation/post.ts` を import して契約を固定）。

## 使い方

```bash
cd verification
bash run.sh          # install → next build → tsc --strict → vitest
```

- 依存はピン留め（`next 16.2.10 / react 19.2.7 / zod 4.4.3`）。`node_modules` はコミットしない。
- 実行順は **build → typecheck → test**（`next build` が `next-env.d.ts` / `.next/types` を生成し、
  型検査がそれを参照するため）。

## スコープ（正直な範囲）

- **担保する**: パターンが最新 Next 16 でコンパイル・ビルドでき、zod 等の実行時挙動が docs の主張どおり。
- **担保しない**: キャッシュ意味論（`cacheComponents` はあえて無効。既定=動的で検証）、E2E のブラウザ挙動
  （Playwright は未導入。必要なら `references/testing.md` の方針で足す）、実 DB/認証/ストレージ
  （スタブ）。ここは「そのまま動く完全なコード」を出す**エージェント実行時**に、各対象プロジェクトで
  型/ビルド/テストを回して担保する（`checklist.md` 最終確認）。

## 更新の作法

`references/*.md` のコード例を**追加/変更したら、対応するファイルを `app/` か `runtime/` に反映して
`bash run.sh` を緑にしてから**コミットする（CLAUDE.md の「コード例は実コンパイルで裏取り」を
このハーネスで機械化したもの）。挙動が変わった場合（例: 将来 zod が `coerce.boolean` を直した）は、
テストが落ちて docs の文言を見直す合図になる。
