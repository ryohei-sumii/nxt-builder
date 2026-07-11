# Webhook / クラウド連携（GCP・AWS 等）の最適化

外部プロバイダの Webhook 受信・送信と、クラウド（AWS / GCP / Vercel 等）利用を
5軸（特にセキュリティ・パフォーマンス・ドメイン適合）で最適化する。

## Webhook 受信（Route Handler）

Webhook は **Route Handler (`app/**/route.ts`)** で受ける。以下は必須級の作法。

- **生ボディで署名検証する。** HMAC は**パース前の raw 文字列**に対して計算される。App Router では
  `const raw = await req.text()` で生ボディを取り、検証を通してから `JSON.parse(raw)` する。
  先に `req.json()` すると署名検証に必要な原文が失われる。
- **定数時間比較。** 署名比較は `crypto.timingSafeEqual` を使う（`===` はタイミング攻撃に弱い）。
  署名検証に `node:crypto` を使うなら **`export const runtime = 'nodejs'`**（Edge では Web Crypto
  `subtle` を使う）。
- **キャッシュしない。** `export const dynamic = 'force-dynamic'`。Webhook は毎回処理する。
- **速く ACK し、重い処理は応答後へ。** プロバイダはタイムアウトすると**リトライを連打**する。
  検証後すぐ 200 を返し、実処理は `after()`（`next/server`）やキューに回す。
- **冪等性。** 同じイベントが複数回届く前提で、`event.id` を保存して二重処理を防ぐ。
- **リプレイ防止。** タイムスタンプ付き署名なら、許容窓（例: 5分）外の古いリクエストを拒否する。
- **認可は署名がすべて。** Webhook にセッションは無い。**正しい署名の検証が唯一の認可**。
  ペイロードの値（ユーザーID 等）を無検証で信頼しない。

```ts
// app/api/webhooks/[provider]/route.ts — 汎用 HMAC の骨子（実プロバイダは公式方式に合わせる。下記注記）
import { after, NextResponse } from 'next/server'
import crypto from 'node:crypto'

export const runtime = 'nodejs'          // node:crypto を使うため
export const dynamic = 'force-dynamic'   // キャッシュしない
export const maxDuration = 15            // 上限を明示（プラットフォーム依存）

function verify(raw: string, sig: string | null, secret: string): boolean {
  if (!sig) return false
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex')
  const a = Buffer.from(expected), b = Buffer.from(sig)
  return a.length === b.length && crypto.timingSafeEqual(a, b)   // 定数時間比較
}

export async function POST(req: Request) {
  const raw = await req.text()                          // 生ボディ（パース前）で検証
  if (!verify(raw, req.headers.get('x-signature'), process.env.PROVIDER_WEBHOOK_SECRET!)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }
  const event = JSON.parse(raw) as { id: string; type: string }
  after(async () => {
    // 冪等性: event.id を保存して二重処理を防ぐ。ここで重い実処理
  })
  return NextResponse.json({ received: true })          // すぐ ACK
}
```

> **プロバイダ公式の verifier があればそれを使う。** 署名スキームはプロバイダ毎に異なる（ヘッダ名・
> 署名対象・エンコード）。例えば **Stripe** は `stripe-signature` ヘッダ＋`t=…,v1=…` 形式で、
> `${timestamp}.${raw}` を署名対象にし、`stripe.webhooks.constructEvent(raw, sig, secret)` で検証する
> （上の汎用 HMAC 骨子をそのまま Stripe に流用すると必ず検証失敗する）。タイムスタンプ署名（Stripe 含む）
> では上記の許容窓によるリプレイ防止も適用する。

> **`after()` の注意**: 応答後の処理は**同じ関数実行の寿命内**で走る。サーバーレスでは実行時間上限に
> 縛られ、確実な完了保証はない。重い/失敗リトライが要る処理は **キュー**（SQS / Pub/Sub /
> Cloud Tasks）に投げ、別ワーカーで処理する方が堅い。

## Webhook 送信（outbound）

- **指数バックオフでリトライ**し、送信先のタイムアウトを設定する（無限待ちを避ける）。
- **冪等性キー**（`Idempotency-Key` ヘッダ等）を付け、受信側の二重処理を防ぐ。
- 送信自体はリクエスト経路でなく**キュー/バックグラウンド**に載せ、ユーザー応答をブロックしない。
- 署名（HMAC）を付けて受信側が検証できるようにする。

## クラウド利用（AWS / GCP 等）の最適化

### シークレット管理
- 本番の秘密は **Secrets Manager / SSM Parameter Store（AWS）・Secret Manager（GCP）** に置き、
  実行環境の環境変数へ注入する。リポジトリや `NEXT_PUBLIC_` に秘密を置かない。
- 秘密を読むモジュールは `import 'server-only'`。起動時に Zod で env を検証（`references/patterns.md`）。

### オブジェクトストレージ（S3 / GCS）— サーバーを経由させない
- 大きいファイルの入出力は **presigned URL** でクライアント↔ストレージを直結する。
  サーバー（Route Handler / Server Action）を経由させると、メモリ・帯域・実行時間上限を食い潰す。
- **アップロード**: Server Action で認証・認可し、`presigned PUT URL` を発行してクライアントが直送。
- **ダウンロード**: 非公開ファイルは `presigned GET URL`（短命）を発行。バケットは非公開のまま。

```ts
// app/upload-actions.ts — 認証してから presigned URL を返す（本体はクライアントが直アップロード）
'use server'
import { z } from 'zod'
import { verifySession } from '@/lib/dal'
import { createPresignedPutUrl } from '@/lib/storage'  // 実体は @aws-sdk/s3-request-presigner 等

// contentType は allowlist(enum)で強制。クライアント申告の任意文字列を無検証で署名に載せない
const Input = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(['image/png', 'image/jpeg', 'application/pdf']),
})

export async function getUploadUrl(input: unknown) {
  const { userId } = await verifySession()                       // 認証・認可
  const parsed = Input.safeParse(input)
  if (!parsed.success) return { error: 'invalid' as const }
  // 署名した contentType は PUT 時に一致必須＝型を強制できる。key は UUID 前置で衝突/上書き防止
  const key = `users/${userId}/${crypto.randomUUID()}-${parsed.data.filename}`
  return { url: await createPresignedPutUrl(key, parsed.data.contentType), key }
}
```

> **presigned はサーバーを経由させない分、発行時の事前条件が唯一のガードになる。** 最低限
> **contentType は allowlist で強制**する（署名した ContentType は PUT で一致必須）。**サイズ上限**は
> presigned PUT では range 強制ができないため、ブラウザ直アップロードは `content-length-range` を持つ
> **presigned POST** を使うか、**完了後に HEAD でサイズ/実 Content-Type を検証**してから利用可能化する。
> `filename` は UUID 前置で衝突は防げるが、必要なら拡張子・文字種を軽くサニタイズする。
> （範囲強制の可否など SDK 依存挙動は `@aws-sdk/s3-request-presigner` の公式で裏取りする。）

### 非同期処理 / キュー
- 重い/失敗リトライ前提の処理（メール送信・画像変換・外部同期・Webhook 実処理）は
  **SQS / Pub/Sub / Cloud Tasks** にオフロードし、別ワーカー（Lambda / Cloud Run / Cloud Functions）で
  実行する。リクエスト経路で長時間処理を抱えない。

### サーバーレスの制約を設計に織り込む
- **DB 接続**: 関数の同時実行で接続が爆発する。接続プーラ（RDS Proxy / PgBouncer / Prisma Accelerate /
  Neon）を前提にし、クライアントはシングルトン（`references/data-access.md`）。
- **コールドスタート / 実行時間・ペイロード上限**: `maxDuration` を明示。大きな入出力は presigned で回避。
- **ランタイム選択**: グローバル低遅延・軽処理は **Edge**（Web API のみ、`node:*` 不可）。
  Node 専用ライブラリ・重い処理・`node:crypto` は **Node ランタイム**（`export const runtime`）。
- **IAM 最小権限**: 関数/サービスアカウントに必要最小の権限だけ付与する。
- **observability**: 構造化ログ（PII/秘密を出さない）・トレース・アラートを入れる。

## アンチパターン
- Webhook で `req.json()` を先に呼び、生ボディを失って署名検証できない。
- 署名比較を `===` で行う（タイミング攻撃）。/ 署名検証せずペイロードを信頼する。
- 検証前・処理完了前に重い同期処理を挟み、プロバイダのタイムアウト→リトライ嵐を招く。
- 大きいファイルを Route Handler/Server Action で受けてメモリ・帯域・実行時間を食い潰す
  （presigned URL を使う）。
- 秘密をコードや `NEXT_PUBLIC_` に埋め込む。/ サーバーレスで DB 接続をプーリングせず枯渇させる。

## チェック
- [ ] Webhook は生ボディ＋定数時間比較で署名検証し、`dynamic='force-dynamic'` にしたか？
- [ ] 速く ACK し、重い処理は `after()`／キューに逃がし、冪等性を確保したか？
- [ ] 大きいファイルは presigned URL で直接入出力し、サーバーを経由させていないか？
- [ ] 秘密はシークレットマネージャ＋`server-only`＋env 検証で扱っているか？
- [ ] ランタイム（Edge/Node）を要件に合わせて選び、DB 接続をプーリングしたか？
