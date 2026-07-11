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

### 4. 非同期 Server Component / ページ全体 — E2E
非同期 Server Component の単体テストは現状 experimental で不安定。
**ページ挙動は Playwright 等の E2E** で担保する（レンダリング結果・遷移・フォーム送信・
ストリーミング表示）。ブラウザの導入有無を確認し、無ければ `npx playwright install chromium`
（CI では `--with-deps` 付き）を実行してから走らせる。

## 方針
- バグ修正時は**まず失敗する回帰テストを書き**、修正で緑にする（再発を機械的に防ぐ）。
- ロジック（純関数・検証・データ層）はユニット、UI 挙動は E2E、と層で使い分ける。
- 既存プロジェクトのテスト基盤（Vitest/Jest/Playwright/Testing Library）を尊重し、
  無ければ最小構成を提案する（勝手に大量導入しない）。
