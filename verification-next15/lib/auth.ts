import 'server-only'

// スタブ: 実際は Auth.js(NextAuth) / Clerk 等。検証ハーネスでは固定セッションを返す。
export type Session = { userId: string; role: 'user' | 'admin' }

export async function auth(): Promise<Session | null> {
  return { userId: 'u_1', role: 'user' }
}
