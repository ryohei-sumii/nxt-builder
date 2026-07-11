# データアクセス層 (DAL) — 認可と ORM 最適化の集約

**データ取得・認可・DB クエリを `lib/data`（`server-only`）に集約する。** Next.js 公式が推奨する
セキュリティアーキテクチャで、5軸の交点（ドメイン適合・セキュリティ・パフォーマンス・SOLID）に効く。
Server Component / Server Action / Route Handler は **DAL を呼ぶだけ**にし、DB を直接触らせない。

## なぜ DAL か

- **セキュリティの一点集約。** 認証・所有チェックを DAL 内に閉じ込めると、認可漏れ（IDOR）を
  各画面で作り込む余地が減る（`references/security.md` の読み取り経路認可と一致）。
- **DIP / 差し替え可能。** UI は具体的な ORM ではなく DAL の関数・型に依存する。ORM 変更やテスト
  モック注入が UI に波及しない（`references/readability-solid.md`）。
- **パフォーマンスの制御点。** `select`・`join`・ページネーション・キャッシュを DAL に集めて最適化できる。

## セッション検証を集約し、`React.cache` で重複排除

セッション取得は毎回書かず、DAL の入口 `verifySession` に集約する。`React.cache` で
**同一リクエスト内は1回**に抑える。

```ts
import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export const verifySession = cache(async () => {
  const session = await auth()
  if (!session) redirect('/login')     // 未認証は集約地点で弾く
  return { userId: session.userId }
})
```

## 認可（認証＋所有/ロール）を DAL 内に閉じ込める

「ログイン済みか（認証）」と「その資源の持ち主か（所有）」「その操作権限があるか（ロール）」を
DAL の関数内で判定し、権限のないデータは**そもそも返さない**。呼び出し側は認可を意識しなくてよい。

```ts
export const getPostForCurrentUser = cache(async (id: string) => {
  const { userId } = await verifySession()
  const post = await db.post.findUnique({
    where: { id },
    select: { id: true, title: true, authorId: true },
  })
  if (!post || post.authorId !== userId) return null   // 他人の資源は返さない（IDOR 回避）
  return post
})
```

ロールベースなら `verifySession` の戻りに `role` を含め、`if (session.role !== 'admin') ...` を
DAL 側で判定する。UI の出し分けは補助であって防御ではない。

## ORM クエリの最適化

- **必要な列だけ `select`。** `SELECT *` 相当を避ける。機密列（`passwordHash` 等）を取得・返却しない
  （`references/security.md` のデータ露出最小化と一致）。
- **N+1 を避ける。** 一覧＋関連は ORM の `include`/`join`（Prisma `include`, Drizzle `with`/join）で
  1〜数クエリに畳む。ループ内で1件ずつ取得しない。
- **ページネーション。** 一覧は `take`/`limit` で件数を絞り、深いオフセットより**カーソル方式**
  （`where id < cursor` + `take`）を優先する。
- **集計・複数書き込みはトランザクション。** 不変条件をまたぐ複数更新は ORM のトランザクションで
  原子化する。
- **サーバーレスの接続管理。** DB クライアントは**シングルトン**にして接続爆発を防ぐ
  （開発時の HMR 対策に `globalThis` へキャッシュ）。サーバーレス/エッジでは接続プーラ
  （PgBouncer / Prisma Accelerate / Neon 等）の利用を前提に設計する。

```ts
// lib/db.ts — 開発時の多重生成を防ぐシングルトン（Prisma 例。Drizzle も同様の発想）
import { PrismaClient } from '@prisma/client'
const g = globalThis as unknown as { prisma?: PrismaClient }
export const db = g.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') g.prisma = db
```

## DTO — クライアントへ返す形を絞る

DAL の戻り値は**表示に必要なフィールドだけの DTO** にする。DB レコードを丸ごと返すと、
Client Component / RSC ペイロード経由でブラウザに露出しうる（`references/security.md` §3.5）。
`select` した結果の型がそのまま DTO になるよう設計すると、露出面が自然に最小化される。

## 呼び出し側（薄く保つ）

```tsx
// Server Component は DAL を呼ぶだけ。認可・クエリ最適化・DTO 化は DAL 側で完結
export default async function MyPostsPage() {
  const posts = await getMyPosts()   // 認証・所有・select・ページングは DAL 内で済んでいる
  return <ul>{posts.map((p) => <li key={p.id}>{p.title}</li>)}</ul>
}
```

## チェック
- [ ] DB クライアントを UI/アクションから直接触らず、`lib/data` の DAL 越しに使っているか？
- [ ] 認証・所有/ロールチェックを DAL 内で行い、権限外データを返していないか？
- [ ] `select` で必要列のみ取得し、機密列・不要データを載せていないか？
- [ ] 一覧は N+1 回避＋ページネーションしているか？ DB クライアントはシングルトンか？
