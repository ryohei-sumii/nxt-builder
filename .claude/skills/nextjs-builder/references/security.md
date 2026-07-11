# セキュリティ（妥協しない）

Next.js の攻撃面は主に **信頼境界**（Server Action / Route Handler / proxy〔旧 middleware〕）に集中する。
「クライアントで見せない＝守った」ではない。**サーバー側で防御する。**

## 1. 入力検証 — 全境界で Zod（型注釈は検証ではない）

- サーバーに入る**すべての外部入力**（`formData`・JSON ボディ・クエリ・`params`・ヘッダ・cookie）を
  スキーマ検証する。TypeScript の型は実行時に消えるので防御にならない。
- `safeParse` で失敗を握り、生の入力を DB / 外部API に流さない。

```ts
import { z } from 'zod'
// Zod 4 では書式は top-level が推奨: z.email() / z.url()（旧 z.string().email() 等も動作）
const Body = z.object({ email: z.email(), age: z.coerce.number().int().min(0).max(150) })

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json())
  if (!parsed.success) return Response.json({ error: 'invalid' }, { status: 400 })
  // parsed.data のみを使う
}
```

## 2. 認証・認可 — 各エントリの先頭で

- **Server Action / Route Handler の1行目で**セッション取得→認可判定を行う。
- **読み取り経路も同じ。** 非公開資源を返す **Server Component / `lib/data` のデータ取得**でも、
  先頭で認証＋所有/可視性チェックを行う。他人の `id` を URL に渡して覗ける **IDOR**（読み取りの
  アクセス制御欠落）は典型脆弱性。URL が見えない・UIで出さないことは防御ではない。
- リソース単位の所有チェックを忘れない（「ログイン済み」だけでなく「この行の持ち主か」）。

```ts
'use server'
export async function deletePost(id: string) {
  const session = await auth()
  if (!session) throw new Error('unauthorized')                      // 認証
  const post = await db.post.findUnique({ where: { id } })
  if (post?.userId !== session.userId) throw new Error('forbidden')  // 認可（所有）
  await db.post.delete({ where: { id } })
}
// ※ この deletePost(id) を form から起動する場合、action={deletePost} に直接渡すと第1引数が
//   FormData になる。action={deletePost.bind(null, post.id)} で id を束縛するか、hidden input +
//   formData 読み取り + Zod 検証を使う（references/patterns.md セクション1）。
```

- `proxy.ts`（Next 16 で `middleware.ts` から改名。Node ランタイム）はルート単位の粗いガードには
  使えるが、**認可の主機構にしない**（Server Action/Route Handler/`lib/data` 側でも再チェック）。
  過去に middleware を丸ごとスキップさせるバイパス（**CVE-2025-29927**, `x-middleware-subrequest`
  ヘッダ）があり、公式も認可判定は**データに近い層**で行うことを推奨している。proxy/middleware は
  「未ログインを弾く軽い一次ガード」に留め、本命の所有チェックはデータアクセス時に行う。
  （Next 16 移行時、`middleware.ts` → `proxy.ts` の改名はファイル名だけでなく**エクスポート関数名も
  `proxy` に**し、認証ライブラリの設定も合わせる。中途半端な移行で認証ガードが動かなくなる事故に注意。
  なお旧 `middleware.ts` を残しても動作自体は継続する〔非推奨警告のみ〕。）

## 3. 秘密情報 / 環境変数

- クライアントに露出してよいのは **`NEXT_PUBLIC_` 接頭辞のみ**。それ以外は自動的にサーバー限定。
- API キー・DB URL・署名鍵を Client Component から参照しない。
- 秘密を含むモジュールの先頭に **`import 'server-only'`** を付け、誤ってクライアントに import したら
  ビルドで落ちるようにする。逆にクライアント専用モジュールは `import 'client-only'`。
- 環境変数はスキーマ検証して起動時に欠落を検知する。`NEXT_PUBLIC_` 公開値はビルド時にインライン化
  されるため個別に列挙して parse し、秘密とは別モジュールに分ける（`references/patterns.md` セクション5）。
- **`server-only` は「モジュール」の混入を防ぐが「データ」の混入は防がない**（次項）。

## 3.5 クライアント境界を越えるデータの最小化（Next.js 固有の重大リスク）

- **Client Component / RSC ペイロードに渡した props はブラウザへシリアライズ送信される。**
  DB レコードやセッションを丸ごと渡すと、`passwordHash`・トークン・内部フラグ等が
  ネットワークに露出する（画面に出していなくても漏れる）。
- 対策: **表示に必要なフィールドだけ**を渡す。DB オブジェクトを丸ごと渡さず、クエリで `select`
  して DTO 化する（`references/patterns.md` の `getUser` は `select` で id/name のみ取得）。
- **taint API**（React 19.2 / Next 16）で誤流出をビルド/実行時に検出できる:
  `experimental_taintObjectReference(理由, obj)` / `experimental_taintUniqueValue(理由, lifetime, 値)`。
  機密を含むオブジェクトに掛けておくと、誤ってクライアントへ渡した時点で落ちる。
  **利用には `next.config` の `experimental: { taint: true }` を有効化する必要がある**
  （未設定だと関数自体が使えない）。

## 4. XSS / 出力エンコーディング

- React は既定でエスケープする。**`dangerouslySetInnerHTML` は原則禁止。**
  どうしても必要なら DOMPurify 等でサニタイズしてから。
  ただし DOMPurify は DOM 前提のため、**サーバー（RSC）側では `isomorphic-dompurify` 等**
  DOM 環境を伴う実装が必要（素の DOMPurify をサーバーで呼ぶと例外/no-op になりうる）。
- Markdown/HTML をレンダリングするなら許可タグを絞ったサニタイザを通す。
- `<a href={userValue}>` や `<script>`・`<iframe src>` にユーザー値を素通しにしない。

## 5. リダイレクト / SSRF / インジェクション

- **オープンリダイレクト**: `redirect(userInput)` を避け、許可リスト or 相対パス限定にする。
- **SSRF**: サーバーからユーザー指定 URL を fetch する場合、ホスト許可リスト・内部IP拒否を行う。
  `next/image` の `images.remotePatterns` もホスト・パスを絞る（`hostname: '**'` 等の全許可は
  画像最適化エンドポイントを SSRF/DoS の踏み台にしうる）。
- **SQL/コマンドインジェクション**: パラメータ化クエリ / ORM を使い、文字列連結でクエリやシェルを
  組み立てない。ユーザー入力から動的 `import()` / `eval` / `child_process` を実行しない。
- **パストラバーサル**: ユーザー入力でファイルパスを組む場合は正規化＋ベースディレクトリ検証。

## 6. CSRF / セッション / ヘッダ

- Server Actions は Next.js が Origin/Host 突き合わせによる CSRF 保護を持つが、独自 Route Handler で
  状態変更する場合は Origin/CSRF トークンを自前で確認する。
- **Webhook 受信**はセッションが無く、**署名検証が唯一の認可**。生ボディで HMAC を定数時間比較し、
  ペイロードの値を無検証で信頼しない（詳細は `references/cloud-webhooks.md`）。
- **プロキシ/LB/カスタムドメイン配下**では許可オリジンを明示する（Origin/Host ベース判定のため、
  未設定だと正規リクエストが弾かれたり、転送ヘッダ改変で判定が崩れうる）。Server Actions 自体は
  安定版だが、この設定キーは **`experimental.serverActions` 配下**にある点に注意
  （トップレベルに `serverActions` を置くと無視され、保護が無効のままになる）:

```js
// next.config.js
module.exports = {
  experimental: { serverActions: { allowedOrigins: ['my-proxy.com', '*.my-proxy.com'] } },
}
```
- Cookie は `httpOnly` / `secure` / `sameSite` を適切に設定。トークンを `localStorage` に置かない。
- `next.config` の `headers()` で `X-Content-Type-Options: nosniff`・`Strict-Transport-Security`・
  `Referrer-Policy` 等のセキュリティヘッダを設定する。
- **CSP は静的 `headers()` だけでは不十分**になりやすい。Next.js はインラインスクリプト/RSC を
  出すため、実効的な `script-src` には **proxy（旧 middleware）でリクエスト毎に nonce を発行**し、
  nonce ベース + `'strict-dynamic'` にする（`'unsafe-inline'` に頼ると XSS 防御が骨抜きになる）。

## 7. その他

- レート制限（ログイン・投稿・メール送信等の悪用されやすいエンドポイント）。
- エラーメッセージでスタックトレースや内部情報を漏らさない（本番では汎用メッセージ）。
- 依存の既知脆弱性に注意（`npm audit` 等の存在を認識）。
- ログに PII・秘密・トークンを出力しない。

## セキュリティ・チェック（提出前に自問）
- [ ] すべての境界入力を Zod 検証したか？
- [ ] Server Action / Route Handler の先頭で認可したか？所有チェックはあるか？
- [ ] 秘密がクライアントに漏れていないか（`NEXT_PUBLIC_` 誤用・`server-only` 未付与）？
- [ ] `dangerouslySetInnerHTML` / 文字列連結SQL / オープンリダイレクトを避けたか？
