import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useCreateCatalog } from '@/hooks/useCatalogs';
import CatalogFormWizard from '@/components/catalogs/CatalogFormWizard';

export default function CreateCatalogPage() {
  const navigate = useNavigate();
  const { mutate: createCatalog, isPending } = useCreateCatalog();

  return (
    <div className="page-container max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create Service Catalog</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Publish a service package clients can order directly. Start with the basics, pick a category &amp; skills, then set your pricing.
        </p>
      </motion.div>

      <CatalogFormWizard
        loading={isPending}
        onSubmit={(formData) =>
          createCatalog(formData, {
            onSuccess: () => navigate('/freelancer/catalogs'),
          })
        }
        onCancel={() => navigate('/freelancer/catalogs')}
      />
    </div>
  );
}
