# 評価セット（典型依頼 × 期待される不変条件）

エージェント（`nextjs-builder`）が典型的な依頼にどう応えるべきかを、**出力が満たすべき不変条件**として
固定したもの。ラウンド毎の回帰チェックに使う。自動採点ではなく、**レビュー用ルーブリック**（出力を
この表と突き合わせて満たしているかを確認する）。`verification/` の実アプリは、このうち実装系の期待が
実際にビルド可能であることの裏取りでもある。

各行の「満たすべき不変条件」を**1つでも欠いたら要修正**。トレードオフで外す場合は理由を明示すること。

| # | 典型依頼 | 満たすべき不変条件（合格ライン） | 参照 |
|---|----------|--------------------------------|------|
| 1 | App Router で認可付きの投稿作成フォームを Server Action で作って | Server Component 既定＋Client は葉のフォームのみ／Action 先頭で**認証→Zod `safeParse`**／`authorId` はセッション由来（フォームから受けない）／`useActionState`＋`useFormStatus`／`revalidatePath`／`label`/`aria` を付与 | patterns §1, security §1-2 |
| 2 | 要件で SaaS ダッシュボードを作って。ORM や認証も最適なものを選んで | **選定を種別判定**し、非機能要件（データ特性/規模/リアルタイム/デプロイ）を確認（曖昧なら訊く）／5軸＋適合で候補評価し**理由と代替**を添える／**スタック決定を3〜6行で宣言**し DB/ORM/認証など不可逆選定は**着手前に確認**／セキュリティ前提（認可境界）を記録 | stack-selection §1-4, checklist |
| 3 | この一覧ページにページネーションを追加して | まず呼び出し元・型・データ層・近接ルートを読み**既存パターン踏襲**／深いオフセットより**カーソル方式**を優先／`take/limit` で件数制限／影響範囲を把握／既存の公開型を壊さない | data-access, checklist(機能追加) |
| 4 | この Client Component を減らしてバンドルを軽くして | **振る舞いを変えない**／`'use client'` を葉へ押し下げ・ページ全体 client を解消／重い依存は `next/dynamic` かサーバー寄せ／スコープを勝手に広げない／型/ビルドで保全確認 | performance, checklist(リファクタ) |
| 5 | hydration mismatch を直して | **再現→根本原因**（`Date.now()`/`localStorage`/不正 HTML ネスト等）→最小修正→検証／`suppressHydrationWarning` で握り潰さない／可能なら回帰テスト | debugging |
| 6 | この Route Handler をセキュリティ観点でレビューして | 実装せず 5軸で観点提示／**先頭で認証・認可（所有チェック）**／全入力 Zod／秘密漏れ・`server-only`／指摘は「該当箇所・理由・具体的修正案」 | security, checklist(レビュー) |
| 7 | ユーザーがファイルをアップロードする機能を作って | **presigned URL** でクライアント↔ストレージ直送（サーバー経由で受けない）／発行前に認証・認可／**contentType は allowlist(enum)**／サイズ上限は POST/HEAD 検証／秘密は `server-only`＋env 検証 | cloud-webhooks |
| 8 | 決済プロバイダの Webhook 受信を作って | **生ボディで署名検証**（`req.text()` を先に）／**定数時間比較**／`dynamic='force-dynamic'`／速く ACK し重い処理は `after()`/キュー／**冪等性**（event.id）／**公式 verifier があれば使う**（Stripe は `constructEvent`+`stripe-signature`） | cloud-webhooks |
| 9 | ログイン機能を作って | **認証は委譲（OAuth/パスワードレス/マネージド）を既定**に提案／Credentials 自前運用なら **argon2id/bcrypt ハッシュ・アカウント列挙対策・メール検証・レート制限**を必須ガードとして明示／認可はサーバー側 | stack-selection §3, security §6-7 |
| 10 | フォームのフラグや数値をクエリ/フォームから受け取って検証して | 文字列由来の真偽値に **`z.coerce.boolean()` を使わない**（`"false"`→true）／**`z.stringbool()`**（or enum+transform）／`z.coerce.number()` の空文字→0 に注意／境界で `safeParse`、型は `z.infer` | libraries |

## 使い方

- 新ラウンドの前後で、代表依頼をエージェントに投げ、出力を上表の不変条件と突き合わせる。
- 欠落が見つかったら、それは docs（`references/*`）の不足かエージェントの締めの弱さ。該当ファイルを直す。
- 実装系（#1,2,7,8）の期待コードは `verification/app` に反映され `bash run.sh` でビルド可能性を担保する。
