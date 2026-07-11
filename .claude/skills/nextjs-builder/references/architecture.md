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
  const products = await db.product.findMany()
  return <ul>{products.map((p) => <li key={p.id}>{p.name}</li>)}</ul>
}
```

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

## proxy (`proxy.ts`) — 旧 middleware

- **Next.js 16 で `middleware.ts` は `proxy.ts` に改名**（エクスポート関数も `proxy`）。
  `middleware.ts` は Edge 用途向けに残るが**非推奨**（将来削除）。移行 codemod:
  `npx @next/codemod@canary middleware-to-proxy .`。
- ルート単位の**軽い**前処理（認証リダイレクト・i18n・セキュリティヘッダ付与）に使う。
  `export const config = { matcher: [...] }` で対象ルートを絞る（全リクエストに走らせない）。
- **`proxy.ts` は Node.js ランタイムで動く（変更不可）**。旧 `middleware.ts` の Edge ランタイムとは
  異なる。いずれにせよ重い処理・本命の DB 認可を置かず、cookie の有無など軽い判定に留める。
- **認可の主機構にしない。** 本命の認可はデータに近い層（Server Action / Route Handler /
  `lib/data/`）で行う（理由と既知の落とし穴は `references/security.md`）。

## ファイル構成の指針

- ルート直下ではなく `app/` にルーティング、再利用ロジックは `lib/`・UIは `components/` などに分離。
- **1ファイル1責任**を意識し、肥大化した `page.tsx` はコンポーネント/フックに分割。
- データアクセスは `lib/data/` 等に集約し、UIから DB クライアントを直接触らせない（DIP・後述）。
