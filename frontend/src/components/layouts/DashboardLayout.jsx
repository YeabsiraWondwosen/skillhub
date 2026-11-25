import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import Breadcrumb from '@/components/ui/Breadcrumb';
import AIChatWidget from '@/components/support/AIChatWidget';
import { useAuthStore } from '@/store/authStore';
import { useNotificationRealtime, useNotificationTabBadge } from '@/hooks/useNotifications';

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuthStore();
  useNotificationRealtime();
  useNotificationTabBadge();
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900/50">
      <Navbar onMenuToggle={() => setSidebarOpen(true)} />
      <div className="flex">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 min-w-0 overflow-x-hidden">
          <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-2 max-w-7xl">
            <Breadcrumb />
          </div>
          <div className="px-4 sm:px-6 lg:px-8 pb-6 flex-1 min-w-0 overflow-x-hidden">
            <Outlet />
          </div>
        </main>
      </div>
      {user?.role !== 'admin' && <AIChatWidget />}
    </div>
  );
}
