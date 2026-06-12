import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore'
import { AlertTriangle, CheckCircle, ExternalLink, Flag, RefreshCw, Trash2 } from 'lucide-react'
import { db } from '../lib/firebase'

type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed'

interface ReportItem {
  id: string
  reporterId: string
  postId: string
  postOwnerId?: string
  targetType: 'post' | 'comment'
  commentId?: string
  commentOwnerId?: string
  reason: string
  status: ReportStatus
  createdAt?: { toDate: () => Date }
  post?: {
    imageUrl?: string
    caption?: string
    dogName?: string
    ownerDisplayName?: string
  } | null
  reporterName?: string
}

const statusLabels: Record<ReportStatus, string> = {
  open: '未対応',
  reviewing: '確認中',
  resolved: '対応済み',
  dismissed: '問題なし',
}

const reasonLabels: Record<string, string> = {
  inappropriate: '不適切な内容',
  spam: 'スパム・迷惑行為',
}

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  useEffect(() => {
    loadReports()
  }, [])

  const showToast = (msg: string, type: 'ok' | 'err') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const loadReports = async () => {
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc')))
      const items = await Promise.all(snap.docs.map(async (reportDoc) => {
        const data = reportDoc.data()
        const postId = String(data.postId ?? '')
        const reporterId = String(data.reporterId ?? '')
        const postOwnerId = data.postOwnerId ? String(data.postOwnerId) : undefined

        const [postSnap, reporterSnap] = await Promise.all([
          postId ? getDoc(doc(db, 'posts', postId)) : Promise.resolve(null),
          reporterId ? getDoc(doc(db, 'owners', reporterId)) : Promise.resolve(null),
        ])

        const postData = postSnap && postSnap.exists() ? postSnap.data() : null
        const reporterData = reporterSnap && reporterSnap.exists() ? reporterSnap.data() : null

        return {
          id: reportDoc.id,
          reporterId,
          postId,
          postOwnerId,
          targetType: data.targetType === 'comment' ? 'comment' : 'post',
          commentId: data.commentId ? String(data.commentId) : undefined,
          commentOwnerId: data.commentOwnerId ? String(data.commentOwnerId) : undefined,
          reason: String(data.reason ?? ''),
          status: (data.status ?? 'open') as ReportStatus,
          createdAt: data.createdAt,
          post: postData ? {
            imageUrl: postData.imageUrl,
            caption: postData.caption,
            dogName: postData.dogName,
            ownerDisplayName: postData.ownerDisplayName,
          } : null,
          reporterName: reporterData?.displayName ?? reporterData?.name ?? reporterData?.email,
        } satisfies ReportItem
      }))
      setReports(items)
    } catch {
      showToast('通報の読み込みに失敗しました', 'err')
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (report: ReportItem, status: ReportStatus) => {
    setActionLoading(report.id)
    try {
      await updateDoc(doc(db, 'reports', report.id), {
        status,
        handledAt: new Date(),
      })
      setReports((prev) => prev.map((item) => item.id === report.id ? { ...item, status } : item))
      showToast('ステータスを更新しました', 'ok')
    } catch {
      showToast('ステータス更新に失敗しました', 'err')
    } finally {
      setActionLoading(null)
    }
  }

  const deleteTarget = async (report: ReportItem) => {
    const label = report.targetType === 'comment' ? 'コメント' : '投稿'
    if (!confirm(`対象の${label}を削除しますか？`)) return

    setActionLoading(report.id)
    try {
      if (report.targetType === 'comment') {
        if (!report.commentId) throw new Error('commentId is missing')
        await deleteDoc(doc(db, 'posts', report.postId, 'comments', report.commentId))
      } else {
        await deleteDoc(doc(db, 'posts', report.postId))
      }
      await updateDoc(doc(db, 'reports', report.id), {
        status: 'resolved',
        handledAt: new Date(),
        action: report.targetType === 'comment' ? 'comment_deleted' : 'post_deleted',
      })
      setReports((prev) => prev.map((item) => item.id === report.id ? { ...item, status: 'resolved' } : item))
      showToast(`${label}を削除しました`, 'ok')
    } catch {
      showToast(`${label}の削除に失敗しました`, 'err')
    } finally {
      setActionLoading(null)
    }
  }

  const openCount = reports.filter((report) => report.status === 'open').length
  const resolvedCount = reports.filter((report) => report.status === 'resolved').length
  const filtered = useMemo(() => reports, [reports])

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-800">通報管理</h2>
          <p className="text-xs text-gray-400 mt-0.5">{reports.length}件</p>
        </div>
        <button
          onClick={loadReports}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-500 rounded-lg text-xs hover:bg-gray-50 transition-colors disabled:opacity-40"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          再読み込み
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
          <p className="text-xs text-gray-400">総通報数</p>
          <p className="text-2xl font-bold text-gray-800 mt-0.5">{reports.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
          <p className="text-xs text-gray-400">未対応</p>
          <p className="text-2xl font-bold text-red-500 mt-0.5">{openCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
          <p className="text-xs text-gray-400">対応済み</p>
          <p className="text-2xl font-bold text-green-600 mt-0.5">{resolvedCount}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">読み込み中...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">通報はありません</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((report) => (
            <div key={report.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <div className="flex gap-4 p-4">
                <div className="w-24 h-32 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {report.post?.imageUrl ? (
                    <img src={report.post.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Flag size={24} className="text-gray-300" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${
                          report.status === 'open' ? 'bg-red-50 text-red-600' :
                          report.status === 'resolved' ? 'bg-green-50 text-green-600' :
                          report.status === 'dismissed' ? 'bg-gray-100 text-gray-500' :
                          'bg-yellow-50 text-yellow-600'
                        }`}>
                          {statusLabels[report.status] ?? report.status}
                        </span>
                        <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-orange-50 text-orange-600">
                          {report.targetType === 'comment' ? 'コメント' : '投稿'}
                        </span>
                      </div>
                      <h3 className="font-bold text-gray-800 mt-2">
                        {reasonLabels[report.reason] ?? report.reason}
                      </h3>
                      <p className="text-xs text-gray-400 mt-1">
                        通報者: {report.reporterName ?? report.reporterId.slice(0, 8)}
                        {report.createdAt && ` ・ ${report.createdAt.toDate().toLocaleString('ja-JP')}`}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-sm font-medium text-gray-800">
                      {report.post?.dogName ?? '投稿なし'}
                    </p>
                    {report.post?.caption && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{report.post.caption}</p>
                    )}
                    <p className="text-[10px] text-gray-400 font-mono mt-1">post: {report.postId}</p>
                    {report.commentId && (
                      <p className="text-[10px] text-gray-400 font-mono">comment: {report.commentId}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    <button
                      onClick={() => updateStatus(report, 'reviewing')}
                      disabled={!!actionLoading}
                      className="px-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                    >
                      確認中
                    </button>
                    <button
                      onClick={() => updateStatus(report, 'dismissed')}
                      disabled={!!actionLoading}
                      className="flex items-center gap-1 px-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                    >
                      <CheckCircle size={13} />
                      問題なし
                    </button>
                    <button
                      onClick={() => deleteTarget(report)}
                      disabled={!!actionLoading || !report.post}
                      className="flex items-center gap-1 px-3 py-2 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-40"
                    >
                      <Trash2 size={13} />
                      対象を削除
                    </button>
                    {report.post?.imageUrl && (
                      <a
                        href={report.post.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 px-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                      >
                        <ExternalLink size={13} />
                        画像を開く
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-5 right-5 px-4 py-3 rounded-xl shadow-lg text-sm text-white flex items-center gap-2 ${
          toast.type === 'ok' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {toast.type === 'ok' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}
