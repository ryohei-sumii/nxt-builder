# 頻出パターン（完成コード例）

いずれも App Router + TypeScript。5軸（可読性/ドメイン/性能/セキュリティ/SOLID）を満たす雛形。
コピー元ではなく**設計の手本**として使い、対象リポジトリの規約に合わせて調整すること。

---

## 1. フォーム + Server Action（検証・認可・進捗・エラー）

```ts
// lib/validation/post.ts — 検証スキーマ（1箇所に定義して再利用）
import { z } from 'zod'
export const CreatePostSchema = z.object({
  title: z.string().min(1, 'タイトルは必須です').max(200),
  body: z.string().min(1).max(10_000),
})
export type CreatePostInput = z.infer<typeof CreatePostSchema>
```

```ts
// app/posts/actions.ts
'use server'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { posts } from '@/lib/data/posts'          // 抽象（DIP）
import { CreatePostSchema } from '@/lib/validation/post'

export type FormState = { error?: string; ok?: boolean }

export async function createPost(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await auth()
  if (!session) return { error: 'ログインが必要です' }               // 認可

  const parsed = CreatePostSchema.safeParse({
    title: formData.get('title'),
    body: formData.get('body'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message } // 検証

  await posts.create({ ...parsed.data, authorId: session.userId })
  revalidatePath('/posts')
  return { ok: true }
}
```

```tsx
// app/posts/new-post-form.tsx  (Client Component — インタラクティブな葉のみ)
'use client'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { createPost, type FormState } from './actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return <button type="submit" disabled={pending}>{pending ? '送信中…' : '投稿'}</button>
}

export function NewPostForm() {
  const [state, action] = useActionState<FormState, FormData>(createPost, {})
  return (
    <form action={action}>
      <input name="title" aria-label="タイトル" required />
      <textarea name="body" aria-label="本文" required />
      {state.error && <p role="alert">{state.error}</p>}
      {state.ok && <p role="status">投稿しました</p>}
      <SubmitButton />
    </form>
  )
}
```

---

## 2. 並列データ取得ページ（ウォーターフォール回避 + Suspense）

```tsx
// app/dashboard/page.tsx  (Server Component)
import { Suspense } from 'react'
import { getUser } from '@/lib/data/users'      // React.cache でラップ済み
import { RecentOrders } from './recent-orders'

export default async function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getUser(id)                 // 速い取得は待つ
  return (
    <main>
      <h1>{user.name} さんのダッシュボード</h1>
      {/* 遅い領域は分離してストリーミング（全体をブロックしない） */}
      <Suspense fallback={<p>注文を読み込み中…</p>}>
        <RecentOrders userId={id} />
      </Suspense>
    </main>
  )
}
```

```tsx
// app/dashboard/recent-orders.tsx  (Server Component)
import { getOrders, getRecommendations } from '@/lib/data/orders'

export async function RecentOrders({ userId }: { userId: string }) {
  // 独立取得は並列化
  const [orders, recs] = await Promise.all([getOrders(userId), getRecommendations(userId)])
  return (
    <section>
      <ul>{orders.map((o) => <li key={o.id}>{o.title}</li>)}</ul>
      <aside>{recs.map((r) => <span key={r.id}>{r.title}</span>)}</aside>
    </section>
  )
}
```

```ts
// lib/data/users.ts — リクエスト内重複排除（React.cache）+ 抽象境界
import { cache } from 'react'
import 'server-only'                              // クライアント誤importを防ぐ
import { db } from '@/lib/db'

export const getUser = cache(async (id: string) => {
  const user = await db.user.findUnique({ where: { id }, select: { id: true, name: true } })
  if (!user) throw new Error('not found')
  return user
})
```

---

## 3. 認可付き Route Handler（外部API / 検証 / 適切な応答）

```ts
// app/api/posts/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { posts } from '@/lib/data/posts'

const CreateSchema = z.object({ title: z.string().min(1).max(200), body: z.string().min(1) })

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const parsed = CreateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 })

  const created = await posts.create({ ...parsed.data, authorId: session.userId })
  return NextResponse.json(created, { status: 201 })
}
```

---

## 4. Server → Client の "donut"（サーバー描画をクライアント殻に差し込む）

```tsx
// app/page.tsx  (Server Component)
import { Collapsible } from '@/components/collapsible'   // 'use client'
import { getArticle } from '@/lib/data/articles'

export default async function Page() {
  const article = await getArticle()
  return (
    <Collapsible title={article.title}>
      {/* children はサーバーで描画され、クライアント JS に乗らない */}
      <article dangerouslySetInnerHTML={undefined /* 例: 生HTMLは避け、構造化して描画 */} />
      <p>{article.body}</p>
    </Collapsible>
  )
}
```

```tsx
// components/collapsible.tsx  (Client Component — 状態だけを担当。SRP)
'use client'
import { useState, type ReactNode } from 'react'

export function Collapsible({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <section>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open}>{title}</button>
      {open && children}
    </section>
  )
}
```

---

## 5. 環境変数の検証（起動時に欠落検知）

```ts
// lib/env.ts
import 'server-only'
import { z } from 'zod'

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  // クライアントに出すものだけ NEXT_PUBLIC_ を付ける
  NEXT_PUBLIC_APP_URL: z.string().url(),
})

export const env = EnvSchema.parse(process.env)   // 不足なら起動時に例外
```
