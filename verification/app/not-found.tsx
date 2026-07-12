import Link from 'next/link'

// patterns.md §7: notFound() の描画先。404 応答になる（Server Component でよい）。
export default function NotFound() {
  return (
    <main>
      <h1>ページが見つかりません</h1>
      <Link href="/">ホームへ戻る</Link>
    </main>
  )
}
