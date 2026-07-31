import { useEffect, useState } from 'react'
import { collection, doc, getDoc, getDocs, limit, orderBy, query, type Timestamp } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { AlertTriangle, CheckCircle, Download, RefreshCw, Trash2, X } from 'lucide-react'
import { db } from '../lib/firebase'

interface FeedPost {
  id: string
  ownerId: string
  dogId?: string
  dogName?: string
  dogBreed?: string
  dogBreedSize?: number
  ownerDisplayName?: string
  imageUrl: string
  caption?: string
  checkedCount?: number
  isLate?: boolean
  postedAt?: Timestamp
}

const functions = getFunctions(undefined, 'us-central1')
const callDeletePost = httpsCallable(functions, 'adminDeletePost')

function dateText(postedAt?: Timestamp) {
  return postedAt?.toDate().toLocaleString('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }) ?? '-'
}

function ageParts(birthDate: Date) {
  const now = new Date()
  let years = now.getFullYear() - birthDate.getFullYear()
  let months = now.getMonth() - birthDate.getMonth()
  if (now.getDate() < birthDate.getDate()) months -= 1
  if (months < 0) {
    years -= 1
    months += 12
  }
  return { years: Math.max(0, years), months: Math.max(0, months) }
}

function ageDisplayText(birthDate?: Timestamp, breedSize = 1) {
  if (!birthDate) return ''
  const date = birthDate.toDate()
  const { years, months } = ageParts(date)
  let actualAge = ''
  if (years > 0) {
    actualAge = `${years}歳`
  } else if (months > 0) {
    actualAge = `${months}ヶ月`
  } else {
    const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000))
    actualAge = days > 0 ? `${days}日` : ''
  }
  if (!actualAge) return ''

  let humanAge: number
  if (years === 0) {
    humanAge = breedSize === 2 ? Math.max(1, months) : Math.max(1, Math.floor(months * 1.25))
  } else if (breedSize === 0) {
    humanAge = years === 1 ? 15 : years === 2 ? 24 : 24 + (years - 2) * 4
  } else if (breedSize === 2) {
    humanAge = years === 1 ? 12 : years === 2 ? 22 : 22 + (years - 2) * 6
  } else {
    humanAge = years === 1 ? 15 : years === 2 ? 24 : 24 + (years - 2) * 5
  }
  return `${actualAge}（${humanAge}歳）`
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('画像を取得できませんでした'))
    image.src = url
  })
}

function fittedFontSize(
  context: CanvasRenderingContext2D,
  text: string,
  baseSize: number,
  weight: number,
  maxWidth: number,
) {
  context.font = `${weight} ${baseSize}px -apple-system, BlinkMacSystemFont, sans-serif`
  const measuredWidth = context.measureText(text).width
  if (measuredWidth <= maxWidth) return baseSize
  return Math.max(baseSize * 0.65, baseSize * maxWidth / measuredWidth)
}

async function downloadBrandedPost(post: FeedPost) {
  let breed = post.dogBreed ?? ''
  let breedSize = post.dogBreedSize ?? 1
  let age = ''

  if (post.ownerId && post.dogId) {
    const dogSnap = await getDoc(doc(db, 'owners', post.ownerId, 'dogs', post.dogId))
    if (dogSnap.exists()) {
      const dog = dogSnap.data()
      breed = typeof dog.breed === 'string' ? dog.breed : breed
      breedSize = typeof dog.breedSize === 'number' ? dog.breedSize : breedSize
      age = ageDisplayText(dog.birthDate as Timestamp | undefined, breedSize)
    }
  }

  const image = await loadImage(post.imageUrl)
  const width = image.naturalWidth
  const height = image.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('画像を作成できませんでした')
  context.drawImage(image, 0, 0, width, height)

  const logoFontSize = Math.max(width * 0.045, 28)
  const baseNameFontSize = Math.max(width * 0.06, 38)
  const baseDetailFontSize = Math.max(width * 0.041, 26)
  const bottomPadding = Math.max(height * 0.025, 22)
  const horizontalPadding = Math.max(width * 0.04, 24)
  const availableTextWidth = width - horizontalPadding * 2
  const detailText = [age, breed].filter(Boolean).join('・')
  const name = post.dogName || 'うちの子'
  const nameFontSize = fittedFontSize(context, name, baseNameFontSize, 700, availableTextWidth)
  const detailFontSize = fittedFontSize(context, detailText, baseDetailFontSize, 600, availableTextWidth)

  const gradientHeight = Math.max(
    nameFontSize + detailFontSize + bottomPadding * 2.5,
    height * 0.16,
  )
  const gradient = context.createLinearGradient(0, height - gradientHeight, 0, height)
  gradient.addColorStop(0, 'rgba(0,0,0,0)')
  gradient.addColorStop(1, 'rgba(0,0,0,0.42)')
  context.fillStyle = gradient
  context.fillRect(0, height - gradientHeight, width, gradientHeight)

  const infoLift = Math.max(height * 0.025, 24)
  const detailY = height - bottomPadding - logoFontSize * 1.35 - detailFontSize * 1.25 - infoLift
  context.textBaseline = 'top'
  context.shadowColor = 'rgba(0,0,0,0.7)'
  context.shadowBlur = Math.max(width * 0.006, 3)
  context.shadowOffsetY = 1

  context.fillStyle = '#fff'
  context.font = `700 ${nameFontSize}px -apple-system, BlinkMacSystemFont, sans-serif`
  context.fillText(name, horizontalPadding, detailText ? detailY - nameFontSize * 1.2 : detailY - nameFontSize * 0.2)

  if (detailText) {
    context.fillStyle = 'rgba(255,255,255,0.9)'
    context.font = `600 ${detailFontSize}px -apple-system, BlinkMacSystemFont, sans-serif`
    context.fillText(detailText, horizontalPadding, detailY)
  }

  context.fillStyle = 'rgba(255,255,255,0.96)'
  context.font = `700 ${logoFontSize}px -apple-system, BlinkMacSystemFont, sans-serif`
  context.textAlign = 'center'
  context.fillText('PetReal.', width / 2, height - bottomPadding - logoFontSize * 1.25)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error('JPEGを作成できませんでした')), 'image/jpeg', 0.92)
  })
  const downloadURL = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = downloadURL
  anchor.download = `PetReal-${name}-${post.id}.jpg`
  anchor.click()
  URL.revokeObjectURL(downloadURL)
}

function PostModal({ post, deleting, downloading, onClose, onDelete, onDownload }: {
  post: FeedPost
  deleting: boolean
  downloading: boolean
  onClose: () => void
  onDelete: () => void
  onDownload: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-5" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-800">{post.dogName || '投稿詳細'}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{dateText(post.postedAt)}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200">
            <X size={15} className="text-gray-500" />
          </button>
        </div>

        <div className="grid grid-cols-[minmax(280px,420px)_1fr] gap-0">
          <div className="bg-black flex items-center justify-center">
            <img src={post.imageUrl} alt="" className="w-full aspect-[3/4] object-cover" />
          </div>
          <div className="p-5 flex flex-col">
            <div className="space-y-4 flex-1">
              <div>
                <p className="text-xs text-gray-400">犬</p>
                <p className="text-sm font-semibold text-gray-800">{post.dogName || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">飼い主</p>
                <p className="text-sm font-semibold text-gray-800">{post.ownerDisplayName || post.ownerId}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">コメント</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-xl px-3 py-2 mt-1 min-h-16">
                  {post.caption || 'コメントなし'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl px-3 py-2">
                  <p className="text-xs text-gray-400">チェック</p>
                  <p className="text-lg font-bold text-gray-800">{post.checkedCount ?? 0}</p>
                </div>
                <div className="bg-gray-50 rounded-xl px-3 py-2">
                  <p className="text-xs text-gray-400">状態</p>
                  <p className="text-sm font-semibold text-gray-800">{post.isLate ? '遅れ投稿' : '通常投稿'}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-400">postId</p>
                <p className="text-[11px] text-gray-500 font-mono break-all">{post.id}</p>
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <button
                onClick={onDownload}
                disabled={downloading || deleting}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-40"
              >
                <Download size={15} />
                {downloading ? '画像を作成中...' : 'ロゴ入り画像を保存'}
              </button>
              <button
                onClick={onDelete}
                disabled={deleting || downloading}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-40"
              >
                <Trash2 size={15} />
                {deleting ? '削除中...' : '投稿を削除'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PostsPage() {
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FeedPost | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  useEffect(() => {
    loadPosts()
  }, [])

  const showToast = (msg: string, type: 'ok' | 'err') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const loadPosts = async () => {
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'posts'), orderBy('postedAt', 'desc'), limit(180)))
      setPosts(snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as FeedPost)))
    } catch {
      showToast('投稿の読み込みに失敗しました', 'err')
    } finally {
      setLoading(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    setActionLoading(target.id)
    try {
      await callDeletePost({ postId: target.id })
      setPosts((prev) => prev.filter((post) => post.id !== target.id))
      setSelectedPost(null)
      setDeleteTarget(null)
      showToast('投稿を削除しました', 'ok')
    } catch {
      showToast('投稿の削除に失敗しました', 'err')
    } finally {
      setActionLoading(null)
    }
  }

  const saveBrandedImage = async (post: FeedPost) => {
    setActionLoading(`download:${post.id}`)
    try {
      await downloadBrandedPost(post)
      showToast('ロゴ入り画像を保存しました', 'ok')
    } catch {
      showToast('画像の保存に失敗しました', 'err')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-800">投稿管理</h2>
          <p className="text-xs text-gray-400 mt-0.5">{posts.length}件</p>
        </div>
        <button
          onClick={loadPosts}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-500 rounded-lg text-xs hover:bg-gray-50 transition-colors disabled:opacity-40"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          再読み込み
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">読み込み中...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">投稿はありません</div>
      ) : (
        <div className="grid grid-cols-6 gap-2">
          {posts.map((post) => (
            <button
              key={post.id}
              onClick={() => setSelectedPost(post)}
              className="relative aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden group text-left"
            >
              <img src={post.imageUrl} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-2 pt-8 pb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-white text-[11px] font-semibold truncate">{post.dogName || '犬名なし'}</p>
                <p className="text-white/75 text-[10px] truncate">{dateText(post.postedAt)}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedPost && (
        <PostModal
          post={selectedPost}
          deleting={actionLoading === selectedPost.id}
          downloading={actionLoading === `download:${selectedPost.id}`}
          onClose={() => setSelectedPost(null)}
          onDelete={() => setDeleteTarget(selectedPost)}
          onDownload={() => saveBrandedImage(selectedPost)}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">投稿を削除</h3>
                <p className="text-xs text-gray-400 mt-0.5">この操作は取り消せません</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              この投稿を本当に削除しますか？画像、コメント、チェックも削除されます。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={confirmDelete}
                disabled={actionLoading === deleteTarget.id}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 disabled:opacity-40"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl text-sm font-medium shadow-lg flex items-center gap-2 ${
          toast.type === 'ok' ? 'bg-gray-800 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.type === 'ok' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}
