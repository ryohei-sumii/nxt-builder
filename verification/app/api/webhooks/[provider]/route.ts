import { after, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { serverEnv } from '@/lib/env.server'

// cloud-webhooks.md: 汎用 HMAC の骨子。実プロバイダは公式 verifier に合わせる（Stripe は
// stripe.webhooks.constructEvent + stripe-signature ヘッダ）。
export const runtime = 'nodejs' // node:crypto を使うため
export const dynamic = 'force-dynamic' // キャッシュしない
export const maxDuration = 15

function verify(raw: string, sig: string | null, secret: string): boolean {
  if (!sig) return false
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(sig)
  return a.length === b.length && crypto.timingSafeEqual(a, b) // 定数時間比較
}

export async function POST(req: Request) {
  const raw = await req.text() // 生ボディ（パース前）で検証
  if (!verify(raw, req.headers.get('x-signature'), serverEnv.PROVIDER_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }
  const event = JSON.parse(raw) as { id: string; type: string }
  after(async () => {
    // 冪等性: event.id を保存して二重処理を防ぐ。ここで重い実処理
    void event.id
  })
  return NextResponse.json({ received: true }) // すぐ ACK
}
