'use client'
import { useState, type ReactNode } from 'react'

// patterns.md §4: 状態だけを担当する Client Component（SRP）。children はサーバー描画のまま差し込まれる。
export function Collapsible({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <section>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {title}
      </button>
      {open && children}
    </section>
  )
}
