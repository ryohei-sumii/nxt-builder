// patterns.md §7 / architecture.md「エラーと耐障害性」: 起動時初期化 + 未捕捉エラーの一元観測（Next 16 で安定）。
import type { Instrumentation } from 'next'

export function register() {
  // 監視SDK（OTel / Sentry 等）の初期化はここ。導入是非は規模・要件で判断（新規依存は着手前に確認）。
}

// 予期しないサーバーエラーを集約観測。ログは構造化し PII/秘密/トークンを載せない（lib のログ方針と揃える）。
export const onRequestError: Instrumentation.onRequestError = (err, request, context) => {
  console.error(
    JSON.stringify({
      msg: 'request_error',
      path: request.path,
      method: request.method,
      routeType: context.routeType, // 'render' | 'route' | 'action' | 'proxy'
      error: err instanceof Error ? err.message : 'unknown',
    }),
  )
}
