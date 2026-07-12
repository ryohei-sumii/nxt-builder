# verification-next15 — Next 15 版差の検証ハーネス

`verification/`（Next 16）の姉妹ハーネス。**対象プロジェクトが Next 15 のとき**、エージェント
（`nextjs-builder`）が版に合わせて出すコードの形が**実ビルドできる**ことを固定する。メンテナ用の QA
ツールで、配布物（`.claude/`）には含まれない。

## 何を検証するか（Next 16 との版差に絞る）

| 版差 | Next 16（`verification/`） | Next 15（このハーネス） |
|------|---------------------------|------------------------|
| ルート単位ガードのファイル/関数名 | `proxy.ts` / `export function proxy` | **`middleware.ts` / `export function middleware`** |
| リクエストAPI（`params`/`cookies`/`headers`） | 非同期（同期撤廃） | **非同期（await 必須）** ※15 で導入・14 以前は同期 |
| キャッシュ | Cache Components（`cacheComponents` + `'use cache'`） | **`'use cache'` 非使用**（15 では experimental・既定 OFF） |
| GET Route Handler の既定 | 非キャッシュ | 非キャッシュ（14 の既定キャッシュから変更） |

版に依らない中核（Server Component 既定 / 認証・認可→Zod / IDOR 回避 / DAL）は両ハーネスで同じ。
zod 等の**実行時フットガンは版非依存**なので 16 ハーネス（`verification/runtime`）に集約し、ここでは重複させない。

## 使い方

```bash
cd verification-next15
bash run.sh   # install（pinned）→ next build → tsc --strict
```

`node_modules` は gitignore。ピン留め: **Next 15.5.20 / React 19.0.0 / zod 4.4.3**。
