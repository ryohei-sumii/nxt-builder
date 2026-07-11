# バグ修正 / デバッグ（Next.js 診断カタログ）

対症療法で終わらせない。**再現 → 根本原因 → 最小修正 → 検証 → 再発防止**の順で直す。

## デバッグ・プロトコル

1. **再現する。** どの条件（ルート・入力・サーバー/クライアント・環境）で起きるか特定する。
   再現できないバグは「直った」も確認できない。
2. **根本原因を特定する。** エラーメッセージ・スタック・該当コードを読む。症状の出た場所と
   原因の場所は往々にして異なる。「なぜこの値/状態になったか」を1つ手前まで遡る。
3. **最小スコープで修正する。** 原因に直接効く最小の変更に留める。「ついでのリファクタ」を混ぜない
   （混ぜると原因切り分けが壊れ、回帰リスクが上がる）。
4. **検証する。** 再現手順をもう一度なぞって直ったことを確認。型/リンタ/ビルド、あればテストを走らせる。
5. **再発を防ぐ。** 可能なら回帰テストで固定する。同種のバグが他にもないか近傍を確認する。

## Next.js 頻出バグ 診断カタログ

### Hydration mismatch（"Text content did not match" / "Hydration failed"）
- **原因**: サーバー描画とクライアント初回描画で出力が異なる。典型例:
  - `Date.now()` / `Math.random()` / `new Date().toLocaleString()` を描画に使用
  - `typeof window !== 'undefined'` や `localStorage` を初回レンダリングで参照
  - 不正な HTML ネスト（`<p>` の中に `<div>`、`<a>` の中に `<a>` 等）
  - ブラウザ拡張や外部スクリプトによる DOM 改変
- **修正**: 環境依存の値は `useEffect` でマウント後に設定する（初回はサーバーと同じ出力にする）。
  `useSyncExternalStore` や `suppressHydrationWarning`（最終手段・限定的に）も検討。HTML ネストを正す。

### Server / Client 境界エラー
- **"You're importing a component that needs useState/useEffect…"**: `'use client'` の付け忘れ。
  ブラウザ API・フック・イベントハンドラを使う葉に `'use client'` を付ける。
- **"Functions cannot be passed directly to Client Components…"**: Client Component に
  非シリアライズ値（関数・クラス・Symbol 等）を props で渡している。Server Action は例外。
  それ以外はサーバー側で処理するか、値を分解して渡す。
- **Server Component で `useState`/`onClick` を使ってしまう**: そのコンポーネントを client 化するか、
  インタラクティブ部分を小さな Client Component に切り出す（葉に押し下げる）。

### キャッシュが更新されない / 古いデータが出る
- **原因**: ミューテーション後に再検証していない、または `fetch` が意図せずキャッシュされている。
- **修正**: 変更後に `revalidatePath` / `revalidateTag` を呼ぶ。常に最新が必要な取得は
  `fetch(url, { cache: 'no-store' })` または `export const dynamic = 'force-dynamic'`。
  逆に「更新が速すぎる/毎回取得される」なら `revalidate` 値やキャッシュ設定を見直す。
- **Router Cache（クライアント側）**: 遷移で古い画面が出る場合は `router.refresh()` を検討。

### `params` / `searchParams` / `cookies()` / `headers()` の await 漏れ
- **原因**: これらは**非同期（Promise）**。Next 15 で非同期化され、**Next 16 で同期アクセスは完全撤廃**
  された（もう同期では読めない）。`params.id` を直接参照すると型エラーや `undefined`。
- **修正**: `const { id } = await params` のように await する。型は
  `{ params: Promise<{ id: string }> }`。

### middleware → proxy 移行で認証が動かなくなった（Next 16）
- **原因**: Next 16 で `middleware.ts` は `proxy.ts`（関数名も `proxy`）に改名。**旧 `middleware.ts` を
  残しても動作自体は継続する**（Edge ランタイム・非推奨警告のみ／黙って停止はしない）。事故は主に
  **移行を中途半端にやった時**に起きる — ファイル名だけ変えて export を `proxy` にし忘れる、
  `config.matcher` を移し忘れる、next-intl / next-auth 等が新旧どちらのファイルを見るか噛み合わない、など。
- **修正**: codemod で一括移行する: `npx @next/codemod@canary middleware-to-proxy .`。
  ファイル名・export 名・matcher・認証ライブラリ設定を揃える。proxy は Node ランタイムで動く点にも注意。

### 動的レンダリング / キャッシュ未適用の切り替え
- **原因（Next 16）**: デフォルトで動的（リクエスト時実行）。`cacheComponents` + `'use cache'` を
  付け忘れると「キャッシュされず毎回実行」になり、逆に想定と違う静的化/キャッシュもディレクティブ次第。
- **修正**: キャッシュしたい単位に `'use cache'` を付ける。動的 API（`cookies()` 等）は必要な範囲に
  閉じ込め `<Suspense>` で切り分ける。ビルド出力でレンダリング種別を確認する。
- **`'use cache'` 内で動的APIを読むとエラー**: `Cannot access 'cookies()' in 'use cache'`
  （= リクエスト依存データをキャッシュスコープで読んだ）。修正: 該当値を境界の**外**で取得して
  **引数として渡す**（キャッシュキー化）か、そのデータはキャッシュしない。

### `revalidatePath`/`redirect` が効かない・例外になる
- `redirect()` / `notFound()` は内部的に例外を投げて制御を返すため、**`try/catch` の中で呼ぶと
  握りつぶされる**。**`try/catch` の外で呼ぶ**のが原則（内部 API の `isRedirectError` に依存しない。
  これは安定した公開エクスポートではなくバージョン間で移動・改名されうる）。

### 環境変数が `undefined`
- クライアント側で参照しているのに `NEXT_PUBLIC_` が付いていない → サーバー限定のため `undefined`。
- ビルド時に埋め込まれるため、`.env` 変更後は再ビルド/再起動が必要。
- `lib/env.server.ts`（秘密）/ `lib/env.public.ts`（`NEXT_PUBLIC_`）で起動時にスキーマ検証しておくと
  早期に検知できる（server/public 分割の完成例は `references/patterns.md` セクション5）。

### `Image` / `fetch` 実行時エラー
- **`next/image` の "hostname not configured"**: `next.config` の `images.remotePatterns` に
  外部ホストを追加する。
- **`fetch failed` / 証明書エラー**: プロキシ/CA 設定や URL を確認。内部URLをSSRF対策で弾いていないか。

### 無限ループ / 過剰再レンダリング
- `useEffect` の依存配列に毎回生成されるオブジェクト/関数が入っている → `useMemo`/`useCallback` で安定化、
  または依存を見直す。`setState` を effect 内で無条件に呼んでいないか確認。

## 修正時の禁じ手
- 原因不明のまま `suppressHydrationWarning` / `@ts-ignore` / `any` / `try/catch` で握り潰す
  （症状を隠すだけで再発する）。使うなら理由と限定範囲をコメントする。
- バグ修正のコミットに無関係なリファクタや整形を混ぜる（切り分け・レビューを困難にする）。
- 再現・検証せずに「たぶん直った」で終える。
