import { useParams, Link } from 'react-router-dom';
import { useApplication } from '@/hooks/useApplications';
import Badge from '@/components/ui/Badge';
import { SkeletonText } from '@/components/ui/Skeleton';
import { format } from 'date-fns';
import { PaperClipIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '@/utils/currency';
import { ArrowLeft } from 'lucide-react';

export default function FreelancerProposalDetail() {
  const { appId } = useParams();
  const { data, isLoading } = useApplication(appId);
  const app = data?.data;

  if (isLoading) return <div className="page-container"><SkeletonText lines={8} /></div>;
  if (!app) return <div className="page-container text-gray-500">Application not found.</div>;

  return (
    <div className="page-container max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">Proposal Details</h1>
          <p className="section-sub">{app.job?.title}</p>
        </div>
        <Badge status={app.status} />
      </div>

      <div className="card p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-400">Offer Amount</span><p className="font-bold text-gray-900 dark:text-white mt-0.5">{formatCurrency(app.priceOffer?.amount)} ({app.priceOffer?.type})</p></div>
          <div><span className="text-gray-400">Delivery Time</span><p className="font-bold text-gray-900 dark:text-white mt-0.5">{app.deliveryTime?.value} {app.deliveryTime?.unit}</p></div>
          <div><span className="text-gray-400">Applied On</span><p className="font-bold text-gray-900 dark:text-white mt-0.5">{format(new Date(app.createdAt), 'MMM d, yyyy')}</p></div>
          <div><span className="text-gray-400">Last Updated</span><p className="font-bold text-gray-900 dark:text-white mt-0.5">{format(new Date(app.updatedAt), 'MMM d, yyyy')}</p></div>
        </div>

        <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
          <p className="text-sm text-gray-400 mb-1">Cover Letter</p>
          <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{app.coverLetter}</p>
        </div>

        {app.attachments?.length > 0 && (
          <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
            <p className="text-sm text-gray-400 mb-2">Attachments</p>
            {app.attachments.map(a => (
              <a key={a.publicId} href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary-600 hover:underline">
                <PaperClipIcon className="w-4 h-4" />{a.originalName}
              </a>
            ))}
          </div>
        )}

        {app.rejectionReason && (
          <div className="border-t border-red-100 dark:border-red-900/20 pt-4">
            <p className="text-sm text-red-500 font-medium mb-1">Reason</p>
            <p className="text-sm text-gray-600 dark:text-gray-300">{app.rejectionReason}</p>
          </div>
        )}
      </div>

      <Link to="/freelancer/proposals" className="btn-secondary btn-sm inline-flex items-center gap-1.5"><ArrowLeft size={14} /> Back to Proposals</Link>
    </div>
  );
}
