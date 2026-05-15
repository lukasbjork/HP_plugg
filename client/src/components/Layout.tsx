// Global layout med sidebar (desktop) och bottom nav (mobil)
import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', icon: '🏠', label: 'Hem', exact: true },
  { to: '/practice', icon: '✏️', label: 'Öva' },
  { to: '/simulation', icon: '⏱️', label: 'Simulera' },
  { to: '/library', icon: '📚', label: 'Bibliotek' },
  { to: '/stats', icon: '📊', label: 'Statistik' },
  { to: '/flashcards', icon: '🗂️', label: 'Flashcards' },
];

function NavItem({ to, icon, label, exact }: { to: string; icon: string; label: string; exact?: boolean }) {
  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-sm font-medium ${
          isActive
            ? 'bg-ki-blue text-white'
            : 'text-ki-gray-dark hover:bg-ki-blue-pale hover:text-ki-blue'
        }`
      }
    >
      <span className="text-base">{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Sidebar — dold på mobil */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 bg-white border-r border-ki-gray-mid">
        {/* Logo */}
        <div className="p-5 border-b border-ki-gray-mid">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-ki-blue rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">HP</span>
            </div>
            <div>
              <div className="font-bold text-ki-text text-sm">HP-Studier</div>
              <div className="text-xs text-ki-gray-dark">Karolinska</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>

        {/* KI-mål */}
        <div className="p-4 m-3 rounded-xl bg-gradient-to-br from-ki-blue to-ki-blue-light text-white text-center">
          <div className="text-xs font-medium opacity-80 mb-1">Mål</div>
          <div className="text-xs font-bold">Läkarprogrammet</div>
          <div className="text-xs opacity-80">Karolinska Institutet</div>
          <div className="mt-2 text-xs font-mono font-bold text-ki-gold">HP ≥ 2.0</div>
        </div>
      </aside>

      {/* Huvudinnehåll */}
      <main className="flex-1 min-w-0 pb-20 md:pb-0">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {children}
        </div>
      </main>

      {/* Bottom nav — endast mobil */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-ki-gray-mid px-2 py-1 flex justify-around z-50">
        {navItems.map(({ to, icon, label, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              `flex flex-col items-center py-1 px-2 rounded-lg text-xs transition-colors ${
                isActive ? 'text-ki-blue' : 'text-ki-gray-dark'
              }`
            }
          >
            <span className="text-lg mb-0.5">{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
