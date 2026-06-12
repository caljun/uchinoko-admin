import { useEffect, useState } from 'react'
import { collection, collectionGroup, getDocs, orderBy, query } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { AlertTriangle, Ban, CheckCircle, Search, Trash2 } from 'lucide-react'
import { db } from '../lib/firebase'

interface Owner {
  id: string
  email?: string
  displayName?: string
  name?: string
  isDisabled?: boolean
  createdAt?: { toDate: () => Date }
}

const functions = getFunctions(undefined, 'us-central1')
const callDisable = httpsCallable(functions, 'adminDisableUser')
const callEnable = httpsCallable(functions, 'adminEnableUser')
const callDelete = httpsCallable(functions, 'adminDeleteUser')

function displayName(owner: Owner) {
  return owner.displayName || owner.name || '名前なし'
}

function DeleteModal({ owner, onConfirm, onCancel }: {
  owner: Owner
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="text-red-500" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800">ユーザーを削除</h3>
            <p className="text-xs text-gray-400 mt-0.5">この操作は取り消せません</p>
          </div>
        </div>
        <div className="bg-gray-50 rounded-xl px-4 py-3 mb-4">
          <p className="text-sm font-medium text-gray-800">{displayName(owner)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{owner.email || owner.id}</p>
        </div>
        <p className="text-xs text-gray-500 mb-5">
          Auth アカウント、犬、投稿、フォロー情報を削除します。
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
            キャンセル
          </button>
          <button onClick={onConfirm} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600">
            削除する
          </button>
        </div>
      </div>
    </div>
  )
}

export default function UsersPage() {
  const [owners, setOwners] = useState<Owner[]>([])
  const [dogCounts, setDogCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Owner | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  useEffect(() => {
    loadUsers()
  }, [])

  const showToast = (msg: string, type: 'ok' | 'err') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const loadUsers = async () => {
    setLoading(true)
    try {
      const [ownersSnap, dogsSnap] = await Promise.all([
        getDocs(query(collection(db, 'owners'), orderBy('createdAt', 'desc'))),
        getDocs(collectionGroup(db, 'dogs')),
      ])

      const counts: Record<string, number> = {}
      dogsSnap.forEach((dogDoc) => {
        if (!dogDoc.ref.path.startsWith('owners/')) return
        const ownerUid = dogDoc.ref.path.split('/')[1]
        counts[ownerUid] = (counts[ownerUid] ?? 0) + 1
      })

      setDogCounts(counts)
      setOwners(ownersSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      } as Owner)))
    } catch {
      showToast('ユーザーの読み込みに失敗しました', 'err')
    } finally {
      setLoading(false)
    }
  }

  const toggleDisable = async (owner: Owner) => {
    setActionLoading(owner.id)
    try {
      if (owner.isDisabled) {
        await callEnable({ uid: owner.id })
        setOwners((prev) => prev.map((item) => item.id === owner.id ? { ...item, isDisabled: false } : item))
        showToast('凍結を解除しました', 'ok')
      } else {
        await callDisable({ uid: owner.id })
        setOwners((prev) => prev.map((item) => item.id === owner.id ? { ...item, isDisabled: true } : item))
        showToast('アカウントを凍結しました', 'ok')
      }
    } catch {
      showToast('操作に失敗しました', 'err')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    setActionLoading(target.id)
    try {
      await callDelete({ uid: target.id })
      setOwners((prev) => prev.filter((item) => item.id !== target.id))
      showToast('ユーザーを削除しました', 'ok')
    } catch {
      showToast('削除に失敗しました', 'err')
    } finally {
      setActionLoading(null)
    }
  }

  const filtered = owners.filter((owner) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      displayName(owner).toLowerCase().includes(q) ||
      (owner.email ?? '').toLowerCase().includes(q) ||
      owner.id.toLowerCase().includes(q)
    )
  })

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-800">ユーザー管理</h2>
          <p className="text-xs text-gray-400 mt-0.5">{owners.length}人</p>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="名前・メールで検索"
            className="pl-8 pr-4 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-300 w-56"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">読み込み中...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">名前</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">メールアドレス</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">登録日</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">登録犬数</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">状態</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((owner) => {
                const isActing = actionLoading === owner.id
                const createdAt = owner.createdAt?.toDate()
                return (
                  <tr key={owner.id} className={`${owner.isDisabled ? 'bg-red-50/40' : 'hover:bg-gray-50/50'} transition-colors`}>
                    <td className="px-4 py-3 font-medium text-gray-800">{displayName(owner)}</td>
                    <td className="px-4 py-3 text-gray-500">{owner.email || '-'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{createdAt ? createdAt.toLocaleDateString('ja-JP') : '-'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-700">{dogCounts[owner.id] ?? 0}</td>
                    <td className="px-4 py-3">
                      {owner.isDisabled ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-red-100 text-red-600 rounded-full font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          凍結中
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-green-100 text-green-600 rounded-full font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          正常
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => toggleDisable(owner)}
                          disabled={isActing}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${
                            owner.isDisabled
                              ? 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'
                              : 'bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200'
                          }`}
                        >
                          {owner.isDisabled ? <CheckCircle size={12} /> : <Ban size={12} />}
                          {owner.isDisabled ? '解除' : '凍結'}
                        </button>
                        <button
                          onClick={() => setDeleteTarget(owner)}
                          disabled={isActing}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-500 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-40"
                        >
                          <Trash2 size={12} />
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400 text-sm">該当するユーザーがいません</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {deleteTarget && (
        <DeleteModal
          owner={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl text-sm font-medium shadow-lg ${
          toast.type === 'ok' ? 'bg-gray-800 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
