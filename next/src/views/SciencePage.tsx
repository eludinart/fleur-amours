'use client'

import { useEffect, useState } from 'react'
import { scienceApi } from '@/api/science'
import { toast } from '@/hooks/useToast'

type FileItem = { filename: string; name?: string }

export default function SciencePage() {
  const [files, setFiles] = useState<FileItem[]>([])
  const [content, setContent] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  useEffect(() => {
    scienceApi.files()
      .then((d) => setFiles((d as { files?: FileItem[] }).files ?? []))
      .catch(() => toast('Erreur chargement fichiers Science', 'error'))
  }, [])

  async function viewFile(filename: string) {
    setSelectedFile(filename)
    try {
      const d = (await scienceApi.view(filename)) as { html?: string }
      setContent(d.html ?? '<p>Vide</p>')
    } catch (e) {
      toast('Erreur: ' + (e instanceof Error ? e.message : 'Erreur'), 'error')
    }
  }

  return (
    <div className="flex gap-6 h-full">
      <aside className="w-56 shrink-0 space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Fichiers</h3>
        {files.map((f) => (
          <button
            key={f.filename}
            onClick={() => viewFile(f.filename)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors
              ${selectedFile === f.filename
                ? 'bg-accent/10 text-accent font-medium'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
          >
            {f.name || f.filename}
          </button>
        ))}
      </aside>

      <div className="flex-1 min-w-0 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 overflow-y-auto">
        {content ? (
          <div
            className="prose prose-slate dark:prose-invert max-w-none text-sm"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        ) : (
          <p className="text-slate-400">Sélectionnez un fichier</p>
        )}
      </div>
    </div>
  )
}
