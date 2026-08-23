import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { HeaderBar } from '@/components/layout/HeaderBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Protected } from '@/components/routing/Protected'
import { ConnectivityBanner } from '@/components/layout/ConnectivityBanner'
import Home from '@/pages/Home'
import Search from '@/pages/Search'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import UserProfile from '@/pages/UserProfile'
import PropertyDetail from '@/pages/PropertyDetail'
import AgentListings from '@/pages/AgentListings'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function AgentChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-agent">
      <HeaderBar mode="agent" />
      {children}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <ConnectivityBanner />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <Protected>
              <AgentChrome>
                <Dashboard />
              </AgentChrome>
            </Protected>
          }
        />
        <Route
          path="/dashboard/listings"
          element={
            <Protected>
              <AgentChrome>
                <AgentListings />
              </AgentChrome>
            </Protected>
          }
        />
        <Route
          path="/profile"
          element={
            <Protected>
              <UserProfile />
            </Protected>
          }
        />
        <Route path="*" element={<HunterShell />} />
      </Routes>
    </BrowserRouter>
  )
}

function HunterShell() {
  const location = useLocation()
  useAuth()
  const isDetail = location.pathname.startsWith('/property')

  return (
    <>
      <HeaderBar />
      <div className={isDetail ? '' : 'pb-[72px]'}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/property/:id" element={<PropertyDetail />} />
        </Routes>
      </div>
      {!isDetail && <BottomNav />}
    </>
  )
}
