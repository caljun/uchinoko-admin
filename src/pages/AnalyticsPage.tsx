import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, Timestamp } from 'firebase/firestore'
import { Medal, RefreshCw, UserCheck, Users } from 'lucide-react'
import { db } from '../lib/firebase'

interface AnalyticsOwner {
  id: string
  displayName?: string
  name?: string
  email?: string
  createdAt?: Timestamp
}

interface AnalyticsPost {
  id: string
  ownerId?: string
  postedAt?: Timestamp
}

function StatCard({ label, value, description, icon: Icon }: {
  label: string
  value: number
  description: string
  icon: typeof Users
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-4 text-4xl font-bold tracking-tight text-gray-800">
            {value.toLocaleString()}<span className="ml-1.5 text-sm font-medium text-gray-400">人</span>
          </p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
          <Icon size={20} />
        </div>
      </div>
      <p className="mt-4 text-xs leading-5 text-gray-400">{description}</p>
    </div>
  )
}

export default function AnalyticsPage() {
  const [owners, setOwners] = useState<AnalyticsOwner[]>([])
  const [posts, setPosts] = useState<AnalyticsPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [ownerSnap, postSnap] = await Promise.all([
        getDocs(collection(db, 'owners')),
        getDocs(collection(db, 'posts')),
      ])
      setOwners(ownerSnap.docs.map((item) => ({ id: item.id, ...item.data() } as AnalyticsOwner)))
      setPosts(postSnap.docs.map((item) => ({ id: item.id, ...item.data() } as AnalyticsPost)))
    } catch {
      setError('分析データの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const metrics = useMemo(() => {
    const postCounts = new Map<string, number>()
    posts.forEach((post) => {
      if (!post.ownerId) return
      postCounts.set(post.ownerId, (postCounts.get(post.ownerId) ?? 0) + 1)
    })

    const ownerMap = new Map(owners.map((owner) => [owner.id, owner]))
    const ranking = [...postCounts.entries()]
      .map(([ownerId, count]) => ({ ownerId, count, owner: ownerMap.get(ownerId) }))
      .sort((left, right) => right.count - left.count)

    return {
      totalUsers: owners.length,
      postedUsers: postCounts.size,
      totalPosts: posts.length,
      ranking,
    }
  }, [owners, posts])

  return (
    <div className="max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">分析</h2>
          <p className="mt-0.5 text-xs text-gray-400">ユーザー数と投稿状況</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          再読み込み
        </button>
      </div>

      {error && <div className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-500">{error}</div>}

      {loading ? (
        <div className="py-24 text-center text-sm text-gray-400">集計中...</div>
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-2">
            <StatCard
              label="総ユーザー数"
              value={metrics.totalUsers}
              description="現在登録されているすべてのユーザー"
              icon={Users}
            />
            <StatCard
              label="投稿したことのあるユーザー"
              value={metrics.postedUsers}
              description={`全ユーザーの${metrics.totalUsers > 0 ? ((metrics.postedUsers / metrics.totalUsers) * 100).toFixed(1) : '0.0'}%`}
              icon={UserCheck}
            />
          </div>

          <div className="mt-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-500"><Medal size={18} /></div>
                <div><p className="text-sm font-bold text-gray-700">ユーザー投稿ランキング</p><p className="mt-0.5 text-xs text-gray-400">累計投稿数が多い順</p></div>
              </div>
              <p className="text-xs text-gray-400">全{metrics.totalPosts.toLocaleString()}投稿</p>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr>
                    <th className="w-16 px-4 py-3 text-center text-xs font-medium text-gray-500">順位</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">ユーザー</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">投稿数</th>
                    <th className="w-36 px-4 py-3 text-right text-xs font-medium text-gray-500">全投稿の割合</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {metrics.ranking.map((item, index) => {
                    const name = item.owner?.displayName || item.owner?.name || '名前なし'
                    const share = metrics.totalPosts > 0 ? (item.count / metrics.totalPosts) * 100 : 0
                    return (
                      <tr key={item.ownerId} className="hover:bg-gray-50/70">
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${index === 0 ? 'bg-amber-100 text-amber-600' : index === 1 ? 'bg-gray-200 text-gray-600' : index === 2 ? 'bg-orange-100 text-orange-700' : 'text-gray-400'}`}>{index + 1}</span>
                        </td>
                        <td className="px-4 py-3"><p className="font-semibold text-gray-700">{name}</p><p className="mt-0.5 text-xs text-gray-400">{item.owner?.email || item.ownerId}</p></td>
                        <td className="px-4 py-3 text-right font-bold text-gray-700">{item.count.toLocaleString()}件</td>
                        <td className="px-4 py-3 text-right text-xs text-gray-500">{share.toFixed(1)}%</td>
                      </tr>
                    )
                  })}
                  {metrics.ranking.length === 0 && <tr><td colSpan={4} className="py-12 text-center text-sm text-gray-400">投稿データがありません</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
