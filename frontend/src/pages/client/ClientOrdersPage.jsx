import OrdersListPage from '@/pages/orders/OrdersListPage';

export default function ClientOrdersPage() {
  return <OrdersListPage as="client" basePath="/client/service-orders" />;
}
