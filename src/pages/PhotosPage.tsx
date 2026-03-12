import { useEffect, useState } from 'react'
import { collectionGroup, getDocs, orderBy, query, doc, updateDoc, arrayRemove, deleteDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { Trash2, FileX } from 'lucide-react'

interface DiaryPhoto {
  url: string
  diaryId: string
  diaryRef: string  // full path: owners/{uid}/dogs/{dogId}/diaries/{diaryId}
  ownerUid: string
  dogId: string
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
    const snap = await getDocs(query(collectionGroup(db, 'diaries'), orderBy('createdAt', 'desc')))
    const all: DiaryPhoto[] = []
    snap.forEach((d) => {
      const data = d.data()
      const photoUrls: string[] = data.photos ?? []
      if (photoUrls.length === 0) return
      const parts = d.ref.path.split('/')
      // owners/{uid}/dogs/{dogId}/diaries/{diaryId}
      const ownerUid = parts[1]
      const dogId = parts[3]
      photoUrls.forEach((url) => {
        all.push({
          url,
          diaryId: d.id,
          diaryRef: d.ref.path,
          ownerUid,
          dogId,
          comment: data.comment,
          photos: photoUrls,
          createdAt: data.createdAt,
        })
      })
    })
    setPhotos(all)
    setLoading(false)
  }

  // 特定の写真だけ削除（diaryのphotos配列からarrayRemove）
  const deletePhoto = async (photo: DiaryPhoto) => {
    if (!confirm('この写真を削除しますか？')) return
    setActionLoading(photo.url)
    try {
      const ref = doc(db, photo.diaryRef)
      if (photo.photos.length === 1) {
        // 写真が1枚だけならdiary自体を削除
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

  // diary丸ごと削除
  const deleteDiary = async (photo: DiaryPhoto) => {
    if (!confirm('この投稿全体を削除しますか？')) return
    setActionLoading(`diary_${photo.diaryId}`)
    try {
      await deleteDoc(doc(db, photo.diaryRef))
      setPhotos((prev) => prev.filter((p) => p.diaryId !== photo.diaryId))
      if (selected?.diaryId === photo.diaryId) setSelected(null)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">写真モデレーション</h2>
          <p className="text-sm text-gray-400 mt-0.5">{photos.length}枚</p>
        </div>
        <button onClick={load} className="text-sm text-gray-500 hover:text-gray-700 hover:underline">
          再読み込み
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">読み込み中...</div>
      ) : photos.length === 0 ? (
        <div className="text-center py-20 text-gray-400">写真がありません</div>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {photos.map((photo, i) => (
            <div
              key={`${photo.diaryId}_${i}`}
              className="relative group aspect-square bg-gray-100 rounded-xl overflow-hidden cursor-pointer"
              onClick={() => setSelected(photo)}
            >
              <img src={photo.url} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
            </div>
          ))}
        </div>
      )}

      {/* 詳細モーダル */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl overflow-hidden max-w-xl w-full shadow-2xl flex" onClick={(e) => e.stopPropagation()}>
            <img src={selected.url} alt="" className="w-48 h-48 object-cover flex-shrink-0" />
            <div className="flex-1 p-5 flex flex-col justify-between min-w-0">
              <div>
                <div className="text-xs text-gray-400 font-mono mb-1 truncate">
                  {selected.ownerUid.slice(0, 10)}... / {selected.dogId.slice(0, 10)}...
                </div>
                {selected.createdAt && (
                  <p className="text-xs text-gray-400 mb-2">
                    {selected.createdAt.toDate().toLocaleDateString('ja-JP')}
                  </p>
                )}
                {selected.comment && (
                  <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">{selected.comment}</p>
                )}
              </div>
              <div className="flex flex-col gap-2 mt-4">
                <button
                  onClick={() => deletePhoto(selected)}
                  disabled={!!actionLoading}
                  className="flex items-center justify-center gap-2 py-2 border border-red-200 text-red-500 rounded-xl text-sm hover:bg-red-50 disabled:opacity-40 transition-colors"
                >
                  <Trash2 size={13} />
                  この写真を削除
                </button>
                <button
                  onClick={() => deleteDiary(selected)}
                  disabled={!!actionLoading}
                  className="flex items-center justify-center gap-2 py-2 bg-red-500 text-white rounded-xl text-sm hover:bg-red-600 disabled:opacity-40 transition-colors"
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
