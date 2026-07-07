import { HashRouter, Route, Routes } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { DashboardPage } from './pages/DashboardPage'
import { PosPage } from './pages/PosPage'
import { KitchenPage } from './pages/KitchenPage'
import { MenuPage } from './pages/MenuPage'
import { HistoryPage } from './pages/HistoryPage'
import { PlansPage } from './pages/PlansPage'
import { SettingsPage } from './pages/SettingsPage'

export default function App() {
  return (
    <HashRouter>
      <div className="min-h-dvh bg-page text-stone-900">
        <Sidebar />
        <main className="ml-16 min-h-dvh p-4 sm:p-6 lg:ml-56 lg:p-8">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/service" element={<PosPage />} />
            <Route path="/kitchen" element={<KitchenPage />} />
            <Route path="/menu" element={<MenuPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/plans" element={<PlansPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}
