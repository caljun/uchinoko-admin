import { useEffect, useState } from 'react'
import { collection, collectionGroup, getDocs, orderBy, query } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { db } from '../lib/firebase'
import { Search, Ban, Trash2, CheckCircle, AlertTriangle } from 'lucide-react'

interface Owner {
  id: string
  email: string
  displayName?: string
  totalPoints: number
  weeklyPoints: number
  friendId?: string
  isDisabled?: boolean
  createdAt?: { toDate: () => Date }
}

const functions = getFunctions(undefined, 'us-central1')
const callDisable = httpsCallable(functions, 'adminDisableUser')
const callEnable = httpsCallable(functions, 'adminEnableUser')
const callDelete = httpsCallable(functions, 'adminDeleteUser')

// 削除確認モーダル
function DeleteModal({ owner, onConfirm, onCancel }: {
  owner: Owner
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
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
          <p className="text-sm font-medium text-gray-800">{owner.displayName ?? '名前なし'}</p>
          <p className="text-xs text-gray-400 mt-0.5">{owner.email}</p>
        </div>
        <p className="text-xs text-gray-500 mb-5">
          Auth アカウント・Firestore ドキュメント・犬のデータ・日記・健康記録をすべて削除します。
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
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Owner | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  useEffect(() => {
    Promise.all([
      getDocs(query(collection(db, 'owners'), orderBy('createdAt', 'desc'))),
      getDocs(collectionGroup(db, 'dogs')),
    ]).then(([ownersSnap, dogsSnap]) => {
      // 犬ドキュメントからオーナーUID別にポイントを合算
      const pointsMap: Record<string, { total: number; weekly: number }> = {}
      dogsSnap.forEach((d) => {
        const ownerUid = d.ref.path.split('/')[1]
        const data = d.data()
        if (!pointsMap[ownerUid]) pointsMap[ownerUid] = { total: 0, weekly: 0 }
        pointsMap[ownerUid].total += (data.totalPoints as number) ?? 0
        pointsMap[ownerUid].weekly += (data.weeklyPoints as number) ?? 0
      })
      setOwners(ownersSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        totalPoints: pointsMap[d.id]?.total ?? 0,
        weeklyPoints: pointsMap[d.id]?.weekly ?? 0,
      } as Owner)))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const showToast = (msg: string, type: 'ok' | 'err') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const toggleDisable = async (owner: Owner) => {
    setActionLoading(owner.id)
    try {
      if (owner.isDisabled) {
        await callEnable({ uid: owner.id })
        setOwners((prev) => prev.map((o) => o.id === owner.id ? { ...o, isDisabled: false } : o))
        showToast('凍結を解除しました', 'ok')
      } else {
        await callDisable({ uid: owner.id })
        setOwners((prev) => prev.map((o) => o.id === owner.id ? { ...o, isDisabled: true } : o))
        showToast('アカウントを凍結しました', 'ok')
      }
    } catch (e) {
      showToast('エラーが発生しました', 'err')
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
      setOwners((prev) => prev.filter((o) => o.id !== target.id))
      showToast('ユーザーを削除しました', 'ok')
    } catch (e) {
      showToast('削除に失敗しました', 'err')
    } finally {
      setActionLoading(null)
    }
  }

  const filtered = owners.filter((o) => {
    const q = search.toLowerCase()
    return (
      (o.displayName ?? '').toLowerCase().includes(q) ||
      o.email.toLowerCase().includes(q) ||
      (o.friendId ?? '').toLowerCase().includes(q)
    )
  })

  const activeCount = owners.filter((o) => !o.isDisabled).length
  const disabledCount = owners.filter((o) => o.isDisabled).length

  return (
    <div className="p-6 max-w-5xl">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-800">ユーザー管理</h2>
          <p className="text-xs text-gray-400 mt-0.5">{owners.length}人</p>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="名前・メール・IDで検索"
            className="pl-8 pr-4 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-300 w-56"
          />
        </div>
      </div>

      {/* サマリー */}
      {owners.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-400">総ユーザー数</p>
            <p className="text-2xl font-bold text-gray-800 mt-0.5">{owners.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-400">アクティブ</p>
            <p className="text-2xl font-bold text-green-600 mt-0.5">{activeCount}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-400">凍結中</p>
            <p className="text-2xl font-bold text-red-500 mt-0.5">{disabledCount}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">読み込み中...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">ユーザー</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">フレンドID</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">総pt</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">週pt</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">登録日</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">状態</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((owner) => {
                const date = owner.createdAt?.toDate()
                const isActing = actionLoading === owner.id
                return (
                  <tr key={owner.id} className={`${owner.isDisabled ? 'bg-red-50/40' : 'hover:bg-gray-50/50'} transition-colors`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800 text-sm">{owner.displayName ?? '—'}</p>
                      <p className="text-xs text-gray-400">{owner.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{owner.friendId ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-orange-500 text-sm">{owner.totalPoints ?? 0}</td>
                    <td className="px-4 py-3 text-right text-gray-600 text-sm">{owner.weeklyPoints ?? 0}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {date ? date.toLocaleDateString('ja-JP') : '—'}
                    </td>
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
                        {/* 凍結 / 解除 */}
                        <button
                          onClick={() => toggleDisable(owner)}
                          disabled={isActing}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${
                            owner.isDisabled
                              ? 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'
                              : 'bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200'
                          }`}
                        >
                          {isActing ? (
                            <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                          ) : owner.isDisabled ? (
                            <CheckCircle size={12} />
                          ) : (
                            <Ban size={12} />
                          )}
                          {owner.isDisabled ? '解除' : '凍結'}
                        </button>
                        {/* 削除 */}
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
                  <td colSpan={7} className="text-center py-12 text-gray-400 text-sm">該当するユーザーがいません</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 削除確認モーダル */}
      {deleteTarget && (
        <DeleteModal
          owner={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* トースト */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl text-sm font-medium shadow-lg transition-all ${
          toast.type === 'ok' ? 'bg-gray-800 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
