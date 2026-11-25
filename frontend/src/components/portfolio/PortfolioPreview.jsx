import { useState, useEffect, useRef } from 'react';
import { usePortfolioSiteHtml } from '@/hooks/usePortfolioSite';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { ArrowDownTrayIcon, ArrowTopRightOnSquareIcon, ArrowsPointingOutIcon, ArrowsPointingInIcon } from '@heroicons/react/24/outline';

export default function PortfolioPreview({ slug, onClose }) {
  const { data, isLoading } = usePortfolioSiteHtml(slug);
  const iframeRef = useRef(null);
  const [expanded, setExpanded] = useState(false);

  const html = data?.data?.data?.html;

  useEffect(() => {
    if (html && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
      }
    }
  }, [html]);

  const handleDownload = () => {
    if (!html) return;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug || 'portfolio'}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenNewTab = () => {
    if (!html) return;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  return (
    <Modal open={true} onClose={onClose} size="full" className="h-[90vh] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Portfolio Preview</h3>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleOpenNewTab}>
            <ArrowTopRightOnSquareIcon className="w-4 h-4 mr-1" /> Open
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDownload}>
            <ArrowDownTrayIcon className="w-4 h-4 mr-1" /> Download HTML
          </Button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700"
          >
            {expanded
              ? <ArrowsPointingInIcon className="w-4 h-4" />
              : <ArrowsPointingOutIcon className="w-4 h-4" />
            }
          </button>
        </div>
      </div>

      <div className={`flex-1 rounded-xl overflow-hidden border border-gray-200 dark:border-dark-600 bg-white ${expanded ? 'min-h-[80vh]' : ''}`}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
          </div>
        ) : html ? (
          <iframe
            ref={iframeRef}
            title="Portfolio Preview"
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            No HTML generated yet.
          </div>
        )}
      </div>
    </Modal>
  );
}
