import 'server-only'

// スタブ: 実際は @upstash/ratelimit + Redis（サーバーレスは invocation 独立のため分散ストア必須。
// インメモリ計数は機能しない）。cloud-webhooks.md / stack-selection.md 参照。
// 検証ハーネスでは「発行はレート制限する」という経路と型だけを固定する（挙動は常に許可）。
export const apiKeyCreateLimiter = {
  // 実装は slidingWindow(5, '1 h') 等。ここでは型だけ再現。
  limit: async (_key: string): Promise<{ success: boolean }> => ({ success: true }),
}
