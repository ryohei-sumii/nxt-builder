'use client'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { createPost, type FormState } from './actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending}>
      {pending ? '送信中…' : '投稿'}
    </button>
  )
}

export function NewPostForm() {
  const [state, action] = useActionState<FormState, FormData>(createPost, {})
  return (
    <form action={action}>
      <input name="title" aria-label="タイトル" required />
      <textarea name="body" aria-label="本文" required />
      {state.error && <p role="alert">{state.error}</p>}
      {state.ok && <p role="status">投稿しました</p>}
      <SubmitButton />
    </form>
  )
}
