# ライブラリの選定・使用の最適化

「入れるか」「どう使うか」を 5軸（可読性/ドメイン適合/パフォーマンス/セキュリティ/SOLID）で判断する。
**大原則: 既存プロジェクトに選択があれば尊重する。** 新規構築・能力が未導入の場合は最適選定してよい
（要件からの選定フレームと推奨デフォルトは `references/stack-selection.md`）。いずれも下記で評価する。

## ライブラリ選定のチェック（追加を検討するとき）

- **まず標準機能で足りるか。** Web プラットフォーム / React / Next 組み込み（`fetch`・`URL`・
  `Intl`・`crypto`・Server Actions・`next/*`）で済むなら依存を増やさない。
- **クライアントバンドルへの影響（パフォーマンス最重要）。** そのライブラリはクライアントに乗るか？
  サーバー専用に閉じ込められるか？ tree-shaking 可能な**名前付き import** か？ 重い/巨大な依存は
  `next/dynamic` で遅延化するか、サーバー側に寄せる。
- **RSC / サーバー互換性。** Server Component で動くか（DOM 前提でないか）。Edge/Node どちらの
  ランタイム前提か。`'use client'` を強制する副作用がないか。
- **セキュリティ。** 秘密を扱うか（→ `server-only` 側に隔離）。メンテ状況・既知脆弱性・
  依存ツリーの大きさ（サプライチェーン面）を確認する。**選定した依存は install 前に名前の実在・正規性を
  確認する**（公式リポジトリ/発行元 provenance/正規名を照合し、綴り近縁の別パッケージ〔typo/slopsquat〕に
  注意。LLM が生成した名は実在・正規と限らない）。新規スタックの初期は lockfile を固定し `npm audit` を回す。
- **保守性（可読性/SOLID）。** 型が効くか。抽象（`lib/data` 等）越しに使えて差し替え可能か
  （特定ライブラリに UI を直結させない = DIP）。
- **重複を作らない。** 同種の別ライブラリが既にあるなら揃える（zod と yup の混在等を避ける）。

## Zod を最適に使う（バリデーションの中核）

Zod は**信頼境界の入力検証**に使う（`references/security.md`）。使い方の要点:

### スキーマを単一の真実に。型は推論で得る
スキーマを1箇所に定義し、`z.infer` で型を導出する。型とバリデーションを二重管理しない。

```ts
export const CreatePostSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1),
})
export type CreatePostInput = z.infer<typeof CreatePostSchema>   // 型は推論に任せる
```

### 境界では `safeParse`、内側は検証済みデータのみ
外部入力は `safeParse` で失敗を値として扱い、通過後は**再検証しない**（境界で1回）。
`parse`（例外を投げる）は「不正なら異常系でよい」箇所に限定する。

### 文字列由来の入力は `z.coerce` / `z.stringbool`
`formData` / クエリ / 環境変数は文字列。数値・日付は `z.coerce.number()` / `z.coerce.date()` で
変換しつつ検証する。**真偽値に `z.coerce.boolean()` は使わない** — 内部が `Boolean(input)` のため
`"false"` / `"0"` / `"off"` がすべて `true` になる（空文字/未送信のみ `false`）。真偽値は Zod 4 の
**`z.stringbool()`**（`true/1/yes/on` ↔ `false/0/no/off` を大小文字非依存で判定）を使う。
`z.enum(['true','false']).transform((v) => v === 'true')` やチェックボックスの存在判定（未送信=false）でもよい。
注: `z.coerce.number()` は空文字を `0` にする（任意入力の数値欄で無言の 0 混入）。必須にするか
`z.coerce.number().optional()` / `min` で意図を明示する。

### 状態・バリアントは判別可能ユニオン
`z.discriminatedUnion` で「不正な状態を表現不能」にする（`references/readability-solid.md` の型方針と一致）。

```ts
const Event = z.discriminatedUnion('type', [
  z.object({ type: z.literal('click'), x: z.number(), y: z.number() }),
  z.object({ type: z.literal('submit'), formId: z.string() }),
])
```

### 合成で再利用（DRY）
`.pick()` / `.omit()` / `.extend()` / `.partial()` でスキーマを組み立て、重複定義を避ける。
更新用は `CreateSchema.partial()`、永続化ペイロードは `.extend({ authorId: ... })` など。

### クロスフィールド検証は `.refine` / `.superRefine`
「パスワード確認一致」等はスキーマ内に閉じ込め、呼び出し側にロジックを漏らさない。

### 正規化は `.transform`
trim・小文字化などは `.transform` でスキーマ側に持たせ、出力型も推論に反映させる。

### Zod 4 の作法（現行）
- 書式は **top-level が推奨**: `z.email()` / `z.url()` / `z.uuid()`（旧 `z.string().email()` 等も動作）。
- エラーは `err.issues`（配列）で扱う。ユーザー向け文言は `message` を、機械処理は `code`/`path` を使う。

### 置き場所（セキュリティ/バンドル）
- スキーマ自体は軽量だが、**秘密や内部制約を含む検証は `server-only` 側**に置き、クライアントへ
  漏らさない。クライアント側フォーム検証と、サーバー側の権威ある検証は**別物**（サーバーが最終防衛線）。
- クライアントバンドルを極小化したい場面では、クライアント側バリデーションに **valibot**
  （tree-shaking で数 kB 級）を選ぶ手もある。サーバー側は zod のまま、という使い分けが可能。

## カテゴリ別の最適化指針（既存選択を尊重しつつ）

| 用途 | 最適化の観点 |
|------|-------------|
| **バリデーション** | zod を境界で。バンドル厳しめのクライアント検証は valibot も選択肢。型は推論。 |
| **データ層 / ORM** | Prisma / Drizzle など。`lib/data` の抽象越しに使い UI から直接触らせない（DIP）。必要列のみ `select`。 |
| **認証** | 既定は委譲（OAuth/パスワードレス or マネージド Clerk 等）。Auth.js の Credentials で自前運用するなら argon2id/bcrypt ハッシュ・ログイン/リセット応答の一様化(列挙対策)・メール検証・レート制限が必須（`references/security.md` §6/§7）。認可判定はサーバー（Server Action/Route Handler/`lib/data`）で。 |
| **フォーム** | まず Server Actions + `useActionState`。複雑な即時検証が要るとき React Hook Form + `zodResolver`。 |
| **状態管理** | サーバー状態を第一に。URL 状態は `nuqs`。グローバルクライアント状態が要る時だけ Zustand 等を最小限。 |
| **データ取得** | サーバー取得を既定。クライアント再取得/キャッシュが要る時のみ TanStack Query。`useEffect` 取得は避ける。 |
| **スタイリング** | Tailwind / CSS Modules など既存に従う。ランタイム CSS-in-JS は RSC 相性とパフォーマンスに注意。 |
| **日付** | `Intl` / `Temporal` / date-fns（個別 import）。moment は避ける（重い・非 tree-shakable）。 |
| **UI コンポーネント** | shadcn/ui 等はコード同梱型で tree-shaking しやすい。巨大 UI キットの全体 import を避ける。 |

## ライブラリ使用のアンチパターン

- `import _ from 'lodash'`（全体）→ 個別 import（`lodash-es` / `lodash/pick`）か標準 API に。
- moment / 巨大 polyfill を安易に追加 → バンドル肥大。
- クライアント専用の重いライブラリを共有モジュールに置く → 不要なコードがクライアントに漏れる。
- 同種ライブラリの重複（zod と yup、Zustand と Redux 併存）→ 揃える。
- ライブラリの型を `any` で潰す → 型の利点を捨てる。境界は `unknown` + 検証で受ける。
- 標準機能で足りるのに依存を足す（`Intl.NumberFormat` で済むのに通貨ライブラリ、等）。
