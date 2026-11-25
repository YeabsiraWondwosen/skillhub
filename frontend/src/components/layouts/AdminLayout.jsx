import { Outlet } from 'react-router-dom';

// Route-group marker for admin pages.
//
// Admin pages intentionally no longer have their own shell: they render inside
// the shared <DashboardLayout /> (see App.jsx) alongside the client/freelancer
// and shared pages. That keeps a single sidebar instance mounted across every
// navigation, including admin <-> /notifications, so the sidebar scroll
// position is never reset by a remount. Mounting a second DashboardLayout here
// would re-create the sidebar subtree and reset its scrollTop.
export default function AdminLayout() {
  return <Outlet />;
}
