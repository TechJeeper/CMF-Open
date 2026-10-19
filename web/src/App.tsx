import { HashRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppShell } from '@/components/layout/AppShell'
import { AppPage } from '@/pages/AppPage'
import { DevelopPage } from '@/pages/DevelopPage'
import { LibraryPage } from '@/pages/LibraryPage'
import { SideloadPage } from '@/pages/SideloadPage'
import { StorePage } from '@/pages/StorePage'
import { WatchfacesPage } from '@/pages/WatchfacesPage'
import { RunnerProvider } from '@/state/RunnerProvider'
import { WatchProvider } from '@/state/WatchProvider'

// HashRouter: GitHub Pages has no SPA fallback, so deep links must not hit the server.
export default function App() {
  return (
    <WatchProvider>
      <RunnerProvider>
        <TooltipProvider>
          <HashRouter>
            <Routes>
              <Route element={<AppShell />}>
                <Route index element={<StorePage />} />
                <Route path="library" element={<LibraryPage />} />
                <Route path="app/:id" element={<AppPage />} />
                <Route path="sideload" element={<SideloadPage />} />
                <Route path="watchfaces" element={<WatchfacesPage />} />
                <Route path="develop" element={<DevelopPage />} />
                <Route path="*" element={<StorePage />} />
              </Route>
            </Routes>
          </HashRouter>
          <Toaster position="bottom-right" theme="dark" />
        </TooltipProvider>
      </RunnerProvider>
    </WatchProvider>
  )
}
