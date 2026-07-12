'use client'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { createApiKeyAction, type CreateKeyState } from '../actions'

const initialState: CreateKeyState = { status: 'idle' }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending}>
      {pending ? '発行中…' : '発行する'}
    </button>
  )
}

// client の葉。成功時に平文を一度だけ表示（このコンポーネントの transient state のみ・再取得しない）。
export function CreateKeyForm() {
  const [state, action] = useActionState(createApiKeyAction, initialState)
  return (
    <div>
      <form action={action}>
        <input name="name" aria-label="キーのラベル" required maxLength={64} />
        <SubmitButton />
      </form>
      {state.status === 'error' && <p role="alert">{state.message}</p>}
      {state.status === 'success' && (
        <div role="status">
          <p>
            「{state.name}」のキーを発行しました。<strong>この平文キーは今回だけ表示されます</strong>。
          </p>
          <code>{state.plaintext}</code>
        </div>
      )}
    </div>
  )
}
