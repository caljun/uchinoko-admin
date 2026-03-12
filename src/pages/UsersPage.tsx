import { useEffect, useState } from 'react'
import { collection, getDocs, orderBy, query, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { Search, Ban, Trash2, CheckCircle } from 'lucide-react'

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

export default function UsersPage() {
  const [owners, setOwners] = useState<Owner[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    getDocs(query(collection(db, 'owners'), orderBy('createdAt', 'desc')))
      .then((snap) => {
        setOwners(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Owner)))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = owners.filter((o) => {
    const q = search.toLowerCase()
    return (
      (o.displayName ?? '').toLowerCase().includes(q) ||
      o.email.toLowerCase().includes(q) ||
      (o.friendId ?? '').toLowerCase().includes(q)
    )
  })

  const toggleDisable = async (owner: Owner) => {
    setActionLoading(owner.id)
    try {
      await updateDoc(doc(db, 'owners', owner.id), { isDisabled: !owner.isDisabled })
      setOwners((prev) => prev.map((o) => o.id === owner.id ? { ...o, isDisabled: !o.isDisabled } : o))
    } finally {
      setActionLoading(null)
    }
  }

  const deleteUser = async (owner: Owner) => {
    if (!confirm(`「${owner.displayName ?? owner.email}」を削除しますか？この操作は取り消せません。`)) return
    setActionLoading(owner.id)
    try {
      await deleteDoc(doc(db, 'owners', owner.id))
      setOwners((prev) => prev.filter((o) => o.id !== owner.id))
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">ユーザー管理</h2>
          <p className="text-sm text-gray-400 mt-0.5">{owners.length}人のユーザー</p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="名前・メール・IDで検索"
            className="pl-8 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-300 w-64"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">読み込み中...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">ユーザー</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">ID</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">総pt</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">週pt</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">登録日</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">ステータス</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((owner) => {
                const date = owner.createdAt?.toDate()
                return (
                  <tr key={owner.id} className={owner.isDisabled ? 'bg-red-50/30' : ''}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{owner.displayName ?? '—'}</p>
                      <p className="text-xs text-gray-400">{owner.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{owner.friendId ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-orange-500">{owner.totalPoints}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{owner.weeklyPoints}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {date ? date.toLocaleDateString('ja-JP') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {owner.isDisabled ? (
                        <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full font-medium">凍結中</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-600 rounded-full font-medium">正常</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => toggleDisable(owner)}
                          disabled={actionLoading === owner.id}
                          title={owner.isDisabled ? '凍結解除' : '凍結'}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-orange-500 transition-colors disabled:opacity-40"
                        >
                          {owner.isDisabled ? <CheckCircle size={15} /> : <Ban size={15} />}
                        </button>
                        <button
                          onClick={() => deleteUser(owner)}
                          disabled={actionLoading === owner.id}
                          title="削除"
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">該当するユーザーがいません</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
