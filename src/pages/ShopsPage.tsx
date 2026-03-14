import { useEffect, useState } from 'react'
import { collection, query, orderBy, getDocs, updateDoc, doc } from 'firebase/firestore'
import { LogOut } from 'lucide-react'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'

interface License {
  registrationNumber?: string
  name?: string
  address?: string
  manager?: string
  registrationDate?: string
  validUntil?: string
  category?: string[]
  status?: 'pending' | 'approved' | 'rejected'
  reason?: string
}

interface Shop {
  id: string
  name?: string
  status?: string
  categories?: string[]
  address?: string
  isPublished?: boolean
  createdAt?: string
  license?: License
}

const STATUS_LABELS: Record<string, string> = {
  draft: '下書き',
  pending_review: '審査中',
  approved: '承認済み',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800',
  pending_review: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
}

const CATEGORY_LABELS: Record<string, string> = {
  training: 'しつけ教室',
  hotel: 'ホテル',
  trimming: 'トリミング',
  hospital: '病院',
  products: '商品・物販',
  event: 'サービス・イベント',
}

function formatDate(str?: string) {
  if (!str) return '未設定'
  try {
    return new Date(str).toLocaleDateString('ja-JP')
  } catch {
    return str
  }
}

type FilterStatus = 'all' | 'draft' | 'pending_review' | 'approved'

export default function ShopsPage() {
  const { signOut } = useAuth()
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    const loadShops = async () => {
      try {
        const q = query(collection(db, 'shops'), orderBy('createdAt', 'desc'))
        const snap = await getDocs(q)
        setShops(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Shop))
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    void loadShops()
  }, [])

  const filtered = filter === 'all' ? shops : shops.filter(s => s.status === filter)

  const approveShop = async (shopId: string) => {
    if (!confirm('この店舗を承認しますか？')) return
    setActionLoading(shopId)
    try {
      await updateDoc(doc(db, 'shops', shopId), {
        status: 'approved',
        'license.status': 'approved',
        'license.reason': null,
        updatedAt: new Date().toISOString(),
      })
      setShops(prev => prev.map(s =>
        s.id === shopId
          ? { ...s, status: 'approved', license: s.license ? { ...s.license, status: 'approved', reason: undefined } : s.license }
          : s
      ))
    } catch (err) {
      alert('エラーが発生しました: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setActionLoading(null)
    }
  }

  const rejectShop = async (shopId: string) => {
    const reason = prompt('却下理由を入力してください（必須）')
    if (!reason) { alert('却下理由は必須です'); return }
    setActionLoading(shopId)
    try {
      await updateDoc(doc(db, 'shops', shopId), {
        status: 'draft',
        'license.status': 'rejected',
        'license.reason': reason,
        updatedAt: new Date().toISOString(),
      })
      setShops(prev => prev.map(s =>
        s.id === shopId
          ? { ...s, status: 'draft', license: s.license ? { ...s.license, status: 'rejected', reason } : s.license }
          : s
      ))
    } catch (err) {
      alert('エラーが発生しました: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-800">ウチの子 管理者画面</h1>
          <p className="text-xs text-gray-500">店舗承認管理</p>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition"
        >
          <LogOut size={16} />
          ログアウト
        </button>
      </header>

      <div className="max-w-4xl mx-auto p-6">
        {/* フィルター */}
        <div className="flex gap-2 mb-6">
          {(['all', 'draft', 'pending_review', 'approved'] as FilterStatus[]).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                filter === s
                  ? 'bg-orange-400 text-white'
                  : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s === 'all' ? 'すべて' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {/* 件数 */}
        <p className="text-sm text-gray-500 mb-4">{filtered.length} 件</p>

        {/* 一覧 */}
        {loading ? (
          <div className="text-center py-16 text-gray-400">読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">店舗がありません</div>
        ) : (
          <div className="space-y-4">
            {filtered.map(shop => {
              const canApprove = shop.license?.status === 'pending'
              const isActing = actionLoading === shop.id
              return (
                <div key={shop.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  {/* カードヘッダー */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h2 className="font-semibold text-gray-800">{shop.name || '店舗名未設定'}</h2>
                      <p className="text-xs text-gray-400 mt-0.5">ID: {shop.id.substring(0, 8)}...</p>
                    </div>
                    {shop.status && (
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[shop.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[shop.status] ?? shop.status}
                      </span>
                    )}
                  </div>

                  {/* 基本情報 */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm mb-3">
                    <div className="flex gap-2">
                      <span className="text-gray-400">カテゴリ</span>
                      <span className="text-gray-700">{(shop.categories ?? []).map(c => CATEGORY_LABELS[c] ?? c).join(', ') || '未設定'}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-gray-400">公開</span>
                      <span className="text-gray-700">{shop.isPublished ? '公開中' : '未公開'}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-gray-400">住所</span>
                      <span className="text-gray-700">{shop.address || '未設定'}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-gray-400">作成日</span>
                      <span className="text-gray-700">{formatDate(shop.createdAt)}</span>
                    </div>
                  </div>

                  {/* 動物取扱業ライセンス */}
                  <div className="bg-gray-50 rounded-lg p-3 text-sm mb-4">
                    <p className="font-medium text-gray-600 mb-2">動物取扱業登録情報</p>
                    {shop.license ? (
                      <div className="space-y-1 text-gray-700">
                        <p><span className="text-gray-400">登録番号: </span>{shop.license.registrationNumber || '未設定'}</p>
                        <p><span className="text-gray-400">事業者名: </span>{shop.license.name || '未設定'}</p>
                        <p><span className="text-gray-400">所在地: </span>{shop.license.address || '未設定'}</p>
                        <p><span className="text-gray-400">責任者: </span>{shop.license.manager || '未設定'}</p>
                        <p><span className="text-gray-400">登録日: </span>{formatDate(shop.license.registrationDate)}</p>
                        <p><span className="text-gray-400">有効期限: </span>{formatDate(shop.license.validUntil)}</p>
                        <p><span className="text-gray-400">業種区分: </span>{(shop.license.category ?? []).join(', ') || '未設定'}</p>
                        <p>
                          <span className="text-gray-400">ライセンス状態: </span>
                          <span className={
                            shop.license.status === 'approved' ? 'text-green-600 font-medium' :
                            shop.license.status === 'rejected' ? 'text-red-500 font-medium' :
                            'text-blue-600 font-medium'
                          }>
                            {shop.license.status === 'approved' ? '承認済み' : shop.license.status === 'rejected' ? '却下' : '審査中'}
                          </span>
                        </p>
                        {shop.license.reason && (
                          <p className="text-red-500"><span className="text-gray-400">却下理由: </span>{shop.license.reason}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-400">登録情報がありません</p>
                    )}
                  </div>

                  {/* アクション */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => { void approveShop(shop.id) }}
                      disabled={!canApprove || isActing}
                      className="px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      承認する
                    </button>
                    <button
                      onClick={() => { void rejectShop(shop.id) }}
                      disabled={isActing}
                      className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg transition disabled:opacity-40"
                    >
                      却下する
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
