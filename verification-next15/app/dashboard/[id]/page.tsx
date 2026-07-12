import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getUser } from '@/lib/data'

// ★版差の要: Next 15 では params / searchParams / cookies() / headers() は Promise（await 必須）。
//   これは Next 15 で導入され Next 16 に引き継がれた。14 以前は同期アクセスだった点が版差。
// security.md: 読み取り経路でも認証＋所有チェック（IDOR 回避）。middleware の一次ガードに依存しない。
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const cookieStore = await cookies() // Next 15: await 必須
  const theme = cookieStore.get('theme')?.value ?? 'light'

  const session = await auth()
  if (!session) redirect('/login') // 認証
  if (session.userId !== id) notFound() // 認可（他人の資源を覗かせない）

  const user = await getUser(id)
  if (!user) notFound()
  return (
    <main data-theme={theme}>
      <h1>{user.name} さんのダッシュボード</h1>
    </main>
  )
}
