import React from 'react';
import { Calendar, Camera, Users, History, Settings, FileCheck2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AppView } from '../types';

export const Sidebar: React.FC = () => {
  const { activeView, setActiveView, flaggedPagesCount } = useApp();

  interface NavItem {
    view: AppView;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
    badge?: number;
  }

  const primaryNavItems: NavItem[] = [
    {
      view: 'home',
      label: 'This period',
      shortLabel: 'Period',
      icon: <Calendar className="w-4 h-4" />,
    },
    {
      view: 'review',
      label: 'Review',
      shortLabel: 'Review',
      icon: <FileCheck2 className="w-4 h-4" />,
      badge: flaggedPagesCount > 0 ? flaggedPagesCount : undefined,
    },
    {
      view: 'scan',
      label: 'Scan',
      shortLabel: 'Scan',
      icon: <Camera className="w-4 h-4" />,
    },
    {
      view: 'workers',
      label: 'Workers',
      shortLabel: 'Workers',
      icon: <Users className="w-4 h-4" />,
    },
    {
      view: 'history',
      label: 'History',
      shortLabel: 'History',
      icon: <History className="w-4 h-4" />,
    },
  ];

  const desktopNavItems: NavItem[] = [
    ...primaryNavItems,
    {
      view: 'settings',
      label: 'Settings',
      shortLabel: 'Settings',
      icon: <Settings className="w-4 h-4" />,
    },
  ];

  const isNavActive = (view: AppView) => {
    if (view === 'workers' && activeView === 'worker-detail') return true;
    return activeView === view;
  };

  return (
    <>
      {/* Desktop & Tablet Sidebar (>= 768px) */}
      <aside className="hidden md:flex w-52 lg:w-56 bg-white border-r border-neutral-200/80 flex-col justify-between shrink-0 select-none">
        <div>
          {/* Brand */}
          <button
            type="button"
            onClick={() => setActiveView('home')}
            className="w-full h-14 px-5 flex items-center gap-2.5 border-b border-neutral-100 text-left cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-[var(--brand-600)] text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-xs">
              PT
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-neutral-900 text-sm tracking-tight leading-none">
                PieceTrack
              </span>
              <span className="text-[11px] text-neutral-400 mt-0.5 leading-none">
                Workshop Ledger
              </span>
            </div>
          </button>

          {/* Navigation list */}
          <nav className="p-3 space-y-1">
            {desktopNavItems.map(item => {
              const active = isNavActive(item.view);
              return (
                <button
                  key={item.view}
                  onClick={() => setActiveView(item.view)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-[var(--brand-600)] text-white shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/70'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={active ? 'text-white' : 'text-neutral-500'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>

                  {item.badge !== undefined && (
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                        active
                          ? 'bg-white/20 text-white'
                          : 'bg-[var(--status-check-bg)] text-[var(--status-check)]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Workshop Profile indicator */}
        <div className="p-3 border-t border-neutral-100">
          <div className="px-3 py-1 text-[11px] text-neutral-400 truncate">
            Studio Workshop
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Tab Bar (< 768px): strictly 5 primary tabs */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-neutral-200/90 flex items-stretch justify-around select-none"
      >
        {primaryNavItems.map(item => {
          const active = isNavActive(item.view);
          return (
            <button
              key={item.view}
              onClick={() => setActiveView(item.view)}
              className={`relative flex-1 min-h-[56px] flex flex-col items-center justify-center gap-1 px-1 py-1.5 text-[10px] font-medium transition-colors ${
                active
                  ? 'text-[var(--brand-600)] font-semibold'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <div className="relative">
                {item.icon}
                {item.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--status-check-bg)] text-[var(--status-check)] border border-[var(--status-check-border)] text-[9px] font-bold flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="truncate max-w-[64px]">{item.shortLabel}</span>
              {active && (
                <span className="absolute top-0 inset-x-3 h-0.5 bg-[var(--brand-600)] rounded-b" />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
};

export const MobileHeader: React.FC = () => {
  const { activeView, setActiveView } = useApp();

  return (
    <div className="md:hidden h-13 px-4 bg-white border-b border-neutral-200/80 flex items-center justify-between shrink-0 select-none">
      <button
        type="button"
        onClick={() => setActiveView('home')}
        className="flex items-center gap-2 min-h-[44px] cursor-pointer"
      >
        <div className="w-7 h-7 rounded-lg bg-[var(--brand-600)] text-white flex items-center justify-center font-bold text-xs tracking-tight">
          PT
        </div>
        <span className="font-semibold text-neutral-900 text-sm tracking-tight">
          PieceTrack
        </span>
      </button>

      <button
        type="button"
        onClick={() => setActiveView('settings')}
        aria-label="Open Settings"
        className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors ${
          activeView === 'settings'
            ? 'bg-[var(--brand-600)] text-white'
            : 'text-neutral-600 hover:bg-neutral-100'
        }`}
      >
        <Settings className="w-5 h-5" />
      </button>
    </div>
  );
};
