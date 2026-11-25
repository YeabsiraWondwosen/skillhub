import { useFreelancerCatalogs } from '@/hooks/useCatalogs';
import CatalogCard from '@/components/catalogs/CatalogCard';
import SectionCard from './SectionCard';
import EmptySection from './EmptySection';
import { CommandLineIcon } from '@heroicons/react/24/outline';

export default function CatalogsSection({ userId, user }) {
  const { data, isLoading } = useFreelancerCatalogs(userId, { page: 1, limit: 6 });

  const catalogs = (data?.data?.data ?? []).map((catalog) => ({ ...catalog, freelancer: user }));

  return (
    <SectionCard title="Services">
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : catalogs.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {catalogs.map((catalog, i) => (
            <CatalogCard key={catalog._id} catalog={catalog} index={i} />
          ))}
        </div>
      ) : (
        <EmptySection
          title="No active services yet"
          hint="This freelancer has not published any active services."
          icon={<CommandLineIcon className="h-7 w-7 text-gray-500" />}
        />
      )}
    </SectionCard>
  );
}
