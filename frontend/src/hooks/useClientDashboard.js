import { useQuery } from '@tanstack/react-query';
import { clientDashboardService } from '@/services/clientDashboard.service';

export const clientDashboardKeys = {
  all: ['client', 'dashboard'],
};

export const useClientDashboard = () =>
  useQuery({
    queryKey: clientDashboardKeys.all,
    queryFn: () => clientDashboardService.getDashboard().then((r) => r.data?.data),
  });
