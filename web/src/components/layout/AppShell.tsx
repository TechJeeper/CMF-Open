import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConnectDialog } from '@/components/watch/ConnectDialog'
import { useRunner } from '@/state/runner-context'
import { ConnectionButton } from './ConnectionButton'

const NAV = [
  { to: '/', label: 'Store', end: true },
  { to: '/library', label: 'My apps' },
  { to: '/sideload', label: 'Sideload' },
  { to: '/watchfaces', label: 'Watchfaces' },
  { to: '/develop', label: 'Develop' },
]

function RunningPill() {
  const r = useRunner()
  const nav = useNavigate()
  if (!r.running) return null
  return (
    <div className="flex items-center gap-1 rounded-full border border-brand/40 bg-brand/10 py-0.5 pr-0.5 pl-3 text-xs">
      <button className="flex items-center gap-1.5 font-medium" onClick={() => nav(`/app/${r.running!.id}`)}>
        <span className="size-1.5 animate-pulse rounded-full bg-brand" />
        <span className="max-w-28 truncate">{r.running.name}</span>
      </button>
      <button
        aria-label="Stop app"
        onClick={() => void r.stop()}
        className="grid size-6 place-items-center rounded-full hover:bg-brand/20"
      >
        <Square className="size-3 fill-current" />
      </button>
    </div>
  )
}

export function AppShell() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <span className="grid size-7 place-items-center rounded-full bg-foreground text-background">
              <span className="size-2 rounded-full bg-brand" />
            </span>
            <span className="font-dot text-lg font-bold tracking-tight">CMF App Store</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <NavItem key={n.to} {...n} />
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <RunningPill />
            <ConnectionButton />
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2 md:hidden [scrollbar-width:none]">
          {NAV.map((n) => (
            <NavItem key={n.to} {...n} />
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-muted-foreground">
        Unofficial community project, not affiliated with Nothing or CMF. Apps run in your browser and talk to the
        watch over Bluetooth.
      </footer>
      <ConnectDialog />
    </div>
  )
}

function NavItem({ to, label, end }: { to: string; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'shrink-0 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:text-foreground',
          isActive && 'bg-secondary text-foreground',
        )
      }
    >
      {label}
    </NavLink>
  )
}
