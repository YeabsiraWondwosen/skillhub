import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  usePortfolioTemplates,
  useMyPortfolioSites,
  useGeneratePortfolio,
  useUpdatePortfolioSite,
  useDeletePortfolioSite,
  useSetDefaultPortfolio,
  usePortfolioStats,
} from '@/hooks/usePortfolioSite';
import PortfolioPreview from './PortfolioPreview';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { useConfirm } from '@/components/ui/DialogProvider';
import { SkeletonStats } from '@/components/ui/Skeleton';
import { ArrowPathIcon, TrashIcon, StarIcon, EyeIcon, ArrowDownTrayIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';

const ACCENT_COLORS = [
  { label: 'Blue', value: '#2563eb' },
  { label: 'Indigo', value: '#4f46e5' },
  { label: 'Purple', value: '#7c3aed' },
  { label: 'Emerald', value: '#059669' },
  { label: 'Orange', value: '#ea580c' },
  { label: 'Rose', value: '#e11d48' },
  { label: 'Teal', value: '#0d9488' },
  { label: 'Dark', value: '#1a1a2e' },
];

const FONT_OPTIONS = [
  { label: 'Inter', value: 'inter' },
  { label: 'Poppins', value: 'poppins' },
  { label: 'Playfair', value: 'playfair' },
  { label: 'Fira Code', value: 'fira' },
];

const SECTION_OPTIONS = [
  { key: 'about', label: 'About Me' },
  { key: 'skills', label: 'Skills' },
  { key: 'projects', label: 'Projects' },
  { key: 'experience', label: 'Experience' },
  { key: 'github', label: 'GitHub' },
  { key: 'education', label: 'Education' },
  { key: 'languages', label: 'Languages' },
  { key: 'contact', label: 'Contact' },
];

export default function PortfolioBuilder() {
  const confirm = useConfirm();
  const [title, setTitle] = useState('');
  const [template, setTemplate] = useState('modern');
  const [accentColor, setAccentColor] = useState('#2563eb');
  const [fontFamily, setFontFamily] = useState('inter');
  const [showSections, setShowSections] = useState({
    showGitHub: true,
    showProjects: true,
    showSkills: true,
    showExperience: true,
    showEducation: true,
    showLanguages: true,
    showContact: true,
  });
  const [sectionOrder, setSectionOrder] = useState(SECTION_OPTIONS.map(s => s.key));
  const [previewSlug, setPreviewSlug] = useState(null);
  const [editingSlug, setEditingSlug] = useState(null);

  const { data: templatesData, isLoading: loadingTemplates } = usePortfolioTemplates();
  const templates = templatesData?.data?.data || [];
  const { data: sitesData, isLoading: loadingSites } = useMyPortfolioSites();
  const sites = sitesData?.data?.data || [];
  const { data: statsData } = usePortfolioStats();
  const stats = statsData?.data?.data;

  const generateMutation = useGeneratePortfolio();
  const updateMutation = useUpdatePortfolioSite();
  const deleteMutation = useDeletePortfolioSite();
  const setDefaultMutation = useSetDefaultPortfolio();

  const handleGenerate = async () => {
    const result = await generateMutation.mutateAsync({
      title: title || undefined,
      customization: {
        template,
        accentColor,
        fontFamily,
        sectionOrder,
        ...showSections,
      },
    });
    const slug = result.data?.data?.slug;
    if (slug) setPreviewSlug(slug);
  };

  const handleUpdate = async (slug) => {
    await updateMutation.mutateAsync({
      slug,
      data: {
        customization: {
          template,
          accentColor,
          fontFamily,
          sectionOrder,
          ...showSections,
        },
      },
    });
    setEditingSlug(null);
    setPreviewSlug(slug);
  };

  const handleDelete = async (slug) => {
    const ok = await confirm({
      title: 'Delete portfolio site',
      message: 'Delete this portfolio site? This action cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    await deleteMutation.mutateAsync(slug);
    if (previewSlug === slug) setPreviewSlug(null);
  };

  const handleSetDefault = async (slug) => {
    await setDefaultMutation.mutateAsync(slug);
  };

  const handleDownload = (slug) => {
    window.open(`/api/v1/portfolio-sites/view/${slug}`, '_blank');
  };

  const toggleSection = (key) => {
    const showKey = `show${key.charAt(0).toUpperCase() + key.slice(1)}`;
    setShowSections(prev => ({ ...prev, [showKey]: !prev[showKey] }));
  };

  const moveSection = (index, direction) => {
    const newOrder = [...sectionOrder];
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= newOrder.length) return;
    [newOrder[index], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[index]];
    setSectionOrder(newOrder);
  };

  if (loadingTemplates || loadingSites) return <SkeletonStats />;

  return (
    <div className="space-y-8">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Sites', value: stats.totalSites },
            { label: 'Total Views', value: stats.totalViews },
            { label: 'Downloads', value: stats.totalDownloads },
            { label: 'Default', value: stats.defaultSiteSlug || 'None' },
          ].map(s => (
            <div key={s.label} className="card p-4 text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Builder */}
      <div className="card p-6 space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <SparklesIcon className="w-5 h-5 text-primary-500" /> Build Portfolio
        </h3>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Your Name - Portfolio"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-white"
          />
        </div>

        {/* Template */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Template</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {templates.map(t => (
              <button
                key={t.id}
                onClick={() => { setTemplate(t.id); setAccentColor(t.defaultColor); }}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  template === t.id
                    ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/10'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="w-8 h-8 rounded-lg mb-2" style={{ background: t.defaultColor }} />
                <div className="font-medium text-gray-900 dark:text-white text-sm">{t.name}</div>
                <div className="text-xs text-gray-500 mt-1">{t.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Accent Color */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Accent Color</label>
          <div className="flex flex-wrap gap-2">
            {ACCENT_COLORS.map(c => (
              <button
                key={c.value}
                onClick={() => setAccentColor(c.value)}
                className={`w-9 h-9 rounded-full border-2 transition-transform ${
                  accentColor === c.value ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'
                }`}
                style={{ background: c.value }}
                title={c.label}
              />
            ))}
          </div>
        </div>

        {/* Font */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Font Family</label>
          <div className="flex gap-2">
            {FONT_OPTIONS.map(f => (
              <button
                key={f.value}
                onClick={() => setFontFamily(f.value)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                  fontFamily === f.value
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sections */}
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Section Order</label>
            <div className="space-y-2">
              {sectionOrder.map((key, i) => (
                <div key={key} className="flex items-center gap-2">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => moveSection(i, -1)} disabled={i === 0} className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-30">▲</button>
                    <button onClick={() => moveSection(i, 1)} disabled={i === sectionOrder.length - 1} className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-30">▼</button>
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {SECTION_OPTIONS.find(s => s.key === key)?.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Show Sections</label>
            <div className="space-y-2">
              {SECTION_OPTIONS.map(s => {
                const showKey = `show${s.key.charAt(0).toUpperCase() + s.key.slice(1)}`;
                return (
                  <label key={s.key} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showSections[showKey] !== false}
                      onChange={() => toggleSection(s.key)}
                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{s.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Generate */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={handleGenerate}
            loading={generateMutation.isPending}
            disabled={generateMutation.isPending}
          >
            <SparklesIcon className="w-4 h-4 mr-2" />
            Generate Portfolio
          </Button>
          {generateMutation.isError && (
            <span className="text-sm text-red-500">Generation failed. Try again.</span>
          )}
        </div>
      </div>

      {/* Existing Sites */}
      {sites.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">My Portfolio Sites</h3>
          <div className="space-y-3">
            {sites.map(site => (
              <div key={site.slug} className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-dark-800">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white truncate">{site.title}</span>
                    {site.isDefault && (
                      <Badge status="active" className="text-xs">Default</Badge>
                    )}
                    <Badge className="text-xs">{site.customization?.template || 'modern'}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                    <span className="flex items-center gap-1"><EyeIcon className="w-3 h-3" />{site.stats?.views || 0}</span>
                    <span>{new Date(site.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => setPreviewSlug(site.slug)}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Preview
                  </button>
                  {!site.isDefault && (
                    <button
                      onClick={() => handleSetDefault(site.slug)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700"
                      title="Set as default"
                    >
                      <StarIcon className="w-4 h-4 text-gray-400" />
                    </button>
                  )}
                  {site.isDefault && (
                    <StarSolidIcon className="w-4 h-4 text-yellow-500" />
                  )}
                  <button
                    onClick={() => handleDownload(site.slug)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700"
                    title="Download HTML"
                  >
                    <ArrowDownTrayIcon className="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => handleDelete(site.slug)}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                    title="Delete"
                  >
                    <TrashIcon className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewSlug && (
        <PortfolioPreview
          slug={previewSlug}
          onClose={() => setPreviewSlug(null)}
        />
      )}
    </div>
  );
}
