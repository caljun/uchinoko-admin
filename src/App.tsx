import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginPage from './pages/LoginPage'
import ShopsPage from './pages/ShopsPage'

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
      <Route path="/" element={<PrivateRoute><ShopsPage /></PrivateRoute>} />
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
