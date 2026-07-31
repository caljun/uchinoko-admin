import { useEffect, useMemo, useState } from 'react'
import { collection, collectionGroup, getDocs, orderBy, query, Timestamp } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import {
  AlertTriangle, Ban, CalendarDays, CheckCircle, ChevronLeft, ChevronRight,
  Copy, Ellipsis, FileImage, PawPrint, RefreshCw, Search, Trash2, UserCheck,
  UserRound, Users, X,
} from 'lucide-react'
import { db } from '../lib/firebase'

interface Owner {
  id: string
  email?: string
  displayName?: string
  name?: string
  photoUrl?: string
  friendId?: string
  isDisabled?: boolean
  createdAt?: Timestamp
}

interface Pet {
  id: string
  ownerId: string
  name?: string
  breed?: string
  photoUrl?: string
}

interface UserPost {
  id: string
  ownerId?: string
  dogName?: string
  imageUrl?: string
  postedAt?: Timestamp
}

interface AuthUserInfo {
  uid: string
  lastSignInAt?: string | null
}

type StatusFilter = 'all' | 'active' | 'disabled'
type ActivityFilter = 'all' | '7days' | '30days' | 'inactive'
type SortKey = 'created' | 'lastPost' | 'posts'

const PAGE_SIZE = 20
const functions = getFunctions(undefined, 'us-central1')
const callDisable = httpsCallable(functions, 'adminDisableUser')
const callEnable = httpsCallable(functions, 'adminEnableUser')
const callDelete = httpsCallable(functions, 'adminDeleteUser')
const callListAuthUsers = httpsCallable<undefined, { users: AuthUserInfo[] }>(functions, 'adminListAuthUsers')

function ownerName(owner: Owner) {
  return owner.displayName || owner.name || '名前なし'
}

function formatDate(date?: Date | null, withTime = false) {
  if (!date) return '-'
  return new Intl.DateTimeFormat('ja-JP', withTime
    ? { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { year: 'numeric', month: 'numeric', day: 'numeric' }).format(date)
}

function StatCard({ label, value, icon: Icon, tone = 'orange' }: {
  label: string
  value: number
  icon: typeof Users
  tone?: 'orange' | 'green' | 'red' | 'blue'
}) {
  const colors = {
    orange: 'bg-orange-50 text-orange-500', green: 'bg-green-50 text-green-500',
    red: 'bg-red-50 text-red-500', blue: 'bg-blue-50 text-blue-500',
  }
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-400">{label}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${colors[tone]}`}><Icon size={17} /></div>
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-800">{value.toLocaleString()}<span className="ml-1 text-xs font-medium text-gray-400">人</span></p>
    </div>
  )
}

function DeleteModal({ owner, onConfirm, onCancel }: { owner: Owner; onConfirm: () => void; onCancel: () => void }) {
  const [confirmation, setConfirmation] = useState('')
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-100"><AlertTriangle size={18} className="text-red-500" /></div>
          <div><h3 className="font-bold text-gray-800">ユーザーを削除</h3><p className="mt-0.5 text-xs text-gray-400">この操作は取り消せません</p></div>
        </div>
        <div className="mb-4 rounded-xl bg-gray-50 px-4 py-3"><p className="text-sm font-medium text-gray-800">{ownerName(owner)}</p><p className="mt-0.5 text-xs text-gray-400">{owner.email || owner.id}</p></div>
        <p className="mb-3 text-xs leading-5 text-gray-500">Authアカウント、ペット、投稿、画像、コメント、フォロー情報を削除します。確認のため「削除」と入力してください。</p>
        <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="削除" className="mb-5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-200" />
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50">キャンセル</button>
          <button onClick={onConfirm} disabled={confirmation !== '削除'} className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-30">削除する</button>
        </div>
      </div>
    </div>
  )
}

function UserDetail({ owner, pets, posts, lastSignIn, acting, onClose, onToggle, onDelete }: {
  owner: Owner; pets: Pet[]; posts: UserPost[]; lastSignIn?: Date; acting: boolean
  onClose: () => void; onToggle: () => void; onDelete: () => void
}) {
  const latestPost = posts[0]?.postedAt?.toDate()
  const copyUid = () => navigator.clipboard.writeText(owner.id)
  return (
    <div className="fixed inset-0 z-40 bg-black/20" onMouseDown={onClose}>
      <aside className="ml-auto h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white/95 px-6 py-4 backdrop-blur">
          <div><h3 className="font-bold text-gray-800">ユーザー詳細</h3><p className="mt-0.5 text-xs text-gray-400">登録情報と利用状況</p></div>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="space-y-6 p-6">
          <div className="flex items-center gap-4">
            {owner.photoUrl ? <img src={owner.photoUrl} className="h-16 w-16 rounded-2xl object-cover" /> : <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-400"><UserRound size={25} /></div>}
            <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h4 className="truncate text-lg font-bold text-gray-800">{ownerName(owner)}</h4><span className={`rounded-full px-2 py-1 text-[11px] font-medium ${owner.isDisabled ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{owner.isDisabled ? '凍結中' : '正常'}</span></div><p className="mt-1 truncate text-sm text-gray-500">{owner.email || '-'}</p></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[['登録日', formatDate(owner.createdAt?.toDate())], ['最終ログイン', formatDate(lastSignIn, true)], ['最終投稿', formatDate(latestPost, true)], ['投稿数', `${posts.length}件`]].map(([label, value]) => <div key={label} className="rounded-xl bg-gray-50 p-4"><p className="text-[11px] font-medium text-gray-400">{label}</p><p className="mt-1.5 text-sm font-semibold text-gray-700">{value}</p></div>)}
          </div>

          <div><p className="mb-2 text-xs font-medium text-gray-400">ユーザーID</p><button onClick={copyUid} className="flex w-full items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-left text-xs text-gray-500 hover:bg-gray-100"><span className="truncate">{owner.id}</span><Copy size={13} className="ml-3 flex-shrink-0" /></button></div>

          <div>
            <div className="mb-3 flex items-center justify-between"><h5 className="text-sm font-bold text-gray-700">登録ペット</h5><span className="text-xs text-gray-400">{pets.length}匹</span></div>
            {pets.length ? <div className="space-y-2">{pets.map((pet) => <div key={pet.id} className="flex items-center gap-3 rounded-xl border border-gray-100 p-3">{pet.photoUrl ? <img src={pet.photoUrl} className="h-11 w-11 rounded-xl object-cover" /> : <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-400"><PawPrint size={18} /></div>}<div><p className="text-sm font-semibold text-gray-700">{pet.name || '名前なし'}</p><p className="mt-0.5 text-xs text-gray-400">{pet.breed || '種類未登録'}</p></div></div>)}</div> : <div className="rounded-xl bg-gray-50 py-7 text-center text-xs text-gray-400">登録ペットはいません</div>}
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between"><h5 className="text-sm font-bold text-gray-700">最近の投稿</h5><span className="text-xs text-gray-400">全{posts.length}件</span></div>
            {posts.length ? <div className="grid grid-cols-3 gap-2">{posts.slice(0, 6).map((post) => <div key={post.id} className="relative aspect-square overflow-hidden rounded-xl bg-gray-100">{post.imageUrl ? <img src={post.imageUrl} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-gray-300"><FileImage size={20} /></div>}</div>)}</div> : <div className="rounded-xl bg-gray-50 py-7 text-center text-xs text-gray-400">投稿はありません</div>}
          </div>

          <div className="border-t border-gray-100 pt-5"><p className="mb-3 text-xs font-medium text-gray-400">管理操作</p><div className="flex gap-3"><button onClick={onToggle} disabled={acting} className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium disabled:opacity-40 ${owner.isDisabled ? 'border-green-200 bg-green-50 text-green-600' : 'border-orange-200 bg-orange-50 text-orange-600'}`}>{owner.isDisabled ? <CheckCircle size={15} /> : <Ban size={15} />}{owner.isDisabled ? '凍結を解除' : 'アカウントを凍結'}</button><button onClick={onDelete} disabled={acting} className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-medium text-red-500 disabled:opacity-40"><Trash2 size={15} />削除</button></div></div>
        </div>
      </aside>
    </div>
  )
}

export default function UsersPage() {
  const [owners, setOwners] = useState<Owner[]>([])
  const [pets, setPets] = useState<Pet[]>([])
  const [posts, setPosts] = useState<UserPost[]>([])
  const [lastSignIns, setLastSignIns] = useState<Record<string, Date>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [activity, setActivity] = useState<ActivityFilter>('all')
  const [sort, setSort] = useState<SortKey>('created')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Owner | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  const showToast = (msg: string, type: 'ok' | 'err') => { setToast({ msg, type }); window.setTimeout(() => setToast(null), 3000) }

  const loadUsers = async () => {
    setLoading(true)
    try {
      const [ownersSnap, petsSnap, postsSnap, authResult] = await Promise.all([
        getDocs(query(collection(db, 'owners'), orderBy('createdAt', 'desc'))),
        getDocs(collectionGroup(db, 'dogs')),
        getDocs(query(collection(db, 'posts'), orderBy('postedAt', 'desc'))),
        callListAuthUsers(undefined).catch(() => null),
      ])
      setOwners(ownersSnap.docs.map((item) => ({ id: item.id, ...item.data() } as Owner)))
      setPets(petsSnap.docs.flatMap((item) => {
        if (!item.ref.path.startsWith('owners/')) return []
        return [{ id: item.id, ownerId: item.ref.path.split('/')[1], ...item.data() } as Pet]
      }))
      setPosts(postsSnap.docs.map((item) => ({ id: item.id, ...item.data() } as UserPost)))
      const signIns: Record<string, Date> = {}
      authResult?.data.users.forEach((user) => { if (user.lastSignInAt) signIns[user.uid] = new Date(user.lastSignInAt) })
      setLastSignIns(signIns)
    } catch { showToast('ユーザーの読み込みに失敗しました', 'err') } finally { setLoading(false) }
  }

  useEffect(() => { loadUsers() }, [])
  useEffect(() => { setPage(1) }, [search, status, activity, sort])

  const petMap = useMemo(() => {
    const map: Record<string, Pet[]> = {}; pets.forEach((pet) => { (map[pet.ownerId] ??= []).push(pet) }); return map
  }, [pets])
  const postMap = useMemo(() => {
    const map: Record<string, UserPost[]> = {}; posts.forEach((post) => { if (post.ownerId) (map[post.ownerId] ??= []).push(post) }); return map
  }, [posts])

  const filtered = useMemo(() => {
    const now = Date.now(); const q = search.trim().toLowerCase()
    return owners.filter((owner) => {
      if (q && !ownerName(owner).toLowerCase().includes(q) && !(owner.email ?? '').toLowerCase().includes(q) && !owner.id.toLowerCase().includes(q)) return false
      if (status === 'active' && owner.isDisabled) return false
      if (status === 'disabled' && !owner.isDisabled) return false
      const lastActivity = Math.max(lastSignIns[owner.id]?.getTime() ?? 0, postMap[owner.id]?.[0]?.postedAt?.toDate().getTime() ?? 0)
      if (activity === '7days' && now - lastActivity > 7 * 86_400_000) return false
      if (activity === '30days' && now - lastActivity > 30 * 86_400_000) return false
      if (activity === 'inactive' && lastActivity > 0 && now - lastActivity < 3 * 86_400_000) return false
      return true
    }).sort((a, b) => {
      if (sort === 'posts') return (postMap[b.id]?.length ?? 0) - (postMap[a.id]?.length ?? 0)
      if (sort === 'lastPost') return (postMap[b.id]?.[0]?.postedAt?.toMillis() ?? 0) - (postMap[a.id]?.[0]?.postedAt?.toMillis() ?? 0)
      return (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)
    })
  }, [owners, search, status, activity, sort, lastSignIns, postMap])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageOwners = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const selected = owners.find((owner) => owner.id === selectedId)
  const newUsers = owners.filter((owner) => owner.createdAt && Date.now() - owner.createdAt.toMillis() <= 7 * 86_400_000).length
  const activeUsers = owners.filter((owner) => !owner.isDisabled).length

  const toggleDisable = async (owner: Owner) => {
    setActionLoading(owner.id); setMenuId(null)
    try {
      if (owner.isDisabled) { await callEnable({ uid: owner.id }); setOwners((prev) => prev.map((item) => item.id === owner.id ? { ...item, isDisabled: false } : item)); showToast('凍結を解除しました', 'ok') }
      else { await callDisable({ uid: owner.id }); setOwners((prev) => prev.map((item) => item.id === owner.id ? { ...item, isDisabled: true } : item)); showToast('アカウントを凍結しました', 'ok') }
    } catch { showToast('操作に失敗しました', 'err') } finally { setActionLoading(null) }
  }

  const deleteUser = async () => {
    if (!deleteTarget) return
    const target = deleteTarget; setDeleteTarget(null); setSelectedId(null); setActionLoading(target.id)
    try { await callDelete({ uid: target.id }); setOwners((prev) => prev.filter((item) => item.id !== target.id)); showToast('ユーザーを削除しました', 'ok') }
    catch { showToast('削除に失敗しました', 'err') } finally { setActionLoading(null) }
  }

  return (
    <div className="max-w-7xl p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-xl font-bold text-gray-800">ユーザー管理</h2><p className="mt-0.5 text-xs text-gray-400">アカウントと利用状況を管理</p></div><button onClick={loadUsers} disabled={loading} className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} />再読み込み</button></div>

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4"><StatCard label="総ユーザー" value={owners.length} icon={Users} /><StatCard label="利用可能" value={activeUsers} icon={UserCheck} tone="green" /><StatCard label="凍結中" value={owners.length - activeUsers} icon={Ban} tone="red" /><StatCard label="7日以内の新規登録" value={newUsers} icon={CalendarDays} tone="blue" /></div>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-gray-100 bg-white p-3">
        <div className="relative min-w-56 flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="名前・メール・UIDで検索" className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-4 text-xs outline-none focus:ring-2 focus:ring-orange-200" /></div>
        <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 outline-none"><option value="all">すべての状態</option><option value="active">正常</option><option value="disabled">凍結中</option></select>
        <select value={activity} onChange={(event) => setActivity(event.target.value as ActivityFilter)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 outline-none"><option value="all">すべての利用状況</option><option value="7days">7日以内に利用</option><option value="30days">30日以内に利用</option><option value="inactive">3日以上利用なし</option></select>
        <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 outline-none"><option value="created">登録が新しい順</option><option value="lastPost">最終投稿が新しい順</option><option value="posts">投稿数が多い順</option></select>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="border-b border-gray-100 bg-gray-50"><tr>{['ユーザー', '登録日', '最終ログイン', '最終投稿', 'ペット', '投稿', '状態', ''].map((label, index) => <th key={index} className={`px-4 py-3 text-xs font-medium text-gray-500 ${index >= 4 && index <= 5 ? 'text-right' : 'text-left'}`}>{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-50">{loading ? <tr><td colSpan={8} className="py-20 text-center text-sm text-gray-400">読み込み中...</td></tr> : pageOwners.map((owner) => {
            const latestPost = postMap[owner.id]?.[0]?.postedAt?.toDate(); const acting = actionLoading === owner.id
            return <tr key={owner.id} onClick={() => setSelectedId(owner.id)} className={`${owner.isDisabled ? 'bg-red-50/30' : 'hover:bg-gray-50/70'} cursor-pointer transition-colors`}>
              <td className="px-4 py-3"><div className="flex items-center gap-3">{owner.photoUrl ? <img src={owner.photoUrl} className="h-9 w-9 rounded-xl object-cover" /> : <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-400"><UserRound size={16} /></div>}<div className="min-w-0"><p className="max-w-44 truncate font-semibold text-gray-800">{ownerName(owner)}</p><p className="max-w-44 truncate text-xs text-gray-400">{owner.email || owner.id}</p></div></div></td>
              <td className="px-4 py-3 text-xs text-gray-500">{formatDate(owner.createdAt?.toDate())}</td><td className="px-4 py-3 text-xs text-gray-500">{formatDate(lastSignIns[owner.id], true)}</td><td className="px-4 py-3 text-xs text-gray-500">{formatDate(latestPost, true)}</td><td className="px-4 py-3 text-right font-semibold text-gray-700">{petMap[owner.id]?.length ?? 0}</td><td className="px-4 py-3 text-right font-semibold text-gray-700">{postMap[owner.id]?.length ?? 0}</td>
              <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${owner.isDisabled ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}><span className={`h-1.5 w-1.5 rounded-full ${owner.isDisabled ? 'bg-red-500' : 'bg-green-500'}`} />{owner.isDisabled ? '凍結中' : '正常'}</span></td>
              <td className="relative px-4 py-3 text-right"><button disabled={acting} onClick={(event) => { event.stopPropagation(); setMenuId(menuId === owner.id ? null : owner.id) }} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 disabled:opacity-30"><Ellipsis size={17} /></button>{menuId === owner.id && <div className="absolute right-4 top-11 z-20 w-40 rounded-xl border border-gray-100 bg-white p-1.5 text-left shadow-lg" onClick={(event) => event.stopPropagation()}><button onClick={() => toggleDisable(owner)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-gray-600 hover:bg-gray-50">{owner.isDisabled ? <CheckCircle size={13} /> : <Ban size={13} />}{owner.isDisabled ? '凍結を解除' : '凍結する'}</button><button onClick={() => { setDeleteTarget(owner); setMenuId(null) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-red-500 hover:bg-red-50"><Trash2 size={13} />削除する</button></div>}</td>
            </tr>
          })}{!loading && pageOwners.length === 0 && <tr><td colSpan={8} className="py-16 text-center text-sm text-gray-400">該当するユーザーがいません</td></tr>}</tbody></table></div>
        {!loading && filtered.length > 0 && <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3"><p className="text-xs text-gray-400">{filtered.length}人中 {(page - 1) * PAGE_SIZE + 1}〜{Math.min(page * PAGE_SIZE, filtered.length)}人を表示</p><div className="flex items-center gap-2"><button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1} className="rounded-lg border border-gray-200 p-1.5 text-gray-500 disabled:opacity-30"><ChevronLeft size={14} /></button><span className="min-w-16 text-center text-xs text-gray-500">{page} / {totalPages}</span><button onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page === totalPages} className="rounded-lg border border-gray-200 p-1.5 text-gray-500 disabled:opacity-30"><ChevronRight size={14} /></button></div></div>}
      </div>

      {selected && <UserDetail owner={selected} pets={petMap[selected.id] ?? []} posts={postMap[selected.id] ?? []} lastSignIn={lastSignIns[selected.id]} acting={actionLoading === selected.id} onClose={() => setSelectedId(null)} onToggle={() => toggleDisable(selected)} onDelete={() => setDeleteTarget(selected)} />}
      {deleteTarget && <DeleteModal owner={deleteTarget} onConfirm={deleteUser} onCancel={() => setDeleteTarget(null)} />}
      {toast && <div className={`fixed bottom-6 right-6 z-[70] rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.type === 'ok' ? 'bg-gray-800' : 'bg-red-500'}`}>{toast.msg}</div>}
    </div>
  )
}
