# 可読性 & SOLID（React/Next への適用）

「動く」だけでなく「半年後に安全に変更できる」コードを書く。

## 可読性の原則

- **命名が意図を語る。** `data` / `handle` / `tmp` ではなく `activeUsers` / `submitOrder` /
  `pendingInvoices`。ブール値は `is/has/should/can` 接頭辞。
- **コメントは「なぜ」。** 「何を」しているかはコードで表現し、非自明な理由・制約・トレードオフだけを
  コメントに残す。コメントアウトされた死んだコードは削除する。
- **早期リターン**でネストを浅く保つ。ガード節でエッジケースを先に処理する。
- **マジックナンバー/文字列は名前付き定数**に。単位・意味を名前に込める（`MAX_UPLOAD_BYTES`）。
- **1関数1責任・短く保つ。** 画面・分岐が増えたらコンポーネント/フック/純関数に切り出す。
- **フォーマットは既存の ESLint/Prettier 設定に従う。** 独自スタイルを持ち込まない。

## 型の付け方（TypeScript）

- **`any` を使わない。** 不明な入力は `unknown` として受け、絞り込んで使う。
- ドメインの型を明示的に定義し、`Props` を正確に。オプショナルと必須を区別する。
- 判別可能ユニオンで状態を表現（`{ status: 'loading' } | { status: 'error'; error: E } |
  { status: 'ok'; data: T }`）。不正な状態を型で表現不能にする。
- 外部境界（API 応答・env）は Zod でパースし、型は推論（`z.infer`）に任せる。
- `as` によるキャストは最小限。必要なら理由をコメントする。

## SOLID の React/Next への翻訳

### S — 単一責任 (Single Responsibility)
- **1 コンポーネント = 1 の理由でしか変わらない。** 「取得」「表示」「フォーム状態」「レイアウト」を
  1つに詰め込まない。
- データ取得は Server Component（またはデータ層関数）に、表示は presentational component に、
  インタラクションは小さな Client Component に分離する。

### O — 開放/閉鎖 (Open/Closed)
- バリアントは巨大な `if/switch` で分岐させず、**設定オブジェクト / マップ / composition** で拡張する。
- `children` / slot / render props で「中身」を差し替え可能にし、既存を書き換えずに拡張する。

### L — リスコフの置換 (Liskov Substitution)
- ラッパーコンポーネントは元コンポーネントの契約（props・ARIA・ref 転送）を壊さない。
- ネイティブ要素を包む場合は `...rest` と `forwardRef` で透過性を保つ。

### I — インターフェース分離 (Interface Segregation)
- **props は必要最小限。** 「god props」（巨大オブジェクトを丸ごと渡す）を避け、使う値だけ渡す。
- 1つの多目的コンポーネントより、目的別の小さなコンポーネント群を好む。

### D — 依存性の逆転 (Dependency Inversion)
- UI コンポーネントは**具体的なデータソースに直接依存しない。** DB クライアントや fetch を
  コンポーネント内に埋め込まず、`lib/data/` のデータアクセス関数（抽象）越しに使う。
- これによりデータ層（ORM / 外部API / モック）を差し替えてもUIが変わらず、テストも容易になる。

```ts
// lib/data/posts.ts — 抽象（UI はこの型だけを知る）
export interface PostRepository {
  list(): Promise<Post[]>
  byId(id: string): Promise<Post | null>
  create(input: CreatePostInput): Promise<Post>
  // 必要に応じて update / delete も同じ契約に含める
}
// 実装は差し替え可能（Prisma / Drizzle / 外部API / テスト用モック）
export const posts: PostRepository = drizzlePostRepository
```

## アクセシビリティ（UI を作るなら必須）

- **セマンティック HTML を優先。** `div` に `onClick` を付けるより `<button>` / `<a>` /
  `<label>` などネイティブ要素を使う（キーボード操作・フォーカス・ARIA が既定で付く）。
- フォーム入力は `<label htmlFor>` で関連付ける（またはラベルで包む）。アイコンのみのボタンは
  `aria-label` を付ける。
- **キーボードだけで操作可能**に保ち、フォーカスが見える状態を維持する（`outline` を消さない）。
- 開閉・モーダル・メニュー等のインタラクティブな Client Component には状態を ARIA に反映する
  （`aria-expanded` / `role` / 必要ならフォーカストラップと Esc で閉じる）。
- 画像は意味があれば `alt`、装飾なら `alt=""`。色だけで情報を伝えない。

## エラーハンドリング

- `error.tsx`（`'use client'`）でルート単位のエラーバウンダリを提供し、リカバリ（`reset()`）を渡す。
  root layout 自体のエラーは `global-error.tsx`（`'use client'`・`<html><body>` を自前描画）で捕捉する。
- `not-found.tsx` と `notFound()` で 404 を適切に扱う。
- Server Action は例外を投げるより、フォーム用途では `{ error }` を返して UI で表示する方が扱いやすい
  （用途で使い分ける）。
- ユーザー向けメッセージは平易に。内部エラー詳細はログにのみ。

## 可読性・設計チェック（提出前に自問）
- [ ] 各コンポーネントは単一責任か？肥大化していないか？
- [ ] props は最小限か（god props になっていないか）？
- [ ] UI がデータ層の具体実装に直接依存していないか？
- [ ] `any` を排し、状態を型で正しく表現したか？
- [ ] 命名で意図が伝わるか？マジック値を定数化したか？
