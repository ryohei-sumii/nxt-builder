'use client'

// patterns.md §7: root layout 自体の失敗を捕捉する特殊境界。自前で <html><body> を描画する。
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="ja">
      <body>
        <div role="alert">
          <p>問題が発生しました。</p>
          <button onClick={() => reset()}>再試行</button>
        </div>
      </body>
    </html>
  )
}
