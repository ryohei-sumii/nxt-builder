'use client'

// patterns.md §7: 本番はエラー詳細を画面に出さない。reset() で再試行のみ提供する。
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert">
      <p>問題が発生しました。</p>
      <button onClick={reset}>再試行</button>
    </div>
  )
}
