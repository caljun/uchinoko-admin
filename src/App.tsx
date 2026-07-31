import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginPage from './pages/LoginPage'
import UsersPage from './pages/UsersPage'
import ReportsPage from './pages/ReportsPage'
import PostsPage from './pages/PostsPage'
import AnalyticsPage from './pages/AnalyticsPage'
import { db } from './lib/firebase'
import { Users, LogOut, Flag, Grid3X3, BarChart3 } from 'lucide-react'

function Layout() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [openReportCount, setOpenReportCount] = useState(0)

  useEffect(() => {
    const reportsQuery = query(collection(db, 'reports'), where('status', '==', 'open'))
    return onSnapshot(reportsQuery, (snap) => setOpenReportCount(snap.size), () => setOpenReportCount(0))
  }, [])

  const navItems = [
    { path: '/', label: 'ユーザー管理', icon: Users },
    { path: '/reports', label: '通報管理', icon: Flag },
    { path: '/posts', label: '投稿管理', icon: Grid3X3 },
    { path: '/analytics', label: '利用状況', icon: BarChart3 },
  ]

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* サイドバー */}
      <div className="w-56 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-xs text-gray-400 font-medium tracking-widest uppercase">Admin</p>
          <h1 className="text-base font-bold text-gray-800 mt-0.5">PetReal.</h1>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ path, label, icon: Icon }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                location.pathname === path
                  ? 'bg-orange-50 text-orange-600 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon size={16} />
              <span className="flex-1 text-left">{label}</span>
              {path === '/reports' && openReportCount > 0 && (
                <span className="min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">
                  {openReportCount}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-100">
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <LogOut size={16} />
            ログアウト
          </button>
        </div>
      </div>
      {/* コンテンツ */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  )
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">読み込み中...</div>
  return (user && isAdmin) ? <>{children}</> : <Navigate to="/login" replace />
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">読み込み中...</div>
  return (user && isAdmin) ? <Navigate to="/" replace /> : <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route path="/" element={<UsersPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/posts" element={<PostsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
