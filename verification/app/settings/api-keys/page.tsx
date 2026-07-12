import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { apiKeys, type ApiKeyDto } from '@/lib/data/api-keys'
import { CreateKeyForm } from './_components/create-key-form'
import { revokeApiKeyAction } from './actions'

// eval-set 2b: 長文要件からの実装（APIキー管理スライス）の代表成果物。
// RSC 既定＋client は葉（発行フォーム）のみ。セッション＋ユーザー固有データ＝動的。
export const dynamic = 'force-dynamic'

export default async function ApiKeysPage() {
  const session = await auth()
  if (!session) redirect('/login') // 読み取り経路も認可対象
  const keys = await apiKeys.list(session.userId) // 所有スコープは DAL（IDOR 回避）・DTO のみ

  return (
    <main>
      <h1>API キー</h1>
      <p>発行後の平文キーは一度だけ表示されます。</p>
      <CreateKeyForm />
      <ul>
        {keys.map((k) => (
          <KeyRow key={k.id} apiKey={k} />
        ))}
      </ul>
    </main>
  )
}

function KeyRow({ apiKey }: { apiKey: ApiKeyDto }) {
  const isRevoked = apiKey.status === 'revoked'
  return (
    <li>
      <span>{apiKey.name}</span>
      <code>{apiKey.prefix}…</code> {/* 平文全体は出さない */}
      <span>作成: {apiKey.createdAt}</span>
      <span>最終使用: {apiKey.lastUsedAt ?? '未使用'}</span>
      <span>{isRevoked ? '失効済み' : '有効'}</span>
      {!isRevoked && (
        // 失効はサーバーフォームから Server Action を直接呼ぶ（client 不要）。所有チェックは Action/DAL。
        <form action={revokeApiKeyAction}>
          <input type="hidden" name="keyId" value={apiKey.id} />
          <button type="submit">失効</button>
        </form>
      )}
    </li>
  )
}
