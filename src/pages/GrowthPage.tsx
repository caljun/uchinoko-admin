import { useEffect, useMemo, useState } from 'react'
import { collection, collectionGroup, getDocs, orderBy, query, Timestamp } from 'firebase/firestore'
import { Activity, ArrowDown, ArrowRight, ArrowUp, Clock3, RefreshCw, TrendingUp, UserPlus, Users } from 'lucide-react'
import { db } from '../lib/firebase'

interface GrowthOwner { id: string; createdAt?: Timestamp }
interface GrowthPost { id: string; ownerId?: string; postedAt?: Timestamp }
type RangeDays = 7 | 30 | 90

const DAY = 86_400_000
const JST_OFFSET = 9 * 60 * 60 * 1000

function startOfJstDay(date = new Date()) {
  const shifted = new Date(date.getTime() + JST_OFFSET)
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - JST_OFFSET
}

function dayDifference(from: Date, to: Date) {
  return Math.floor((startOfJstDay(to) - startOfJstDay(from)) / DAY)
}

function percent(value: number, total: number) {
  return total > 0 ? (value / total) * 100 : 0
}

function MetricCard({ label, value, suffix, note, icon: Icon, change }: {
  label: string; value: string; suffix?: string; note: string; icon: typeof Users; change?: number
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div><p className="text-xs font-medium text-gray-400">{label}</p><p className="mt-3 text-2xl font-bold text-gray-800">{value}<span className="ml-1 text-xs font-medium text-gray-400">{suffix}</span></p></div>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-500"><Icon size={17} /></div>
      </div>
      <div className="mt-2 flex min-h-4 items-center gap-1.5">
        {change !== undefined && <span className={`flex items-center text-[11px] font-semibold ${change > 0 ? 'text-green-500' : change < 0 ? 'text-red-500' : 'text-gray-400'}`}>{change > 0 ? <ArrowUp size={11} /> : change < 0 ? <ArrowDown size={11} /> : null}{Math.abs(change).toFixed(1)}%</span>}
        <span className="text-[11px] text-gray-400">{note}</span>
      </div>
    </div>
  )
}

function RetentionCard({ day, retained, eligible }: { day: string; retained: number; eligible: number }) {
  const rate = percent(retained, eligible)
  return (
    <div className="rounded-xl border border-gray-100 p-4">
      <div className="flex items-center justify-between"><p className="text-sm font-bold text-gray-700">{day}</p><p className="text-xl font-bold text-gray-800">{rate.toFixed(1)}<span className="ml-0.5 text-xs text-gray-400">%</span></p></div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-orange-400" style={{ width: `${Math.min(rate, 100)}%` }} /></div>
      <p className="mt-2 text-[11px] text-gray-400">対象{eligible}人中 {retained}人が投稿</p>
    </div>
  )
}

export default function GrowthPage() {
  const [owners, setOwners] = useState<GrowthOwner[]>([])
  const [posts, setPosts] = useState<GrowthPost[]>([])
  const [petOwnerIds, setPetOwnerIds] = useState<Set<string>>(new Set())
  const [rangeDays, setRangeDays] = useState<RangeDays>(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true); setError(null)
    try {
      const [ownerSnap, postSnap, petSnap] = await Promise.all([
        getDocs(query(collection(db, 'owners'), orderBy('createdAt', 'asc'))),
        getDocs(query(collection(db, 'posts'), orderBy('postedAt', 'asc'))),
        getDocs(collectionGroup(db, 'dogs')),
      ])
      setOwners(ownerSnap.docs.map((item) => ({ id: item.id, ...item.data() } as GrowthOwner)))
      setPosts(postSnap.docs.map((item) => ({ id: item.id, ...item.data() } as GrowthPost)))
      const ids = new Set<string>()
      petSnap.docs.forEach((item) => { if (item.ref.path.startsWith('owners/')) ids.add(item.ref.path.split('/')[1]) })
      setPetOwnerIds(ids)
    } catch { setError('成長データの読み込みに失敗しました') } finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [])

  const growth = useMemo(() => {
    const now = new Date()
    const today = startOfJstDay(now)
    const cohortStart = today - (rangeDays - 1) * DAY
    const postDates = new Map<string, Date[]>()
    posts.forEach((post) => {
      if (!post.ownerId || !post.postedAt) return
      const dates = postDates.get(post.ownerId) ?? []
      dates.push(post.postedAt.toDate()); postDates.set(post.ownerId, dates)
    })

    const cohort = owners.filter((owner) => {
      const created = owner.createdAt?.toDate().getTime()
      return created !== undefined && created >= cohortStart && created < today + DAY
    })
    const withPet = cohort.filter((owner) => petOwnerIds.has(owner.id))
    const withFirstPost = cohort.filter((owner) => (postDates.get(owner.id)?.length ?? 0) > 0)
    const firstPostHours = withFirstPost.flatMap((owner) => {
      const created = owner.createdAt?.toDate(); const first = postDates.get(owner.id)?.[0]
      if (!created || !first || first < created) return []
      return [(first.getTime() - created.getTime()) / 3_600_000]
    })

    const retention = (targetDay: number) => {
      const eligible = cohort.filter((owner) => owner.createdAt && dayDifference(owner.createdAt.toDate(), now) >= targetDay)
      const retained = eligible.filter((owner) => {
        const created = owner.createdAt?.toDate(); if (!created) return false
        return postDates.get(owner.id)?.some((date) => dayDifference(created, date) === targetDay) ?? false
      })
      return { eligible: eligible.length, retained: retained.length }
    }

    const currentWeekStart = today - 6 * DAY
    const previousWeekStart = today - 13 * DAY
    const currentActive = new Set(posts.filter((post) => post.ownerId && post.postedAt && post.postedAt.toMillis() >= currentWeekStart).map((post) => post.ownerId as string))
    const previousActive = new Set(posts.filter((post) => post.ownerId && post.postedAt && post.postedAt.toMillis() >= previousWeekStart && post.postedAt.toMillis() < currentWeekStart).map((post) => post.ownerId as string))
    const weeklyChange = previousActive.size > 0 ? ((currentActive.size - previousActive.size) / previousActive.size) * 100 : currentActive.size > 0 ? 100 : 0
    const zeroPost = owners.filter((owner) => !postDates.has(owner.id)).length
    const inactive = owners.filter((owner) => {
      const dates = postDates.get(owner.id)
      return !dates?.length || dates[dates.length - 1].getTime() < today - 2 * DAY
    }).length

    const weekly = Array.from({ length: 8 }, (_, index) => {
      const start = today - (7 - index) * 7 * DAY
      const end = start + 7 * DAY
      const registered = owners.filter((owner) => { const time = owner.createdAt?.toMillis(); return time !== undefined && time >= start && time < end }).length
      const active = new Set(posts.filter((post) => { const time = post.postedAt?.toMillis(); return post.ownerId && time !== undefined && time >= start && time < end }).map((post) => post.ownerId as string)).size
      const labelDate = new Date(start + JST_OFFSET)
      return { label: `${labelDate.getUTCMonth() + 1}/${labelDate.getUTCDate()}`, registered, active }
    })

    return {
      cohort, withPet, withFirstPost,
      firstPostHours: firstPostHours.length ? firstPostHours.reduce((sum, value) => sum + value, 0) / firstPostHours.length : 0,
      d1: retention(1), d3: retention(3), d7: retention(7), currentActive: currentActive.size,
      weeklyChange, zeroPost, inactive, weekly,
    }
  }, [owners, posts, petOwnerIds, rangeDays])

  const funnel = [
    { label: '新規登録', count: growth.cohort.length, color: 'bg-orange-500' },
    { label: 'ペット登録', count: growth.withPet.length, color: 'bg-orange-400' },
    { label: '初投稿', count: growth.withFirstPost.length, color: 'bg-amber-400' },
  ]
  const maxWeekly = Math.max(...growth.weekly.flatMap((week) => [week.registered, week.active]), 1)

  return (
    <div className="max-w-7xl p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div><h2 className="text-xl font-bold text-gray-800">成長ダッシュボード</h2><p className="mt-0.5 text-xs text-gray-400">登録から初投稿・継続までを日本時間で集計</p></div>
        <div className="flex items-center gap-2"><div className="flex rounded-lg border border-gray-200 bg-white p-1">{([7, 30, 90] as RangeDays[]).map((days) => <button key={days} onClick={() => setRangeDays(days)} className={`rounded-md px-3 py-1.5 text-xs font-medium ${rangeDays === days ? 'bg-orange-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>{days}日</button>)}</div><button onClick={loadData} disabled={loading} className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} />再読み込み</button></div>
      </div>
      {error && <div className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-500">{error}</div>}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard label={`新規登録（直近${rangeDays}日）`} value={growth.cohort.length.toLocaleString()} suffix="人" note="登録日時があるユーザー" icon={UserPlus} />
        <MetricCard label="初投稿率" value={percent(growth.withFirstPost.length, growth.cohort.length).toFixed(1)} suffix="%" note={`${growth.withFirstPost.length}人が投稿`} icon={TrendingUp} />
        <MetricCard label="週間投稿ユーザー" value={growth.currentActive.toLocaleString()} suffix="人" note="前の7日間と比較" icon={Activity} change={growth.weeklyChange} />
        <MetricCard label="初投稿までの平均" value={growth.firstPostHours < 48 ? growth.firstPostHours.toFixed(1) : (growth.firstPostHours / 24).toFixed(1)} suffix={growth.firstPostHours < 48 ? '時間' : '日'} note="登録後に投稿した人が対象" icon={Clock3} />
      </div>

      {loading ? <div className="py-24 text-center text-sm text-gray-400">集計中...</div> : <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-5"><h3 className="text-sm font-bold text-gray-800">登録から初投稿まで</h3><p className="mt-0.5 text-xs text-gray-400">直近{rangeDays}日間に登録したユーザー</p></div>
          <div className="space-y-3">{funnel.map((item, index) => {
            const width = percent(item.count, growth.cohort.length)
            const previous = index > 0 ? funnel[index - 1].count : item.count
            return <div key={item.label}><div className="mb-1.5 flex items-end justify-between"><div className="flex items-center gap-2"><p className="text-xs font-semibold text-gray-600">{item.label}</p>{index > 0 && <span className="flex items-center text-[10px] text-gray-400"><ArrowRight size={10} />{percent(item.count, previous).toFixed(1)}%</span>}</div><p className="text-sm font-bold text-gray-700">{item.count}<span className="ml-1 text-[10px] font-normal text-gray-400">人</span></p></div><div className="h-10 overflow-hidden rounded-lg bg-gray-100"><div className={`flex h-full items-center justify-end rounded-lg px-3 text-xs font-bold text-white transition-all ${item.color}`} style={{ width: `${Math.max(width, item.count ? 8 : 0)}%` }}>{width >= 18 ? `${width.toFixed(1)}%` : ''}</div></div></div>
          })}</div>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-5"><h3 className="text-sm font-bold text-gray-800">投稿継続率</h3><p className="mt-0.5 text-xs text-gray-400">登録日から指定日後に投稿した割合</p></div>
          <div className="grid gap-3 sm:grid-cols-3"><RetentionCard day="翌日（D1）" {...growth.d1} /><RetentionCard day="3日後（D3）" {...growth.d3} /><RetentionCard day="7日後（D7）" {...growth.d7} /></div>
          <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-[11px] leading-5 text-gray-400">各日数を経過していない新規ユーザーは母数に含めていません。投稿回数ではなく、投稿したユーザー数で計算しています。</p>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-5"><h3 className="text-sm font-bold text-gray-800">離脱の兆候</h3><p className="mt-0.5 text-xs text-gray-400">全登録ユーザーを対象に集計</p></div>
          <div className="grid grid-cols-2 gap-4"><div className="rounded-xl bg-red-50 p-4"><p className="text-xs font-medium text-red-400">一度も投稿していない</p><p className="mt-2 text-2xl font-bold text-red-600">{growth.zeroPost}<span className="ml-1 text-xs font-medium text-red-400">人</span></p><p className="mt-1 text-[11px] text-red-400">全体の{percent(growth.zeroPost, owners.length).toFixed(1)}%</p></div><div className="rounded-xl bg-amber-50 p-4"><p className="text-xs font-medium text-amber-500">3日以上投稿なし</p><p className="mt-2 text-2xl font-bold text-amber-600">{growth.inactive}<span className="ml-1 text-xs font-medium text-amber-500">人</span></p><p className="mt-1 text-[11px] text-amber-500">未投稿ユーザーを含む</p></div></div>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-5"><h3 className="text-sm font-bold text-gray-800">週ごとの成長</h3><p className="mt-0.5 text-xs text-gray-400">新規登録者と投稿ユーザーの推移</p></div>
          <div className="flex h-48 items-end gap-3 border-b border-gray-100 pb-1">{growth.weekly.map((week) => <div key={week.label} className="flex h-full min-w-8 flex-1 flex-col justify-end"><div className="flex flex-1 items-end justify-center gap-1"><div title={`新規登録 ${week.registered}人`} className="w-2.5 rounded-t bg-blue-400" style={{ height: `${Math.max((week.registered / maxWeekly) * 100, week.registered ? 3 : 0)}%` }} /><div title={`投稿ユーザー ${week.active}人`} className="w-2.5 rounded-t bg-orange-400" style={{ height: `${Math.max((week.active / maxWeekly) * 100, week.active ? 3 : 0)}%` }} /></div><p className="mt-2 text-center text-[9px] text-gray-400">{week.label}</p></div>)}</div>
          <div className="mt-3 flex justify-center gap-5 text-[11px] text-gray-500"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-blue-400" />新規登録</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-orange-400" />投稿ユーザー</span></div>
        </section>
      </div>}
    </div>
  )
}
