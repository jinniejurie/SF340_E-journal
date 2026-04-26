import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../services/firebase'

function ProtectedRoute({ children }) {
  const [authReady, setAuthReady] = useState(false)
  const [user, setUser] = useState(null)
  const location = useLocation()

  useEffect(() => {
    if (!auth) {
      setAuthReady(true)
      return
    }
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setAuthReady(true)
    })
    return () => unsubscribe()
  }, [])

  if (!authReady) {
    return (
      <div className="auth-loading" aria-live="polite">
        Loading…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/signup" state={{ from: location }} replace />
  }

  return children
}

export default ProtectedRoute
