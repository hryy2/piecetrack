import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar, MobileHeader } from './components/Sidebar';
import { HomeView } from './components/HomeView';
import { ReviewView } from './components/ReviewView';
import { WorkerPayoutView } from './components/WorkerPayoutView';
import { WorkersListView } from './components/WorkersListView';
import { SettingsView } from './components/SettingsView';
import { ScanView } from './components/ScanView';
import { HistoryView } from './components/HistoryView';

const AppContent: React.FC = () => {
  const { activeView } = useApp();

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-[var(--surface-page)] font-sans antialiased text-neutral-900">
      {/* Desktop / Tablet Sidebar */}
      <Sidebar />

      {/* Mobile Top Bar with Settings Gear */}
      <MobileHeader />

      {/* Main View Area (pb-14 on mobile for bottom tab bar clearance) */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden pb-14 md:pb-0">
        {activeView === 'home' && <HomeView />}
        {activeView === 'review' && <ReviewView />}
        {activeView === 'worker-detail' && <WorkerPayoutView />}
        {activeView === 'workers' && <WorkersListView />}
        {activeView === 'scan' && <ScanView />}
        {activeView === 'history' && <HistoryView />}
        {activeView === 'settings' && <SettingsView />}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
