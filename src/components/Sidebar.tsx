import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface SidebarProps {
  isMobile?: boolean;
}

export default function Sidebar({ isMobile = false }: SidebarProps) {
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const customerItems = [
    { path: '/dashboard', label: 'Dashboard', icon: 'grid_view' },
    { path: '/tracking', label: 'Track delivery', icon: 'location_on' },
    { path: '/booking', label: 'Book transport', icon: 'calendar_month' },
    { path: '/reports', label: 'History', icon: 'history' },
    { path: '/settings', label: 'Settings', icon: 'settings' },
  ];

  const adminItems = [
    { path: '/admin', label: 'Admin panel', icon: 'admin_panel_settings' },
    { path: '/booking', label: 'Manual booking', icon: 'add_circle' },
    { path: '/reports', label: 'Reports', icon: 'analytics' },
    { path: '/settings', label: 'Settings', icon: 'settings_suggest' },
  ];

  const menuItems = isAdmin ? adminItems : customerItems;

  const sidebarClasses = isMobile 
    ? "flex flex-col h-full bg-white relative z-60" 
    : "hidden md:flex flex-col w-64 bg-white border-r border-outline fixed left-0 top-20 bottom-0 z-40 overflow-y-auto";

  return (
    <aside className={sidebarClasses}>
      <div className="p-6 flex flex-col gap-1">
        <p className="text-xs font-bold text-on-surface-variant mb-4 px-4">
          {isAdmin ? 'Operations' : 'Menu'}
        </p>
        <div className="space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-md transition-all group ${
                  isActive 
                    ? 'bg-primary text-white font-bold' 
                    : 'hover:bg-surface-container text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className={`material-symbols-outlined text-xl ${isActive ? 'fill-icon' : ''}`}>
                  {item.icon}
                </span>
                <span className="text-sm font-bold leading-none">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-auto p-8 border-t border-outline">
        <div className="flex items-center gap-4 p-4 bg-surface-container/30 rounded-lg border border-outline group cursor-pointer hover:bg-surface-container transition-all">
          <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-lg">support_agent</span>
          </div>
          <div>
            <p className="text-sm font-bold text-on-surface">24/7 support</p>
            <p className="text-xs text-on-surface-variant font-medium mt-0.5">Live assistance</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
