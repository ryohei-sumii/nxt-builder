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
verification/                         # メンテナ用の通し検証ハーネス（配布物ではない・node_modules 非コミット）
├── app/ lib/ components/             # SKILL の代表パターンを組んだ実ビルド可能な Next 16 アプリ
├── runtime/                          # vitest: zod フットガン等の実行時挙動を固定
├── eval-set.md                       # 典型依頼10件 × 満たすべき不変条件（回帰ルーブリック）
└── run.sh                            # install → next build → tsc --strict → vitest
verification-next15/                  # 姉妹ハーネス: Next 15 の版差だけを実 Next 15.5 でビルド固定
├── app/ lib/ middleware.ts           # middleware.ts（proxy.ts 改名前）/ 非同期API / 'use cache' 非使用
└── run.sh                            # install → next build → tsc --strict
README.md                             # 構成と使い方
```

> `.claude/` は配布物でマークダウンのみ。`verification/` はそれとは独立した**保守側の QA ツール**で、
> エージェントの動作には不要（対象プロジェクトへ置くのは `.claude/` だけ）。

## 対象バージョンの前提（重要）

- **Next.js 16 / React 19.2 / TypeScript 5.x / zod 4** を既定の前提とする。
- Next 16 の要点: Turbopack 既定 / 非同期リクエストAPI（`params`/`searchParams`/`cookies`/`headers`
  は await 必須・同期撤廃）/ Cache Components（`cacheComponents` + `'use cache'`、既定は動的）/
  `middleware.ts` → `proxy.ts`（旧 middleware は Edge で動作継続・非推奨）。
- zod 4 は書式 `z.email()`/`z.url()`/`z.uuid()` が推奨。
- **バージョン依存の挙動は記憶で断定せず、対象の `package.json` を確認し公式で裏取りする**
  （このリポジトリの記述はその方針で書かれている）。15 以前のプロジェクトではその作法に合わせる。
  エージェントは `WebSearch`/`WebFetch` を持つので、不確かな版依存挙動・API・既知脆弱性は
  該当バージョンの公式を参照して裏取りする（実行環境で web が使えない時は未確認と明示）。

## 中核の原則

- Server Component が既定。`'use client'` は葉に押し下げる。
- 信頼境界（Server Action / Route Handler / Webhook）の先頭で**認証・認可（所有チェック含む）→ Zod 検証**。
  読み取り経路も認可対象（IDOR 回避）。UI の出し分けは防御ではない。
- データ取得・認可・ORM は `lib/data` の **DAL** に集約（DIP）。必要列のみ select、DTO 化。
- **既存に選択があれば尊重。新規/能力未導入なら 5軸で最適選定**し理由を添える。
  重大・不可逆な選定（DB/ORM/認証/デプロイ）と新規依存追加は**着手前に確認**。
- 未収載の領域は SKILL の「一般手順」（規約調査→仕様の裏取り→信頼境界特定→5軸判断→実検証）で対処。

## 作業の作法（このリポジトリを編集するとき）

- **コード例を追加/変更したら実コンパイルで裏取りする。** これは `verification/` ハーネスに機械化した:
  `cd verification && bash run.sh` で **`next build`（面の通し検証）＋ `tsc --strict` ＋ vitest（zod 等の
  実行時フットガン）** を回す（ピン留め: Next 16.2.10 / React 19.2.7 / zod 4.4.3。`node_modules` は非コミット）。
  `references/*` のコード例を変えたら対応を `verification/app` か `verification/runtime` に反映し、緑にしてから
  コミットする。目視や記憶で断定しない。典型依頼の期待は `verification/eval-set.md`（回帰ルーブリック）。
  **版差（`proxy.ts`↔`middleware.ts` / 非同期API / `'use cache'`）に触れる変更は `verification-next15/`
  でも `bash run.sh`（Next 15.5 で build + tsc）を緑にする。**実行時フットガン（zod 等）は版非依存なので
  16 ハーネスに集約し 15 側では重複させない。
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
- ラウンド8で品質プロセスを"面"に強化: (1)`verification/` ハーネスを新設し、代表パターンを**実ビルド可能な
  Next 16 アプリ**に組んで `next build`＋`tsc --strict`＋vitest を1コマンド（`run.sh`）で回せるようにした
  （スニペット単位の ad hoc 検証を機械化・回帰化。zod の実行時フットガンも固定）。(2)エージェント本体の
  自己検証を「可能なら」から**完了条件（緑になるまで完了としない／回せない時は未検証と明示）**へ格上げ。
  (3)`eval-set.md`（典型依頼10件の不変条件）を回帰ルーブリックとして追加。
- ラウンド9で**トークンコスト最適化**（品質は不変）: エージェント本体の「中核となる判断基準（要約）」が
  references を三重再掲していたのを、全ハード不変則を in-context に残したまま**要点＋参照ポインタへ圧縮**
  （agent 136→108行。品質を担保しているのは「タスク種別ルーティング＋必要時の reference 読み」であり、
  要約の再掲は非寄与だと eval-set 10件で確認）。SKILL.md も自己検証条件の二重記載を1本化。
  frontmatter description は発火/選定品質を落とさないため非変更。設計意図「agent＝薄い行動プロトコル」に回帰。
- ラウンド10で**パッケージマネージャ非依存化**（npm 決め打ちの解消）: PM 尊重は「依存の選定」だけでなく
  **実行コマンド全体**（install/build/test/lint/codemod/audit）に及ぶべきなのに、具体コマンドが軒並み
  `npm audit` / `npx @next/codemod` / `npx playwright` と npm 固定だった。セキュリティ方針で npm を禁止し
  pnpm/bun のみ許可する組織があるため、(1)`libraries.md` に「PM を尊重して実行する」節＋PM別コマンド対応表
  （npm/pnpm/yarn(berry)/bun × 固定install/追加/script/exec/dlx/audit）を新設。lockfile と `packageManager`
  から特定、版差は裏取りする注記付き。(2)agent の既存規約把握・SKILL の調査手順・checklist の最終確認に
  「特定した PM 経由で実行、npm/npx を決め打ちしない」を横断追加（3ファイル整合）。(3)testing/debugging/
  architecture/security の決め打ちコマンドを対応表参照の中立表現へ。コード例（コンパイル対象）は不変なので
  ハーネス再実行は不要（プロース/表のみ）。
- ラウンド11で**横断能力の穴埋め①②**（新ドメイン追加ではなく、コーディングエージェントの振る舞い強化）:
  - **①「検証できない環境」を主経路化**: 完了条件が「回せなければ未検証で終える」の二値だったのを、
    **検証の梯子**（①既存 scripts を PM 経由 → ②lockfile ありで導入可能なら固定 install→型/build →
    ③install 不可なら型チェック単独 → ④静的照合〔使う API の実型を import 元で読む・import 解決・境界の
    認可/検証を目視・版依存は公式裏取り〕）へ格上げ。`node_modules` 不在の新規クローンが既定であることを踏まえ
    「未検証で丸めない／検証済みと未検証を分けて具体的に報告」を明文化（checklist に梯子・agent/SKILL に要約）。
  - **②エラーと耐障害性を5軸の抜けとして補完**: 「失敗を種類で分ける」原則（予期される失敗＝typed 返却/4xx、
    予期しない失敗＝握り潰さず throw→最寄り `error.tsx`／root は `global-error.tsx`。`notFound()`/`redirect()`
    は try/catch の外）＋観測性（`instrumentation.ts` の `onRequestError`・構造化ログ・PII/秘密を出さない）を
    architecture に新節、patterns §7 を **error/global-error/not-found/instrumentation の4例をコンパイル済み**へ拡張、
    checklist・agent・SKILL に不変則を横断追加。ハーネスに `global-error.tsx`/`not-found.tsx`/`instrumentation.ts`
    を追加し **next build＋tsc --strict＋vitest 緑を確認**（`onRequestError` は `next` の `Instrumentation` 型で裏取り）。

## Git / ブランチ

- 開発ブランチ: **`claude/nextjs-builder-agent-i6m54v`**（このブランチで作業・コミット・プッシュ）。
  origin のデフォルトブランチもこれ。
- `main` ブランチも存在し、**現在は開発ブランチと同一コミットに同期**している。PR フローが要るなら
  base=`main` で出せる。開発ブランチへ push した後、`main` を fast-forward で追随させて揃える運用。
- コミット: 明確なメッセージ。フッタは `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
  と `Claude-Session: ...` を付ける（コミット/PR 等に model 識別子は入れない）。
- push は `git push -u origin claude/nextjs-builder-agent-i6m54v`。ネットワーク失敗時は指数バックオフで再試行。
