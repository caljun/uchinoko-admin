import { useEffect, useState } from 'react'
import { collection, getDocs, limit, orderBy, query, type Timestamp } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { AlertTriangle, CheckCircle, RefreshCw, Trash2, X } from 'lucide-react'
import { db } from '../lib/firebase'

interface FeedPost {
  id: string
  ownerId: string
  dogId?: string
  dogName?: string
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

function PostModal({ post, deleting, onClose, onDelete }: {
  post: FeedPost
  deleting: boolean
  onClose: () => void
  onDelete: () => void
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

            <button
              onClick={onDelete}
              disabled={deleting}
              className="mt-6 flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-40"
            >
              <Trash2 size={15} />
              {deleting ? '削除中...' : '投稿を削除'}
            </button>
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
          onClose={() => setSelectedPost(null)}
          onDelete={() => setDeleteTarget(selectedPost)}
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
