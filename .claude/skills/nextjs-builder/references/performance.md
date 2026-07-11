# パフォーマンス最適化

「速い」ではなく「無駄がない」を目指す。サーバーに寄せ、クライアントに送る JS を減らす。

> **Next.js 16 前提**: ビルド/dev は **Turbopack がデフォルト**（カスタム webpack 設定があると
> `next build` は失敗して誤設定を知らせる）。また `next build` 出力から size / First Load JS 指標が
> 削除された（RSC 構成では不正確なため）。バンドル計測は `@next/bundle-analyzer` 等で行う。

## クライアントバンドルの最小化（最重要）

- **Server Component をデフォルト**にするだけで、その分の JS はクライアントに送られない。
- `'use client'` を葉に押し下げる（`references/architecture.md`）。ページ丸ごとの client 化を避ける。
- 重いクライアント専用ライブラリ（チャート・エディタ・地図等）は **`next/dynamic` で遅延化**し、
  必要になるまでロードしない。

```tsx
'use client' // ← 重要: ssr:false は Client Component 内でのみ許可（後述）
import dynamic from 'next/dynamic'
// 初期表示に不要な重いエディタは遅延ロード（SSR不要なら ssr:false）
const RichEditor = dynamic(() => import('@/components/rich-editor'), {
  loading: () => <EditorSkeleton />,
  ssr: false,
})
```

> **制約（Next.js 16 でも同様）**: Server Component 内で `next/dynamic` に `ssr: false` を指定すると
> ビルドエラーになる（`ssr: false` は Client Component 専用）。本ガイドは「Server Component が
> デフォルト」なので要注意。Server Component から client 専用の重い依存を遅延したい場合は、
> `ssr: false` を含む**薄い Client ラッパー**を1枚挟むか、`ssr: false` を外す（SSR させる）。

- 依存追加は慎重に。moment→date-fns/Temporal、lodash 全体import→個別import 等、
  バンドルへの影響を意識する。`@next/bundle-analyzer` で計測できることを覚えておく。

## ストリーミング / Suspense

- 遅いデータで**ページ全体をブロックしない**。`loading.tsx` かページ内 `<Suspense>` で、
  速い部分を先に描画しながら遅い部分をストリーミングする。

```tsx
export default function Page() {
  return (
    <>
      <Header />                              {/* 即描画 */}
      <Suspense fallback={<FeedSkeleton />}>
        <SlowFeed />                          {/* 準備でき次第ストリーム */}
      </Suspense>
    </>
  )
}
```

- 独立した遅い領域は**別々の Suspense 境界**に分け、片方の遅延が他方を巻き込まないようにする。

## データ取得のパフォーマンス

- 独立取得は **`Promise.all` で並列化**（ウォーターフォール撲滅）。
- 同一リクエスト内の重複取得は **`React.cache`** で1回に。
- `useEffect` でのクライアント取得は原則避ける：ラウンドトリップ増・ウォーターフォール・
  ローディングスピナー地獄になりやすい。サーバー取得に寄せる。
- 必要な列だけ取得する（`SELECT *` を避ける）。ページネーション/カーソルで件数を抑える。

## 画像・フォント・アセット

- **`next/image`** を使う：自動リサイズ・遅延読み込み・`width`/`height` による CLS 防止。
  LCP 画像には `priority` を付ける。
- **`next/font`** を使う：セルフホストで外部リクエストを排除し、`font-display` を最適化、
  レイアウトシフトを防ぐ。
- 静的アセットは適切な `Cache-Control`。ハッシュ付きビルド成果物は長期キャッシュ可。

## レンダリング戦略の選択

- **静的（デフォルト）** が最速。動的にする理由（リクエスト固有データ・`cookies()`/`headers()`
  使用・`no-store`）が無ければ静的のままにする。
- 一覧など再生成可能なものは **ISR**（`revalidate`）でエッジ配信の速さと鮮度を両立。
- 動的が必要な箇所だけを動的にし、ページ全体を巻き込まない（Suspense で切り分ける）。

## React レベルの無駄取り

- 参照が変わると再レンダリングが波及する場合のみ `useMemo`/`useCallback`/`memo` を使う。
  **早すぎる最適化は可読性を下げる**ので、計測に基づいて入れる。
- リストの `key` は index ではなく安定した ID。
- Context は「変わらない値」と「頻繁に変わる値」を分割し、無関係な再レンダリングを防ぐ。

## よくある性能アンチパターン

- ページ全体 `'use client'` → 巨大バンドル。
- Server Component から自分の Route Handler を `fetch` してデータ取得 → 余計なHTTPホップ。
- 直列 `await` の連鎖 → ウォーターフォール。
- 巨大データを Client Component の props に丸ごと渡す → シリアライズ+転送コスト。
- `<img>` 直書き → 最適化・CLS対策が効かない。
