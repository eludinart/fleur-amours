'use client'

import { useState, useEffect } from 'react'
import { adminApi } from '@/api/admin'

const TYPE_LABELS: Record<string, string> = {
  tuteur: "Prompt Tuteur (dialogue principal)",
  threshold: "Prompt Seuil (premiers mots, porte d'entrée)",
  coach: "Prompt Coach (fiche de synthèse & accompagnement)",
}

type Prompt = { id: number; type: string; name: string; content?: string }

type ActivePrompts = {
  active_tuteur_id: number | null
  active_threshold_id: number | null
  active_coach_id: number | null
}

type EditModal = { id?: number; type: string; name: string; content?: string }

export default function AdminPromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [active, setActive] = useState<ActivePrompts>({
    active_tuteur_id: null,
    active_threshold_id: null,
    active_coach_id: null,
  })
  const [dbConfigured, setDbConfigured] = useState<boolean>(true)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null)
  const [editModal, setEditModal] = useState<EditModal | null>(null)
  const [selectedTuteur, setSelectedTuteur] = useState<number | null>(null)
  const [selectedThreshold, setSelectedThreshold] = useState<number | null>(null)
  const [selectedCoach, setSelectedCoach] = useState<number | null>(null)
  const [analyzeMoodContent, setAnalyzeMoodContent] = useState('')
  const [analyzeMoodLoading, setAnalyzeMoodLoading] = useState(false)

  function load() {
    setLoading(true)
    adminApi.getPrompts()
      .then((data) => {
        const d = data as { prompts?: Prompt[]; active?: ActivePrompts; db_configured?: boolean }
        setPrompts(d.prompts ?? [])
        const a = (d.active ?? {}) as ActivePrompts
        setActive(a)
        setSelectedTuteur(a.active_tuteur_id ?? null)
        setSelectedThreshold(a.active_threshold_id ?? null)
        setSelectedCoach((a as any).active_coach_id ?? null)
        setDbConfigured(d.db_configured ?? true)
      })
      .catch((e: { detail?: string; message?: string }) => {
        setMessage({ type: 'error', text: ((e.detail ?? e.message ?? 'Erreur') as string) + ' — Impossible de charger les prompts.' })
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    setAnalyzeMoodLoading(true)
    adminApi.getAnalyzeMoodPrompt()
      .then((d) => setAnalyzeMoodContent((d as { content?: string }).content ?? ''))
      .catch(() => setAnalyzeMoodContent(''))
      .finally(() => setAnalyzeMoodLoading(false))
  }, [])

  function showMessage(text: string, type = 'success') {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  async function handleSavePrompt() {
    if (!editModal) return
    const { id, type, name, content } = editModal
    if (!type || !name?.trim()) {
      showMessage('Nom requis.', 'error')
      return
    }
    setBusy(true)
    try {
      if (id) {
        await adminApi.updatePrompt({ id, name: name.trim(), content: content ?? '' })
        showMessage('Prompt mis à jour.')
      } else {
        await adminApi.createPrompt({ type, name: name.trim(), content: content ?? '' })
        showMessage('Prompt créé.')
      }
      setEditModal(null)
      load()
    } catch (e: unknown) {
      const err = e as { detail?: string; message?: string }
      showMessage(((err.detail ?? err.message ?? 'Erreur') as string) + ' — Enregistrement échoué.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Supprimer ce prompt ?')) return
    setBusy(true)
    try {
      await adminApi.deletePrompt(id)
      showMessage('Prompt supprimé.')
      load()
    } catch (e: unknown) {
      const err = e as { detail?: string; message?: string }
      showMessage(((err.detail ?? err.message ?? 'Erreur') as string) + ' — Suppression échouée.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveAnalyzeMood() {
    setBusy(true)
    try {
      await adminApi.saveAnalyzeMoodPrompt(analyzeMoodContent)
      showMessage('Prompt Dreamscape enregistré.')
    } catch (e: unknown) {
      const err = e as { detail?: string; message?: string }
      showMessage(((err.detail ?? err.message ?? 'Erreur') as string) + ' — Enregistrement échoué.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleActivate() {
    setBusy(true)
    try {
      await adminApi.setActivePromptsWithCoach(
        selectedTuteur || null,
        selectedThreshold || null,
        selectedCoach || null
      )
      setActive({
        active_tuteur_id: selectedTuteur,
        active_threshold_id: selectedThreshold,
        ...(selectedCoach != null ? { active_coach_id: selectedCoach } : { active_coach_id: null }),
      } as any)
      showMessage('Prompts activés en production. Les prochaines sessions utiliseront le couple tuteur/seuil + le prompt coach.')
      load()
    } catch (e: unknown) {
      const err = e as { detail?: string; message?: string }
      showMessage(((err.detail ?? err.message ?? 'Erreur') as string) + ' — Activation échouée.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const tuteurPrompts = prompts.filter((p) => p.type === 'tuteur')
  const thresholdPrompts = prompts.filter((p) => p.type === 'threshold')
  const coachPrompts = prompts.filter((p) => p.type === 'coach')

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="w-8 h-8 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-rose-500 bg-clip-text text-transparent">
        Prompts IA
      </h2>

      <p className="text-sm text-slate-600 dark:text-slate-400">
        Gérez les prompts Tuteur et Seuil en base de données. Sélectionnez un couple et activez-le en production pour changer la dynamique des sessions.
      </p>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4">
        {!dbConfigured && (
          <p className="text-sm text-amber-700 dark:text-amber-400 mb-3 font-medium">
            Base MariaDB non configurée (MARIADB_HOST, MARIADB_PASSWORD, etc.). Les prompts ne peuvent pas être chargés.
          </p>
        )}
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
          {prompts.length === 0
            ? (dbConfigured
                ? 'Aucun prompt en base. Cliquez sur « Récupérer depuis overrides / constantes » pour créer les prompts Tuteur et Seuil.'
                : 'Configurez les variables d\'environnement MariaDB puis rechargez.')
            : 'Récupérer les prompts depuis prompts-overrides.json (ou constantes si le fichier est absent).'}
        </p>
        <div className="flex flex-wrap gap-2">
          {dbConfigured && (
          <button
            onClick={async () => {
              setBusy(true)
              try {
                const res = await adminApi.importFromFile() as { from_file?: boolean }
                showMessage(res.from_file
                  ? 'Prompts récupérés depuis prompts-overrides.json et activés.'
                  : 'Prompts récupérés (constantes par défaut) et activés.')
                load()
              } catch (e: unknown) {
                const err = e as { detail?: string; message?: string }
                showMessage(((err.detail ?? err.message ?? 'Erreur') as string) + ' — Import échoué.', 'error')
              } finally { setBusy(false) }
            }}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-500 text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Import…' : 'Récupérer depuis overrides / constantes'}
          </button>
          )}
          {dbConfigured && prompts.length === 0 && (
            <button
              onClick={async () => {
                setBusy(true)
                try {
                  await adminApi.seedDefaults()
                  showMessage('Prompts par défaut créés et activés.')
                  load()
                } catch (e: unknown) {
                  const err = e as { detail?: string; message?: string }
                  showMessage(((err.detail ?? err.message ?? 'Erreur') as string) + ' — Import échoué.', 'error')
                } finally { setBusy(false) }
              }}
              disabled={busy}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Import…' : 'Importer uniquement les constantes'}
            </button>
          )}
        </div>
      </div>

      {message && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-5">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-1">
          Dreamscape — Promenade Onirique
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Prompt utilisé pour l&apos;interface voix / texte avec les cartes et la fleur. Définit comment l&apos;IA interprète la parole, la disposition des cartes et génère les réflexions poétiques.
        </p>
        {analyzeMoodLoading ? (
          <div className="flex items-center gap-2 text-slate-500 py-4">
            <span className="w-5 h-5 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
            Chargement…
          </div>
        ) : (
          <>
            <textarea
              value={analyzeMoodContent}
              onChange={(e) => setAnalyzeMoodContent(e.target.value)}
              rows={18}
              className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-mono resize-y mb-4"
              placeholder="Instructions système pour l'analyse du mood..."
            />
            <button
              onClick={handleSaveAnalyzeMood}
              disabled={busy}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-500 to-rose-500 shadow-md hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'En cours…' : 'Enregistrer le prompt Dreamscape'}
            </button>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-5">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
          Couple actif en production
        </h3>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Tuteur</label>
            <select
              value={selectedTuteur ?? ''}
              onChange={(e) => setSelectedTuteur(e.target.value ? Number(e.target.value) : null)}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm min-w-[180px]"
            >
              <option value="">— Aucun —</option>
              {tuteurPrompts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {active.active_tuteur_id === p.id ? '✓' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Seuil</label>
            <select
              value={selectedThreshold ?? ''}
              onChange={(e) => setSelectedThreshold(e.target.value ? Number(e.target.value) : null)}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm min-w-[180px]"
            >
              <option value="">— Aucun —</option>
              {thresholdPrompts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {active.active_threshold_id === p.id ? '✓' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Coach</label>
            <select
              value={selectedCoach ?? ''}
              onChange={(e) => setSelectedCoach(e.target.value ? Number(e.target.value) : null)}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm min-w-[180px]"
            >
              <option value="">— Aucun —</option>
              {coachPrompts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {(active as any).active_coach_id === p.id ? '✓' : ''}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleActivate}
            disabled={busy}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-500 to-rose-500 shadow-md hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'En cours…' : 'Activer en production'}
          </button>
        </div>
      </section>

      {(['tuteur', 'threshold', 'coach'] as const).map((type) => {
        const list = type === 'tuteur' ? tuteurPrompts : type === 'threshold' ? thresholdPrompts : coachPrompts
        return (
          <section key={type} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-5">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
              {TYPE_LABELS[type]}
            </h3>
            <ul className="space-y-2">
              {list.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/50"
                >
                  <span className="font-medium text-slate-800 dark:text-slate-200">{p.name}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditModal({ id: p.id, type: p.type, name: p.name, content: p.content })}
                      className="text-sm text-violet-600 dark:text-violet-400 hover:underline"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      disabled={busy}
                      className="text-sm text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                    >
                      Supprimer
                    </button>
                  </div>
                </li>
              ))}
              {list.length === 0 && (
                <li className="text-sm text-slate-500 dark:text-slate-400 py-2">Aucun prompt.</li>
              )}
            </ul>
            <button
              onClick={() => setEditModal({ type, name: '', content: '' })}
              className="mt-3 text-sm text-violet-600 dark:text-violet-400 font-medium hover:underline"
            >
              + Ajouter un prompt {type === 'tuteur' ? 'Tuteur' : type === 'threshold' ? 'Seuil' : 'Coach'}
            </button>
          </section>
        )
      })}

      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-xl">
            <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">
              {editModal.id ? 'Modifier le prompt' : `Nouveau prompt ${
                editModal.type === 'tuteur' ? 'Tuteur' : editModal.type === 'threshold' ? 'Seuil' : 'Coach'
              }`}
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Nom</label>
                <input
                  type="text"
                  value={editModal.name}
                  onChange={(e) => setEditModal({ ...editModal, name: e.target.value })}
                  placeholder="ex. Approche douce v1"
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Contenu</label>
                <textarea
                  value={editModal.content ?? ''}
                  onChange={(e) => setEditModal({ ...editModal, content: e.target.value })}
                  rows={14}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-mono resize-y"
                  placeholder="Instructions pour l'IA..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSavePrompt}
                  disabled={busy}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-500 to-rose-500 hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? 'En cours…' : 'Enregistrer'}
                </button>
                <button
                  onClick={() => setEditModal(null)}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
