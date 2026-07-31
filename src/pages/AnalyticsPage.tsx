import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, orderBy, query, Timestamp, where } from 'firebase/firestore'
import { BarChart3, Clock3, RefreshCw, Users } from 'lucide-react'
import { db } from '../lib/firebase'

interface AnalyticsPost {
  id: string
  ownerId?: string
  postedAt?: Timestamp
}

type RangeDays = 7 | 30 | 90

const JST_OFFSET_MS = 9 * 60 * 60 * 1000
const weekdayLabels = ['日', '月', '火', '水', '木', '金', '土']

function jstDate(date: Date) {
  return new Date(date.getTime() + JST_OFFSET_MS)
}

function jstDateKey(date: Date) {
  return jstDate(date).toISOString().slice(0, 10)
}

function startOfTodayJST() {
  const shifted = jstDate(new Date())
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - JST_OFFSET_MS
}

function StatCard({ label, value, suffix, icon: Icon }: {
  label: string
  value: string
  suffix?: string
  icon: typeof BarChart3
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-400">{label}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
          <Icon size={17} />
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-800">
        {value}<span className="ml-1 text-xs font-medium text-gray-400">{suffix}</span>
      </p>
    </div>
  )
}

function BarRow({ label, value, max, suffix = '件' }: {
  label: string
  value: number
  max: number
  suffix?: string
}) {
  const width = max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0
  return (
    <div className="grid grid-cols-[44px_1fr_58px] items-center gap-3">
      <p className="text-right text-xs font-medium text-gray-500">{label}</p>
      <div className="h-5 overflow-hidden rounded-md bg-gray-100">
        <div className="h-full rounded-md bg-orange-400 transition-all" style={{ width: `${width}%` }} />
      </div>
      <p className="text-right text-xs tabular-nums text-gray-500">{value.toLocaleString()}{suffix}</p>
    </div>
  )
}

export default function AnalyticsPage() {
  const [posts, setPosts] = useState<AnalyticsPost[]>([])
  const [rangeDays, setRangeDays] = useState<RangeDays>(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPosts = async () => {
    setLoading(true)
    setError(null)
    try {
      const from = startOfTodayJST() - (rangeDays - 1) * 86_400_000
      const snap = await getDocs(query(
        collection(db, 'posts'),
        where('postedAt', '>=', Timestamp.fromDate(new Date(from))),
        orderBy('postedAt', 'desc'),
      ))
      setPosts(snap.docs.map((item) => ({ id: item.id, ...item.data() } as AnalyticsPost)))
    } catch {
      setError('投稿データの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPosts()
  }, [rangeDays])

  const analytics = useMemo(() => {
    const todayStart = startOfTodayJST()
    const from = todayStart - (rangeDays - 1) * 86_400_000
    const filtered = posts.filter((post) => {
      const time = post.postedAt?.toDate().getTime()
      return time !== undefined && time >= from
    })

    const hours = Array.from({ length: 24 }, () => 0)
    const weekdays = Array.from({ length: 7 }, () => 0)
    const dailyMap = new Map<string, number>()
    const owners = new Set<string>()

    for (const post of filtered) {
      if (!post.postedAt) continue
      const shifted = jstDate(post.postedAt.toDate())
      hours[shifted.getUTCHours()] += 1
      weekdays[shifted.getUTCDay()] += 1
      const key = shifted.toISOString().slice(0, 10)
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + 1)
      if (post.ownerId) owners.add(post.ownerId)
    }

    const daily = Array.from({ length: rangeDays }, (_, index) => {
      const date = new Date(todayStart - (rangeDays - 1 - index) * 86_400_000)
      const key = jstDateKey(date)
      return { key, label: `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}`, value: dailyMap.get(key) ?? 0 }
    })

    return {
      total: filtered.length,
      ownerCount: owners.size,
      averagePerOwner: owners.size > 0 ? filtered.length / owners.size : 0,
      averagePerDay: filtered.length / rangeDays,
      hours,
      weekdays,
      daily,
    }
  }, [posts, rangeDays])

  const maxHour = Math.max(...analytics.hours, 1)
  const maxWeekday = Math.max(...analytics.weekdays, 1)
  const maxDaily = Math.max(...analytics.daily.map((item) => item.value), 1)

  return (
    <div className="max-w-7xl p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">利用状況</h2>
          <p className="mt-0.5 text-xs text-gray-400">投稿日時は日本時間で集計</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 bg-white p-1">
            {([7, 30, 90] as RangeDays[]).map((days) => (
              <button
                key={days}
                onClick={() => setRangeDays(days)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  rangeDays === days ? 'bg-orange-500 text-white' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {days}日
              </button>
            ))}
          </div>
          <button
            onClick={loadPosts}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            再読み込み
          </button>
        </div>
      </div>

      {error && <div className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-500">{error}</div>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="投稿数" value={analytics.total.toLocaleString()} suffix="件" icon={BarChart3} />
        <StatCard label="投稿したユーザー" value={analytics.ownerCount.toLocaleString()} suffix="人" icon={Users} />
        <StatCard label="1人あたり" value={analytics.averagePerOwner.toFixed(1)} suffix="件" icon={Users} />
        <StatCard label="1日平均" value={analytics.averagePerDay.toFixed(1)} suffix="件" icon={Clock3} />
      </div>

      {loading ? (
        <div className="py-24 text-center text-sm text-gray-400">集計中...</div>
      ) : (
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-5">
              <h3 className="text-sm font-bold text-gray-800">時間帯別投稿数</h3>
              <p className="mt-0.5 text-xs text-gray-400">0時〜23時（日本時間）</p>
            </div>
            <div className="grid gap-x-6 gap-y-2.5 md:grid-cols-2">
              {analytics.hours.map((value, hour) => (
                <BarRow key={hour} label={`${hour}時`} value={value} max={maxHour} />
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-5">
              <h3 className="text-sm font-bold text-gray-800">曜日別投稿数</h3>
              <p className="mt-0.5 text-xs text-gray-400">選択期間内の曜日ごとの合計</p>
            </div>
            <div className="space-y-3">
              {analytics.weekdays.map((value, weekday) => (
                <BarRow key={weekday} label={weekdayLabels[weekday]} value={value} max={maxWeekday} />
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm xl:col-span-2">
            <div className="mb-5">
              <h3 className="text-sm font-bold text-gray-800">日別投稿数</h3>
              <p className="mt-0.5 text-xs text-gray-400">直近{rangeDays}日間の推移</p>
            </div>
            <div className="flex h-64 items-end gap-1 overflow-x-auto border-b border-gray-100 pb-1">
              {analytics.daily.map((item, index) => {
                const height = item.value > 0 ? Math.max((item.value / maxDaily) * 100, 3) : 0
                const showLabel = rangeDays === 7 || index % (rangeDays === 30 ? 3 : 9) === 0 || index === analytics.daily.length - 1
                return (
                  <div key={item.key} className="group flex h-full min-w-4 flex-1 flex-col justify-end" title={`${item.key}: ${item.value}件`}>
                    <div className="relative flex flex-1 items-end">
                      <div className="w-full rounded-t bg-orange-400 transition-colors group-hover:bg-orange-500" style={{ height: `${height}%` }} />
                      <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-[10px] text-white group-hover:block">
                        {item.value}件
                      </span>
                    </div>
                    <p className="mt-2 h-4 text-center text-[9px] text-gray-400">{showLabel ? item.label : ''}</p>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
