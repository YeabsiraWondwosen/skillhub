import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useCatalog, useUpdateCatalog } from '@/hooks/useCatalogs';
import { SkeletonStats } from '@/components/ui/Skeleton';
import CatalogFormWizard from '@/components/catalogs/CatalogFormWizard';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function EditCatalogPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { data: catalogData, isLoading } = useCatalog(slug);
  const { mutate: updateCatalog, isPending } = useUpdateCatalog();

  const catalog = catalogData?.data?.data;

  if (isLoading) return <div className="page-container max-w-3xl mx-auto"><SkeletonStats /></div>;
  if (!catalog) {
    return (
      <div className="page-container max-w-3xl mx-auto text-center py-20">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Catalog not found</h2>
        <Link to="/freelancer/catalogs" className="text-primary-600 text-sm mt-2 inline-block">Back to My Services</Link>
      </div>
    );
  }

  return (
    <div className="page-container max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <Link to="/freelancer/catalogs" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-3">
          <ArrowLeftIcon className="w-4 h-4" /> Back to My Services
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Service</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Update your service details, category, skills or pricing packages.</p>
      </motion.div>

      <CatalogFormWizard
        initialData={catalog}
        loading={isPending}
        submitLabel="Save Changes"
        onSubmit={(formData) =>
          updateCatalog(
            { catalogId: catalog._id, data: formData },
            {
              onSuccess: () => navigate('/freelancer/catalogs'),
            }
          )
        }
        onCancel={() => navigate('/freelancer/catalogs')}
      />
    </div>
  );
}
