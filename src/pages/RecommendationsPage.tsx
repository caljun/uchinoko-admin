import { useEffect, useState } from 'react'
import { collection, getDocs, orderBy, query, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { Plus, Pencil, Trash2, ExternalLink, TrendingUp, Eye, EyeOff } from 'lucide-react'

interface Recommendation {
  id: string
  title: string
  description?: string
  imageUrl?: string
  url: string
  category?: string
  tapCount?: number
  isActive: boolean
  order?: number
}

const CATEGORIES = ['フード', 'おもちゃ', '健康・医療', 'グルーミング', 'お散歩', 'その他']

function Modal({
  item,
  onSave,
  onClose,
}: {
  item: Partial<Recommendation> | null
  onSave: (data: Omit<Recommendation, 'id' | 'tapCount'>) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState({
    title: item?.title ?? '',
    description: item?.description ?? '',
    imageUrl: item?.imageUrl ?? '',
    url: item?.url ?? '',
    category: item?.category ?? '',
    isActive: item?.isActive ?? true,
    order: item?.order ?? 0,
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">{item?.id ? '編集' : '新規追加'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">タイトル *</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">説明</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">アフィリエイトURL *</label>
            <input
              required
              type="url"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">画像URL</label>
            <input
              type="url"
              value={form.imageUrl}
              onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">カテゴリ</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
              >
                <option value="">未設定</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="w-24">
              <label className="block text-xs font-medium text-gray-600 mb-1">表示順</label>
              <input
                type="number"
                value={form.order}
                onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              className="w-4 h-4 accent-orange-500"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700">表示する</label>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
              キャンセル
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-orange-600">
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function RecommendationsPage() {
  const [items, setItems] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [modalItem, setModalItem] = useState<Partial<Recommendation> | null | undefined>(undefined)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    const snap = await getDocs(query(collection(db, 'recommendations'), orderBy('order', 'asc')))
    setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Recommendation)))
    setLoading(false)
  }

  const handleSave = async (data: Omit<Recommendation, 'id' | 'tapCount'>) => {
    if (modalItem?.id) {
      await updateDoc(doc(db, 'recommendations', modalItem.id), { ...data, updatedAt: serverTimestamp() })
    } else {
      await addDoc(collection(db, 'recommendations'), { ...data, tapCount: 0, createdAt: serverTimestamp() })
    }
    setModalItem(undefined)
    await load()
  }

  const toggleActive = async (item: Recommendation) => {
    setActionLoading(item.id)
    await updateDoc(doc(db, 'recommendations', item.id), { isActive: !item.isActive })
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, isActive: !i.isActive } : i))
    setActionLoading(null)
  }

  const deleteItem = async (item: Recommendation) => {
    if (!confirm(`「${item.title}」を削除しますか？`)) return
    setActionLoading(item.id)
    await deleteDoc(doc(db, 'recommendations', item.id))
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    setActionLoading(null)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">おすすめ商品</h2>
          <p className="text-sm text-gray-400 mt-0.5">{items.length}件</p>
        </div>
        <button
          onClick={() => setModalItem(null)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors"
        >
          <Plus size={15} />
          追加
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">読み込み中...</div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={`bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 ${!item.isActive ? 'opacity-50' : ''}`}
            >
              {/* サムネ */}
              <div className="w-14 h-14 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-xl">🛍</div>
                )}
              </div>
              {/* 情報 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-800 truncate">{item.title}</p>
                  {item.category && (
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full flex-shrink-0">{item.category}</span>
                  )}
                </div>
                {item.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{item.description}</p>}
                <div className="flex items-center gap-3 mt-1">
                  <span className="flex items-center gap-1 text-xs text-orange-500 font-medium">
                    <TrendingUp size={11} />
                    {item.tapCount ?? 0} タップ
                  </span>
                  <span className="text-xs text-gray-400">順序: {item.order ?? 0}</span>
                </div>
              </div>
              {/* アクション */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-500 transition-colors">
                  <ExternalLink size={15} />
                </a>
                <button onClick={() => toggleActive(item)} disabled={actionLoading === item.id} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-orange-500 transition-colors disabled:opacity-40">
                  {item.isActive ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
                <button onClick={() => setModalItem(item)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                  <Pencil size={15} />
                </button>
                <button onClick={() => deleteItem(item)} disabled={actionLoading === item.id} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p>まだ商品がありません</p>
              <button onClick={() => setModalItem(null)} className="mt-3 text-sm text-orange-500 hover:underline">追加する</button>
            </div>
          )}
        </div>
      )}

      {modalItem !== undefined && (
        <Modal
          item={modalItem}
          onSave={handleSave}
          onClose={() => setModalItem(undefined)}
        />
      )}
    </div>
  )
}
