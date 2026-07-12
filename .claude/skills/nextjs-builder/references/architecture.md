# アーキテクチャ / ドメイン適合（App Router + RSC）

Next.js App Router の思想に沿った「正しいイディオム」で書くための指針。

## Server / Client の境界設計

- **すべてのコンポーネントはデフォルトで Server Component。** `'use client'` を付けるのは、
  ブラウザ API・イベントハンドラ・`useState`/`useEffect`・React Context を**実際に使う葉**だけ。
- `'use client'` は**ツリーの葉側に押し下げる**。ページ全体を client にすると、その配下全部が
  クライアントバンドルに乗る。インタラクティブな小片だけを client 化する。
- Server Component は Client Component を **children / props として渡せる**（"donut" パターン）。
  これによりインタラクティブな殻の中にサーバー描画コンテンツを差し込める。

```tsx
// ❌ ページ全体を client 化（配下すべてがバンドルに乗る）
'use client'
export default function Page() { /* ... */ }

// ✅ インタラクティブ部分だけ client、残りは server のまま
// app/page.tsx (Server Component)
import { LikeButton } from './like-button'      // 'use client' はこの中だけ
export default async function Page() {
  const post = await getPost()                  // サーバーで取得
  return <article>{post.body}<LikeButton id={post.id} /></article>
}
```

- **Client Component に渡す props はシリアライズ可能**でなければならない（関数・クラス・Date の
  一部などは不可。Server Action 関数は例外的に渡せる）。

## Server Actions (`'use server'`)

- フォーム送信・ミューテーションのための**サーバー実行関数**。信頼境界であり、
  **先頭で認証・認可 → 入力検証（Zod）** を行う（`references/security.md`）。
  「ログイン済みか（認証）」と「その資源の持ち主か（認可・所有チェック）」は別物として両方確認する。
- `revalidatePath` / `revalidateTag` でキャッシュを更新し、必要なら `redirect()` する。
- 進捗/エラー UI は `useActionState`（React 19.2 / Next 16）または `useFormStatus` で扱う。

```tsx
// app/actions.ts
'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

const Schema = z.object({ title: z.string().min(1).max(200) })

export async function createPost(_prev: unknown, formData: FormData) {
  const session = await auth()
  if (!session) return { error: '認証が必要です' }        // 認証（ログイン済みか）

  const parsed = Schema.safeParse({ title: formData.get('title') })
  if (!parsed.success) return { error: '入力が不正です' }  // 検証

  await db.post.create({ data: { ...parsed.data, userId: session.userId } })
  revalidatePath('/posts')
  return { ok: true }
}
```

## Route Handlers (`app/**/route.ts`)

- 外部公開 API・Webhook・非HTML応答に使う。**同じく先頭で認証・認可＆検証。**
- `NextResponse` を使い、適切なステータス・キャッシュヘッダを返す。
- ページ内のデータ取得のために Route Handler を経由**しない**（自分のサーバーに余計な HTTP を挟む
  だけ）。Server Component から直接データ層を呼ぶ。

## データ取得

- **コンポーネントにコロケーション**して取得する。取得を上に集めて props で配りすぎない。
- **ウォーターフォールを避ける。** 独立した取得は `Promise.all` で並列化する。

```tsx
// ❌ 直列（合計 = 各所要時間の和）
const user = await getUser(id)
const posts = await getPosts(id)

// ✅ 並列（合計 = 最も遅い一方）
const [user, posts] = await Promise.all([getUser(id), getPosts(id)])
```

- 同一リクエスト内で同じデータを複数箇所が要求するなら **`React.cache`** で重複排除する。

```tsx
import { cache } from 'react'
// 表示に必要な列のみ select する（DB レコード丸ごとは RSC ペイロードで露出しうる。security.md 3.5 参照）
export const getUser = cache((id: string) =>
  db.user.findUnique({ where: { id }, select: { id: true, name: true } }))
```

## キャッシュ / 再検証（明示的に設計する）

- **前提（Next.js 16）**: キャッシュは**完全にオプトイン**。デフォルトでは動的コードは
  **リクエスト時に実行**され、`fetch` も **uncached（毎回取得）** がデフォルト。
  Next 14 以前の「暗黙にほぼ全部キャッシュ」挙動は撤廃された。
- **Cache Components（推奨モデル）**: `next.config` で `cacheComponents: true` を有効化し、
  キャッシュしたいコンポーネント/関数/ルートの先頭に **`'use cache'` ディレクティブ**を付けて
  明示的にキャッシュする（PPR と組み合わさり、静的な殻を即返しつつ動的部分をストリーミングする）。

```tsx
// キャッシュしたい単位の先頭に付ける
async function ProductList() {
  'use cache'
  // 注: この境界内で cookies()/headers() を読むとエラー。リクエスト依存値は引数で渡す
  const products = await db.product.findMany()
  return <ul>{products.map((p) => <li key={p.id}>{p.name}</li>)}</ul>
}
```

- **`'use cache'` 境界内は「リクエスト非依存」でなければならない**: 内側では
  `cookies()` / `headers()` / `searchParams` / uncached fetch など**動的（リクエスト時）API を呼べない**
  （呼ぶとエラー `Cannot access 'cookies()' in 'use cache'`）。リクエスト依存値は**境界の外で取得して
  引数で渡す**（引数がキャッシュキーの一部になる）。ユーザー/セッション固有データはキャッシュ対象にしない。
- **fetch 単位の制御**: `fetch(url, { cache: 'force-cache' })` で明示キャッシュ、
  `{ next: { revalidate: 3600 } }` で時間ベース再検証、`{ next: { tags: ['posts'] } }` で
  タグ付け（**タグはキャッシュされたレスポンスにのみ効く**ため、キャッシュ有効化と併用する）。
- ミューテーション後は `revalidatePath` / `revalidateTag` で確実に反映する。
- **「なぜこのキャッシュ戦略か」をコメントで残す。** 暗黙のキャッシュはバグの温床。

## ルーティング規約（要点）

- 予約ファイル: `page.tsx` / `layout.tsx` / `loading.tsx`（Suspense 境界）/ `error.tsx`
  （`'use client'` 必須のエラーバウンダリ）/ `not-found.tsx` / `route.ts` / `template.tsx`。
- `global-error.tsx`（`'use client'` 必須）は **root layout 自体のエラー**を捕捉する特殊な境界で、
  自前で `<html><body>` を描画する必要がある（通常の `error.tsx` は layout を置き換えない）。
- グルーピング: `(group)` はURLに出ないグループ、`_folder` は除外、`[slug]` 動的、`[...slug]`
  キャッチオール、`@slot` パラレルルート。
- `layout.tsx` は再レンダリングされない共有シェル。ページ固有の取得はページ側に置く。
- SEO は `metadata` エクスポート / `generateMetadata` を使う（`<head>` を手書きしない）。
  root layout に `metadata.metadataBase` を設定し、`openGraph`/`twitter` の相対URLを解決させる。
  `app/sitemap.ts` / `app/robots.ts` / `app/opengraph-image.(tsx|png)` はファイル規約で自動配信される
  （動的メタデータの完成例は `references/patterns.md`）。

## エラーと耐障害性（失敗の設計）

失敗を「握り潰す」でも「全部 500」でもなく、**種類で扱いを分ける**。

- **予期される失敗**（認証否・認可否・入力不正・ドメイン制約〔在庫切れ・重複・残高不足〕）
  → Server Action は **typed に返す**（`{ error }` / 判別可能な結果型）。UI がその値で分岐して伝える。
  Route Handler は適切な **4xx**（401/403/400/404/409）。これらは正常系の一部であり例外にしない。
- **予期しない失敗**（DB/外部API 障害・想定外の null・バグ）→ **握り潰さず throw させる**。
  最寄りの `error.tsx`（無ければ `global-error.tsx`）が受け、`digest` でサーバーログと相関できる。
  空 `catch` / `any` / `@ts-ignore` で隠すのは禁じ手（`references/debugging.md`）。画面には詳細を出さない。
- **`notFound()` は「無い」に、`redirect()` は「行き先変更」に。** どちらも内部で例外を投げて制御を返すため、
  **`try/catch` の外**で呼ぶ（`references/debugging.md`）。「無い」を 500 にしない。
- **観測性**: サーバー側の未捕捉エラーは `instrumentation.ts` の **`onRequestError`** で一元観測する
  （Sentry/OTel へ送るならここ。`register()` で SDK 初期化）。ログは**構造化**し、**PII・秘密・トークンを
  出さない**（`references/security.md`）。監視SDK を「入れるか」は規模・要件で判断し、新規依存は着手前に確認。
- 外部連携の**冪等性・リトライ・タイムアウト**は `references/cloud-webhooks.md`。完成例
  （`error` / `global-error` / `not-found` / `instrumentation`）は `references/patterns.md` §7。

## proxy (`proxy.ts`) — 旧 middleware

- **Next.js 16 で `middleware.ts` は `proxy.ts` に改名**（エクスポート関数も `proxy`）。
  既存の `middleware.ts` は **Edge ランタイムで引き続き動作する**（非推奨警告が出るだけで、
  ビルド/実行エラーにはならない。黙って停止するわけではない）が、将来削除予定。移行 codemod
  （**検出した PM 経由**で。npm: `npx`、pnpm: `pnpm dlx`、bun: `bunx` — `references/libraries.md`）:
  `npx @next/codemod@canary middleware-to-proxy .`。移行時はファイル名だけでなく
  **エクスポート関数名も `proxy` に**し、認証ライブラリ側の設定も合わせる（下記の注意）。
- ルート単位の**軽い**前処理（認証リダイレクト・i18n・セキュリティヘッダ付与）に使う。
  `export const config = { matcher: [...] }` で対象ルートを絞る（全リクエストに走らせない）。
- **`proxy.ts` は Node.js ランタイムで動く（変更不可）**。旧 `middleware.ts` の Edge ランタイムとは
  異なる。いずれにせよ重い処理・本命の DB 認可を置かず、cookie の有無など軽い判定に留める。
- **認可の主機構にしない。** 本命の認可はデータに近い層（Server Action / Route Handler /
  `lib/data/`）で行う（理由と既知の落とし穴は `references/security.md`）。

## ファイル構成の指針

- ルート直下ではなく `app/` にルーティング、再利用ロジックは `lib/`・UIは `components/` などに分離。
- **1ファイル1責任**を意識し、肥大化した `page.tsx` はコンポーネント/フックに分割。
- データアクセスは `lib/data/` の**データアクセス層 (DAL)** に集約し、UIから DB クライアントを
  直接触らせない（認可の集約・ORM 最適化・DTO 化は `references/data-access.md`）。
