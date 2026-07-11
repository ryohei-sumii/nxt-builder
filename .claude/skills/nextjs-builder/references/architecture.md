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
  **先頭で認可 → 入力検証（Zod）** を行う（`references/security.md`）。
- `revalidatePath` / `revalidateTag` でキャッシュを更新し、必要なら `redirect()` する。
- 進捗/エラー UI は `useActionState`（React 19 / Next 15）または `useFormStatus` で扱う。

```tsx
// app/actions.ts
'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'

const Schema = z.object({ title: z.string().min(1).max(200) })

export async function createPost(_prev: unknown, formData: FormData) {
  const session = await auth()
  if (!session) return { error: '認証が必要です' }        // 認可

  const parsed = Schema.safeParse({ title: formData.get('title') })
  if (!parsed.success) return { error: '入力が不正です' }  // 検証

  await db.post.create({ data: { ...parsed.data, userId: session.userId } })
  revalidatePath('/posts')
  return { ok: true }
}
```

## Route Handlers (`app/**/route.ts`)

- 外部公開 API・Webhook・非HTML応答に使う。**同じく先頭で認可＆検証。**
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
export const getUser = cache(async (id: string) => db.user.findUnique({ where: { id } }))
```

## キャッシュ / 再検証（明示的に設計する）

- `fetch(url, { next: { revalidate: 3600 } })` … 時間ベース ISR。
- `fetch(url, { next: { tags: ['posts'] } })` + `revalidateTag('posts')` … タグ無効化。
- `fetch(url, { cache: 'no-store' })` … 常に最新（キャッシュしない）。
- ミューテーション後は `revalidatePath` / `revalidateTag` で確実に反映する。
- **「なぜこのキャッシュ戦略か」をコメントで残す。** 暗黙のキャッシュはバグの温床。

## ルーティング規約（要点）

- 予約ファイル: `page.tsx` / `layout.tsx` / `loading.tsx`（Suspense 境界）/ `error.tsx`
  （`'use client'` 必須のエラーバウンダリ）/ `not-found.tsx` / `route.ts` / `template.tsx`。
- グルーピング: `(group)` はURLに出ないグループ、`_folder` は除外、`[slug]` 動的、`[...slug]`
  キャッチオール、`@slot` パラレルルート。
- `layout.tsx` は再レンダリングされない共有シェル。ページ固有の取得はページ側に置く。
- SEO は `metadata` エクスポート / `generateMetadata` を使う（`<head>` を手書きしない）。

## ファイル構成の指針

- ルート直下ではなく `app/` にルーティング、再利用ロジックは `lib/`・UIは `components/` などに分離。
- **1ファイル1責任**を意識し、肥大化した `page.tsx` はコンポーネント/フックに分割。
- データアクセスは `lib/data/` 等に集約し、UIから DB クライアントを直接触らせない（DIP・後述）。
