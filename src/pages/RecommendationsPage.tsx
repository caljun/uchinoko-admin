import { useEffect, useState } from 'react'
import { collection, getDocs, orderBy, query, doc, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { Plus, Pencil, Trash2, ExternalLink, TrendingUp, Eye, EyeOff } from 'lucide-react'

const SEED_DATA = [
  { id: 'fida-rope-toy-92cm', title: 'Fida 犬用ロープおもちゃ 92cm 5ノット', description: '天然コットン100%の頑丈なロープおもちゃ。引っ張り遊び・デンタルケア・ストレス解消に。大型犬・中型犬向け。', url: 'https://www.amazon.co.jp/dp/B08XLMSY47?tag=uchinoko2026-22', imageUrl: 'https://m.media-amazon.com/images/I/81jg2YzJTGL._AC_SL1500_.jpg', category: 'goods', tapCount: 0, isActive: true, order: 1 },
  { id: 'rope-toy-xxl-6knot', title: 'XXL ロープおもちゃ 100cm 6ノット', description: 'ほぼ壊れない100%コットン製ロープおもちゃ。引っ張り遊び・ストレス解消に。大型犬向け。', url: 'https://www.amazon.co.jp/dp/B0D53YVPPM?tag=uchinoko2026-22', imageUrl: 'https://m.media-amazon.com/images/I/713dD43JzML._AC_SL1500_.jpg', category: 'goods', tapCount: 0, isActive: true, order: 2 },
  { id: 'nutro-supremo-small-adult', title: 'ニュートロ シュプレモ 小型犬用 成犬用 3kg', description: '厳選自然素材・香料着色料無添加のドライフード。小粒で食べやすく、総合栄養食。', url: 'https://www.amazon.co.jp/dp/B07D6GXJQQ?tag=uchinoko2026-22', imageUrl: 'https://m.media-amazon.com/images/I/61+Ag5jUKYL._AC_SL1024_.jpg', category: 'food', tapCount: 0, isActive: true, order: 3 },
  { id: 'nutro-supremo-puppy', title: 'ニュートロ シュプレモ 子犬用 全犬種用 チキン 3kg', description: '厳選自然素材・香料着色料無添加。パピー・妊娠期/授乳期の母犬にも対応した総合栄養食。', url: 'https://amzn.to/4rmcx0f', imageUrl: 'https://m.media-amazon.com/images/I/61Q8AMJzYpL._AC_SL1346_.jpg', category: 'food', tapCount: 0, isActive: true, order: 4 },
  { id: 'happydog-lamb-rice-medium-large', title: 'ハッピードッグ 消化器ケア ラム＆ライス 4kg', description: 'ドイツ産ヒューマングレード・グルテンフリー。中型・大型犬の成犬〜シニア向け消化器ケアフード。', url: 'https://amzn.to/46TfRc7', imageUrl: 'https://m.media-amazon.com/images/I/714X118cv1L._AC_SL1500_.jpg', category: 'food', tapCount: 0, isActive: true, order: 5 },
  { id: 'wickedpup-diaper-liner-l', title: 'WICKEDPUP 犬用おむつライナー 100枚 Lサイズ', description: '男の子のマナーベルトパッド・女の子の生理用ナプキン兼用。しっかり吸収で安心。', url: 'https://amzn.to/4s5BoH6', imageUrl: 'https://m.media-amazon.com/images/I/616wyLGcUDL._AC_SL1500_.jpg', category: 'goods', tapCount: 0, isActive: true, order: 6 },
  { id: 'iris-pet-carrier-small', title: 'アイリスオーヤマ ペットキャリー 超小型犬・猫用', description: '軽量コンパクトで持ち運びしやすいキャリー。病院の外出に。幅29×奥行46×高さ28.5cm。', url: 'https://amzn.to/40ZQzFE', imageUrl: 'https://m.media-amazon.com/images/I/61YRi9aFr4L._AC_SL1000_.jpg', category: 'goods', tapCount: 0, isActive: true, order: 7 },
  { id: 'happydog-lamb-rice-small', title: 'ハッピードッグ ミニ 消化器ケア ラム＆ライス 4kg', description: 'ドイツ産ヒューマングレード・グルテンフリー。小型犬の成犬〜シニア向け消化器ケアフード。', url: 'https://amzn.to/4syU7dH', imageUrl: 'https://m.media-amazon.com/images/I/81W7mWE04vL._AC_SL1500_.jpg', category: 'food', tapCount: 0, isActive: true, order: 8 },
  { id: 'lion-petkiss-dental-gum', title: 'ライオン PETKISS 食後の歯みがきガム やわらか 130g×2袋', description: '食後に噛むだけで歯の汚れをケア。やわらかタイプで食べやすい。毎日の口腔ケアに。', url: 'https://amzn.to/4biRPbP', imageUrl: 'https://m.media-amazon.com/images/I/71Y003-DKAL._AC_SL1000_.jpg', category: 'goods', tapCount: 0, isActive: true, order: 9 },
  { id: 'ip-osp-paw-shampoo', title: '肉球おてケアシャンプー 150ml', description: 'お散歩後の足洗いに。拭くだけ洗い流し不要。国産・無添加・オーガニック。舐めても安心。獣医師推奨。', url: 'https://amzn.to/46UOVJ3', imageUrl: 'https://m.media-amazon.com/images/I/71XaDywvgRL._AC_SL1500_.jpg', category: 'grooming', tapCount: 0, isActive: true, order: 10 },
  { id: 'sanmori-slicker-brush', title: 'SanMori ヒーリングブラシ スリッカーブラシ', description: 'ワンタッチで抜け毛が取れる。マッサージしながら被毛ケア。長毛・短毛どちらにも対応。', url: 'https://amzn.to/4bH7PVp', imageUrl: 'https://m.media-amazon.com/images/I/61Bb8vO0EpL._AC_SL1500_.jpg', category: 'grooming', tapCount: 0, isActive: true, order: 11 },
  { id: 'kamitsuki-saurus-toy-small', title: 'かみつきザウルス 噛むおもちゃ ティラノザウルス', description: '音が出るぬいぐるみおもちゃ。ストレス・運動不足解消に。小型犬向け。', url: 'https://amzn.to/4sYSCGf', imageUrl: 'https://m.media-amazon.com/images/I/61y0reTWawL._AC_SL1080_.jpg', category: 'goods', tapCount: 0, isActive: true, order: 12 },
  { id: 'barrier-suppli-dog-adult-senior', title: 'バリアサプリ ドッグ アダルト・シニア 90g', description: '成犬・シニア犬向けサプリメント。毎日の健康維持をサポート。', url: 'https://amzn.to/4s8a62O', imageUrl: 'https://m.media-amazon.com/images/I/51XxRPjLPrL._AC_SL1200_.jpg', category: 'goods', tapCount: 0, isActive: true, order: 13 },
  { id: 'mogwan-chicken-salmon', title: 'モグワン ドッグフード チキン＆サーモン 1.8kg', description: '着色料・香料不使用のナチュラルドッグフード。シニア犬の健康維持におすすめ。', url: 'https://amzn.to/3Pe5v0d', imageUrl: 'https://m.media-amazon.com/images/I/61FDATR3MeL._AC_SL1500_.jpg', category: 'food', tapCount: 0, isActive: true, order: 14 },
]

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

  const seedData = async () => {
    if (!confirm('初期データを投入しますか？（既存のデータは上書きされます）')) return
    const batch = writeBatch(db)
    for (const { id, ...data } of SEED_DATA) {
      batch.set(doc(db, 'recommendations', id), { ...data, createdAt: serverTimestamp() })
    }
    await batch.commit()
    await load()
  }

  const activeCount = items.filter((i) => i.isActive).length
  const totalTaps = items.reduce((sum, i) => sum + (i.tapCount ?? 0), 0)

  return (
    <div className="p-6 max-w-4xl">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-800">おすすめ商品</h2>
          <p className="text-xs text-gray-400 mt-0.5">{items.length}件（表示中: {activeCount}件）</p>
        </div>
        <div className="flex items-center gap-2">
          {items.length === 0 && (
            <button onClick={seedData} className="px-3 py-1.5 border border-gray-200 text-gray-500 rounded-lg text-xs hover:bg-gray-50 transition-colors">
              初期データ投入
            </button>
          )}
          <button
            onClick={() => setModalItem(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 transition-colors"
          >
            <Plus size={13} />
            追加
          </button>
        </div>
      </div>

      {/* サマリー */}
      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-400">総商品数</p>
            <p className="text-2xl font-bold text-gray-800 mt-0.5">{items.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-400">表示中</p>
            <p className="text-2xl font-bold text-green-600 mt-0.5">{activeCount}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-400">累計タップ</p>
            <p className="text-2xl font-bold text-orange-500 mt-0.5">{totalTaps}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">読み込み中...</div>
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => (
            <div
              key={item.id}
              className={`bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3 transition-opacity ${!item.isActive ? 'opacity-40' : ''}`}
            >
              {/* 順序 */}
              <span className="text-xs text-gray-300 w-5 text-right flex-shrink-0 font-mono">{item.order ?? 0}</span>

              {/* サムネ */}
              <div className="flex-shrink-0 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden" style={{ width: 40, height: 40 }}>
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" style={{ width: 40, height: 40, objectFit: 'contain', padding: 2 }} />
                ) : (
                  <div style={{ width: 40, height: 40 }} className="flex items-center justify-center text-gray-300 text-base">🛍</div>
                )}
              </div>

              {/* 情報 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-800 truncate leading-tight">{item.title}</p>
                  {item.category && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-orange-50 text-orange-400 rounded-full flex-shrink-0 border border-orange-100">{item.category}</span>
                  )}
                </div>
                {item.description && (
                  <p className="text-[11px] text-gray-400 mt-0.5 truncate">{item.description}</p>
                )}
              </div>

              {/* タップ数 */}
              <span className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0 w-16 justify-end">
                <TrendingUp size={10} className="text-orange-400" />
                {item.tapCount ?? 0}
              </span>

              {/* アクション */}
              <div className="flex items-center gap-0.5 flex-shrink-0 border-l border-gray-100 pl-2 ml-1">
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-300 hover:text-blue-400 transition-colors">
                  <ExternalLink size={13} />
                </a>
                <button onClick={() => toggleActive(item)} disabled={actionLoading === item.id} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-300 hover:text-orange-400 transition-colors disabled:opacity-40">
                  {item.isActive ? <Eye size={13} /> : <EyeOff size={13} />}
                </button>
                <button onClick={() => setModalItem(item)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-300 hover:text-gray-600 transition-colors">
                  <Pencil size={13} />
                </button>
                <button onClick={() => deleteItem(item)} disabled={actionLoading === item.id} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-300 hover:text-red-400 transition-colors disabled:opacity-40">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-sm">まだ商品がありません</p>
              <button onClick={() => setModalItem(null)} className="mt-3 text-xs text-orange-500 hover:underline">追加する</button>
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
