# テスト（再発防止の土台）

バグ修正の「再発防止」と各種別の「あればテストを走らせる」を支える最小知識。
DIP でデータ層を抽象化してある（`references/readability-solid.md`）ので、モック注入でよく回る。

## 何を、どう testするか

### 1. データ層（`lib/data/*`）— ユニットテスト
`PostRepository` 等の抽象に対し、**モック実装を注入**して呼び出し側をテストする。
DB を立てずに分岐・整形ロジックを検証できる（Vitest / Jest）。

```ts
import { it, expect, vi, afterEach } from 'vitest'

// 注意: vi.mock はファイル先頭へ巻き上げられ「テスト単位」にはならない。
// テストごとに切り替えるなら vi.doMock（巻き上げられない）＋ vi.resetModules を使う。
afterEach(() => {
  vi.resetModules()
  vi.doUnmock('@/lib/auth')
})

it('未ログインなら認証エラーを返す', async () => {
  vi.doMock('@/lib/auth', () => ({ auth: async () => null })) // 以降の動的 import にのみ効く
  const { createPost } = await import('@/app/posts/actions')
  const fd = new FormData(); fd.set('title', 'x'); fd.set('body', 'y')
  expect(await createPost({}, fd)).toEqual({ error: expect.any(String) })
})
```

### 2. Server Action — 純サーバー関数として直接テスト
Server Action は `(prevState, formData) => Promise<State>` の純関数として呼べる。
**認可分岐・検証分岐・戻り値（`{ error }` / `{ ok }`）** を直接アサートする。
`revalidatePath` / `redirect` はモックする。

### 3. Zod スキーマ — 境界値テスト
検証スキーマ（`lib/validation/*`）は単独でテストしやすい。`min`/`max`/`coerce`/必須・任意の
境界と、不正入力が `safeParse().success === false` になることを確認する。

### 4. Route Handler — `Request` を渡して `Response` を検証
`app/**/route.ts` の `GET`/`POST` は `(req: Request) => Response` の関数。`new Request(url, { method, body })`
を渡して呼び、**`res.status` と `await res.json()`** をアサートする。認証・データ層は抽象（DIP）なので
モック注入する。`vi.mock` は先頭へ巻き上げられるため、参照するモック関数は **`vi.hoisted`** で先に確保する。

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { authMock, createMock } = vi.hoisted(() => ({ authMock: vi.fn(), createMock: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: () => authMock() }))
vi.mock('@/lib/data/posts', () => ({ posts: { create: (i: unknown) => createMock(i) } }))
import { POST } from '@/app/api/posts/route'

const req = (b: unknown) =>
  new Request('http://t/api/posts', { method: 'POST', body: JSON.stringify(b) })
beforeEach(() => { authMock.mockReset(); createMock.mockReset() })

it('未ログインは 401（データ層に触れない）', async () => {
  authMock.mockResolvedValue(null)
  expect((await POST(req({ title: 'x', body: 'y' }))).status).toBe(401)
  expect(createMock).not.toHaveBeenCalled()
})
it('妥当なら 201・authorId はセッション由来（クライアント入力に混ざらない）', async () => {
  authMock.mockResolvedValue({ userId: 'u_1', role: 'user' })
  createMock.mockResolvedValue({ id: 'p_1' })
  const res = await POST(req({ title: 'x', body: 'y' }))
  expect(res.status).toBe(201)
  expect(createMock).toHaveBeenCalledWith({ title: 'x', body: 'y', authorId: 'u_1' })
})
```

**必ずテストする境界**: 未認証 401 / 認可否 403 / 不正入力 400 / 見つからない 404、そして
**認可を通らない経路がデータ層に到達しないこと**（`expect(createMock).not.toHaveBeenCalled()`）。

### 5. 外部サービス（fetch / S3 / Stripe 等）はモックして隔離
ユニットテストで実ネットワーク・実 SDK を叩かない（遅い・不安定・課金・秘密が要る）。
- `fetch` は `vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(...))))` で差し替え、
  **こちらが送ったリクエスト**（URL・メソッド・本文・ヘッダ）と**受信の分岐**（4xx/5xx・タイムアウト）を検証する。
- SDK（S3/Stripe 等）は**その SDK モジュールを `vi.mock`** し、呼び出し引数と戻り値の扱いをアサートする。
  Webhook は「実署名を偽造」せず、**署名検証関数をモック**して分岐（有効/無効/リプレイ）を突く
  （署名検証自体の正しさは公式 verifier に委ねる。`references/cloud-webhooks.md`）。
- 実疎通は E2E か契約テストへ分離し、ユニットの外に置く。

### 6. 非同期 Server Component / ページ全体 — E2E
非同期 Server Component の単体テストは現状 experimental で不安定。
**ページ挙動は Playwright 等の E2E** で担保する（レンダリング結果・遷移・フォーム送信・
ストリーミング表示）。ブラウザの導入有無を確認し、無ければ**検出した PM のローカル bin 実行**で
`playwright install chromium`（CI では `--with-deps` 付き）を実行してから走らせる
（npm: `npx playwright ...` / pnpm: `pnpm exec playwright ...` / bun: `bunx playwright ...`。
PM 判定は `references/libraries.md` の対応表）。

## 方針（何を・どこまで）
- **層で使い分ける。** ロジック（純関数・検証・データ層）と信頼境界（Server Action / Route Handler）は
  ユニット、UI 挙動・遷移・ストリーミングは E2E。非同期 Server Component の単体は E2E に寄せる。
- **優先順位（薄く広くより、重要な境界を厚く）。** ①認証・認可・所有チェック ②入力検証の合否分岐
  ③金銭・破壊的操作・冪等性 ④バグ修正の回帰、を最優先で固める。ゲッターや自明な受け渡しは追わない。
- **バグ修正はまず失敗する回帰テストを書き**、修正で緑にする（再発を機械的に防ぐ）。
- **境界値と異常系を厚く。** 正常系1本で満足せず、空/最大長/型不一致/未認証/権限外/404/重複を突く。
- **テスト基盤が無い時。** 勝手に大量導入しない。既存の PM（`references/libraries.md`）で **Vitest 最小構成**
  （ロジック/境界のユニット）を提案し、UI が要れば Playwright を足す。**重い基盤は着手前に確認**する。
- **決定性を守る。** 時刻・乱数・ネットワーク・時計依存は固定/モックし、flaky を作らない
  （`vi.useFakeTimers` / 固定シード / 上記 fetch モック）。
