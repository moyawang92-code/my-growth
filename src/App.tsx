import { Suspense, lazy } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { CalendarDays, Sparkles, Sun } from 'lucide-react';
import { TodayPage } from './pages/TodayPage';
import { cx } from './components/ui';
import { useGrowthStore } from './store/GrowthStore';

// The Today page is the one opened every day, so it stays in the main bundle.
// The chart-heavy calendar and the yearly archive load on demand.
const CalendarPage = lazy(() =>
  import('./pages/CalendarPage').then((module) => ({ default: module.CalendarPage })),
);
const MyYearPage = lazy(() =>
  import('./pages/MyYearPage').then((module) => ({ default: module.MyYearPage })),
);

const NAV_ITEMS = [
  { to: '/today', label: '今日', icon: Sun },
  { to: '/calendar', label: '日历', icon: CalendarDays },
  { to: '/year', label: '我的年度', icon: Sparkles },
];

function DesktopNav() {
  return (
    <header className="sticky top-0 z-30 hidden border-b border-line bg-canvas/85 backdrop-blur md:block">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-semibold tracking-tight text-ink">My Growth</span>
          <span className="text-xs text-ink-faint">我的成长</span>
        </div>
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cx(
                  'rounded-full px-4 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-sage-100 font-medium text-sage-600'
                    : 'text-ink-soft hover:bg-sage-50 hover:text-sage-600',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}

function MobileNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cx(
                'flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors',
                isActive ? 'text-sage-600' : 'text-ink-faint',
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                <span className={isActive ? 'font-medium' : undefined}>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function App() {
  const { loading, loadError } = useGrowthStore();

  return (
    <div className="min-h-dvh bg-canvas">
      <DesktopNav />
      {/* Bottom padding keeps the mobile tab bar clear of the last card. */}
      <main className="mx-auto max-w-5xl px-4 pt-5 pb-28 sm:px-6 md:pt-8 md:pb-16">
        {loadError ? (
          <div className="mb-5 rounded-xl border border-[#e3c9c3] bg-[#fdf3f1] px-4 py-3 text-sm text-[#a8503f]">
            数据读取失败：{loadError}
            <br />
            如果浏览器处于隐私模式或禁用了本地存储，记录将无法保存。
          </div>
        ) : null}
        {loading ? (
          <p className="px-1 py-10 text-sm text-ink-faint">正在读取你的记录…</p>
        ) : (
          <Suspense
            fallback={<p className="px-1 py-10 text-sm text-ink-faint">正在打开…</p>}
          >
            <Routes>
              <Route path="/" element={<Navigate to="/today" replace />} />
              <Route path="/today" element={<TodayPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/year" element={<MyYearPage />} />
              <Route path="*" element={<Navigate to="/today" replace />} />
            </Routes>
          </Suspense>
        )}
      </main>
      <MobileNav />
    </div>
  );
}
