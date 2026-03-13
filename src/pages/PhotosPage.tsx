import { useEffect, useState } from 'react'
import { collectionGroup, getDocs, orderBy, query, doc, updateDoc, arrayRemove, deleteDoc, collection } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { Trash2, FileX, RefreshCw, User, X } from 'lucide-react'

interface DiaryPhoto {
  url: string
  diaryId: string
  diaryRef: string
  ownerUid: string
  dogId: string
  ownerName?: string
  comment?: string
  photos: string[]
  createdAt?: { toDate: () => Date }
}

export default function PhotosPage() {
  const [photos, setPhotos] = useState<DiaryPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<DiaryPhoto | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)

    // オーナー名を一括取得
    const ownersSnap = await getDocs(collection(db, 'owners'))
    const ownerMap: Record<string, string> = {}
    ownersSnap.forEach((d) => {
      const data = d.data()
      ownerMap[d.id] = data.displayName ?? data.name ?? data.email ?? d.id.slice(0, 8)
    })

    const snap = await getDocs(query(collectionGroup(db, 'diaries'), orderBy('createdAt', 'desc')))
    const all: DiaryPhoto[] = []
    snap.forEach((d) => {
      const data = d.data()
      const photoUrls: string[] = data.photos ?? []
      if (photoUrls.length === 0) return
      const parts = d.ref.path.split('/')
      const ownerUid = parts[1]
      const dogId = parts[3]
      photoUrls.forEach((url) => {
        all.push({
          url,
          diaryId: d.id,
          diaryRef: d.ref.path,
          ownerUid,
          dogId,
          ownerName: ownerMap[ownerUid],
          comment: data.comment,
          photos: photoUrls,
          createdAt: data.createdAt,
        })
      })
    })
    setPhotos(all)
    setLoading(false)
  }

  const deletePhoto = async (photo: DiaryPhoto) => {
    if (!confirm('この写真を削除しますか？')) return
    setActionLoading(photo.url)
    try {
      const ref = doc(db, photo.diaryRef)
      if (photo.photos.length === 1) {
        await deleteDoc(ref)
      } else {
        await updateDoc(ref, { photos: arrayRemove(photo.url) })
      }
      setPhotos((prev) => prev.filter((p) => p.url !== photo.url))
      if (selected?.url === photo.url) setSelected(null)
    } finally {
      setActionLoading(null)
    }
  }

  const deleteDiary = async (photo: DiaryPhoto) => {
    if (!confirm('この投稿全体（写真をすべて）削除しますか？')) return
    setActionLoading(`diary_${photo.diaryId}`)
    try {
      await deleteDoc(doc(db, photo.diaryRef))
      setPhotos((prev) => prev.filter((p) => p.diaryId !== photo.diaryId))
      if (selected?.diaryId === photo.diaryId) setSelected(null)
    } finally {
      setActionLoading(null)
    }
  }

  // ユニークオーナー数
  const uniqueOwners = new Set(photos.map((p) => p.ownerUid)).size

  return (
    <div className="p-6 max-w-5xl">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-800">写真モデレーション</h2>
          <p className="text-xs text-gray-400 mt-0.5">{photos.length}枚 / {uniqueOwners}人</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-500 rounded-lg text-xs hover:bg-gray-50 transition-colors disabled:opacity-40"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          再読み込み
        </button>
      </div>

      {/* サマリー */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-400">総写真数</p>
            <p className="text-2xl font-bold text-gray-800 mt-0.5">{photos.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-400">投稿ユーザー数</p>
            <p className="text-2xl font-bold text-orange-500 mt-0.5">{uniqueOwners}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">読み込み中...</div>
      ) : photos.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">写真がありません</div>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {photos.map((photo, i) => (
            <div
              key={`${photo.diaryId}_${i}`}
              className="relative group aspect-square bg-gray-100 rounded-xl overflow-hidden cursor-pointer"
              onClick={() => setSelected(photo)}
            >
              <img src={photo.url} alt="" className="w-full h-full object-cover" />
              {/* オーナー名オーバーレイ */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-white text-[10px] truncate font-medium">{photo.ownerName ?? photo.ownerUid.slice(0, 8)}</p>
              </div>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
            </div>
          ))}
        </div>
      )}

      {/* 詳細モーダル */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-2xl overflow-hidden max-w-lg w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 画像 */}
            <div className="relative bg-black aspect-video flex items-center justify-center">
              <img src={selected.url} alt="" className="max-h-64 max-w-full object-contain" />
              <button
                onClick={() => setSelected(null)}
                className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            {/* 情報 */}
            <div className="p-5">
              {/* ユーザー情報 */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <User size={13} className="text-orange-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{selected.ownerName ?? '不明なユーザー'}</p>
                  <p className="text-[10px] text-gray-400 font-mono">{selected.ownerUid.slice(0, 16)}...</p>
                </div>
              </div>
              {/* 日付 */}
              {selected.createdAt && (
                <p className="text-xs text-gray-400 mb-2">
                  {selected.createdAt.toDate().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              )}
              {/* コメント */}
              {selected.comment && (
                <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg px-3 py-2 mb-4 line-clamp-3">{selected.comment}</p>
              )}
              {/* 同じ投稿の写真枚数 */}
              {selected.photos.length > 1 && (
                <p className="text-xs text-gray-400 mb-4">この投稿に {selected.photos.length} 枚の写真があります</p>
              )}
              {/* アクション */}
              <div className="flex gap-2">
                <button
                  onClick={() => deletePhoto(selected)}
                  disabled={!!actionLoading}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-red-200 text-red-500 rounded-xl text-sm hover:bg-red-50 disabled:opacity-40 transition-colors"
                >
                  <Trash2 size={13} />
                  この写真を削除
                </button>
                <button
                  onClick={() => deleteDiary(selected)}
                  disabled={!!actionLoading}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red-500 text-white rounded-xl text-sm hover:bg-red-600 disabled:opacity-40 transition-colors"
                >
                  <FileX size={13} />
                  投稿ごと削除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
