import { Link, useLocation } from 'react-router-dom'

const tabs = [
  {
    path: '/',
    label: 'Home',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5" />
      </svg>
    )
  },
  {
    path: '/search',
    label: 'Search',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
        <circle cx="11" cy="11" r="7" />
        <path strokeLinecap="round" d="m20 20-3.5-3.5" />
      </svg>
    )
  },
  {
    path: '/profile',
    label: 'Profile',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
        <circle cx="12" cy="8" r="4" />
        <path strokeLinecap="round" d="M4 21c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" />
      </svg>
    )
  }
]

export function BottomNav() {
  const location = useLocation()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/90 backdrop-blur">
      <div className="mx-auto grid max-w-hunter grid-cols-3 px-2 pb-[env(safe-area-inset-bottom)]">
        {tabs.map((tab) => {
          const active = tab.path === '/' ? location.pathname === '/' : location.pathname.startsWith(tab.path)
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors ${
                active ? 'text-terracotta' : 'text-neutral-500 hover:text-ink'
              }`}
            >
              {tab.icon}
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
