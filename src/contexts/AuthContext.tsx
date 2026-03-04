import { createContext, useContext, useEffect, useState } from 'react'
import { type User, onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

interface AuthContextType {
  user: User | null
  isAdmin: boolean
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

async function checkAdmin(uid: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'admins', uid))
  return snap.exists()
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        const admin = await checkAdmin(u.uid)
        setIsAdmin(admin)
      } else {
        setIsAdmin(false)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const signIn = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    const admin = await checkAdmin(cred.user.uid)
    if (!admin) {
      await firebaseSignOut(auth)
      throw new Error('管理者権限がありません')
    }
  }

  const signOut = async () => {
    await firebaseSignOut(auth)
    setIsAdmin(false)
  }

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
