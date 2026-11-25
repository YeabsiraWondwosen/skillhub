import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { adminService } from '@/services/admin.service';
import { useCategoryTree } from '@/hooks/useCategories';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import Modal, { ConfirmModal } from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import Avatar from '@/components/ui/Avatar';
import StarRating from '@/components/ui/StarRating';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { formatCurrency } from '@/utils/currency';
import { formatDistanceToNow } from 'date-fns';
import { clsx } from 'clsx';
import {
  EyeIcon, PencilIcon, TrashIcon,
  PauseIcon, PlayIcon, MagnifyingGlassIcon, CommandLineIcon,
  StarIcon,
} from '@heroicons/react/24/outline';

const STATUSES = ['all', 'active', 'paused', 'draft', 'archived', 'reported'];
const CATALOG_STATUSES = ['draft', 'active', 'paused', 'archived'];

export default function AdminServiceCatalogs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') ?? 'all';
  const sortBy = searchParams.get('sortBy') ?? 'newest';
  const featured = searchParams.get('featured') ?? '';
  const page = Number(searchParams.get('page') ?? '1') || 1;

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const qc = useQueryClient();

  const setFilter = (key, value) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    params.set('page', '1');
    setSearchParams(params);
  };

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setFilter('page', '1'); }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const { data: treeData } = useCategoryTree();
  const categoryTree = treeData?.data ?? [];
  const selectedMain = categoryTree.find(c => c._id === category) ?? null;
  const subs = selectedMain?.subcategories ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'services', 'catalogs', { page, status, search: debouncedSearch, category, subcategory, sortBy, featured }],
    queryFn: () => adminService.getServiceCatalogs({
      page, limit: 15, status: status || undefined,
      search: debouncedSearch || undefined,
      category: category || undefined,
      subcategory: subcategory || undefined,
      sortBy: sortBy || undefined,
      isFeatured: featured || undefined,
    }).then(r => r.data),
  });
  const catalogs = data?.data ?? [];
  const meta = data?.meta;

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'services', 'catalogs'] });

  const { mutate: changeStatus } = useMutation({
    mutationFn: ({ id, status }) => adminService.updateServiceCatalogStatus(id, status),
    onSuccess: () => { toast.success('Service status updated'); invalidate(); },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  });

  const { mutate: toggleFeatured } = useMutation({
    mutationFn: (id) => adminService.toggleServiceFeatured(id),
    onSuccess: (r) => {
      toast.success(r.data?.isFeatured ? 'Service featured' : 'Service unfeatured');
      invalidate();
    },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  });

  const { mutate: saveEdit, isPending: saving } = useMutation({
    mutationFn: ({ id, data }) => adminService.updateServiceCatalog(id, data),
    onSuccess: () => { toast.success('Service updated'); setEditing(null); invalidate(); },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  });

  const { mutate: remove } = useMutation({
    mutationFn: (id) => adminService.deleteServiceCatalog(id),
    onSuccess: () => { toast.success('Service deleted'); setDeleting(null); invalidate(); },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  });

  const onSubmitEdit = (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    saveEdit({ id: editing._id, data });
  };

  return (
    <div className="page-container space-y-6">
      <PageHeader
        icon={CommandLineIcon}
        title="Catalog Management"
        subtitle="Review, moderate and manage all marketplace services"
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search services…"
            className="input pl-9"
          />
        </div>
        <Select
          value={category}
          onChange={e => { setCategory(e.target.value); setSubcategory(''); setFilter('page', '1'); }}
          className="md:w-52"
        >
          <option value="">All categories</option>
          {categoryTree.map(main => (
            <option key={main._id} value={main._id}>{main.name}</option>
          ))}
        </Select>
        <Select
          value={subcategory}
          onChange={e => { setSubcategory(e.target.value); setFilter('page', '1'); }}
          className="md:w-52"
          disabled={!selectedMain}
        >
          <option value="">All subcategories</option>
          {subs.map(sub => (
            <option key={sub._id} value={sub._id}>{sub.name}</option>
          ))}
        </Select>
        <Select value={sortBy} onChange={e => setFilter('sortBy', e.target.value === 'newest' ? '' : e.target.value)} className="md:w-48">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="price-asc">Price: Low to High</option>
          <option value="price-desc">Price: High to Low</option>
          <option value="popular">Most ordered</option>
          <option value="highest-rated">Highest rated</option>
        </Select>
        <Select value={status} onChange={e => setFilter('status', e.target.value === 'all' ? '' : e.target.value)} className="md:w-48 capitalize">
          {STATUSES.map(s => (
            <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>
          ))}
        </Select>
        <Select value={featured} onChange={e => setFilter('featured', e.target.value)} className="md:w-48 capitalize">
          <option value="">All services</option>
          <option value="true">Featured only</option>
          <option value="false">Not featured</option>
        </Select>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}</div>
        ) : catalogs.length === 0 ? (
          <EmptyState icon={CommandLineIcon} title="No services found"
            description="No services match the current filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3">Freelancer</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Orders</th>
                  <th className="px-4 py-3">Rating</th>
                  <th className="px-4 py-3">Featured</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/40">
                {catalogs.map(cat => (
                  <tr key={cat._id} className="hover:bg-gray-50 dark:hover:bg-dark-700/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {cat.images?.[0]?.url ? (
                          <img src={cat.images[0].url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-dark-700 flex items-center justify-center">
                            <CommandLineIcon className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900 dark:text-white truncate max-w-[220px]">{cat.title}</p>
                            {cat.isFeatured && <StarIcon className="w-4 h-4 text-amber-400 shrink-0" />}
                            {cat.isReported && <span className="badge badge-danger shrink-0">Reported</span>}
                          </div>
                          <p className="text-xs text-gray-400">{formatDistanceToNow(new Date(cat.createdAt), { addSuffix: true })}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar src={cat.freelancer?.avatar?.url} alt={`${cat.freelancer?.firstName} ${cat.freelancer?.lastName}`} size="xs" />
                        <span className="text-gray-600 dark:text-gray-300 whitespace-nowrap">
                          {cat.freelancer?.firstName} {cat.freelancer?.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      <p>{cat.category?.name || '—'}</p>
                      {cat.subcategory?.name && <p className="text-xs">{cat.subcategory.name}</p>}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                      {formatCurrency(cat.startingPrice)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{cat.stats?.orders ?? 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <StarRating value={cat.stats?.avgRating ?? 0} readonly size="sm" />
                        <span className="text-xs text-gray-400">({cat.stats?.totalReviews ?? 0})</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {cat.isFeatured ? (
                        <span className="inline-flex items-center gap-1 text-amber-500 text-xs font-medium">
                          <StarIcon className="w-4 h-4" /> Featured
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge status={cat.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewing(cat)} className="btn-icon btn-ghost" title="View">
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditing(cat)} className="btn-icon btn-ghost" title="Edit">
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleFeatured(cat._id)}
                          className={clsx('btn-icon btn-ghost', cat.isFeatured ? 'text-amber-500' : 'text-gray-400')}
                          title={cat.isFeatured ? 'Unfeature' : 'Feature'}
                        >
                          <StarIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => changeStatus({ id: cat._id, status: cat.status === 'active' ? 'paused' : 'active' })}
                          className="btn-icon btn-ghost text-gray-500"
                          title={cat.status === 'active' ? 'Pause' : 'Activate'}
                        >
                          {cat.status === 'active' ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
                        </button>
                        <button onClick={() => setDeleting(cat)} className="btn-icon btn-ghost text-red-500" title="Delete">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
          <Pagination meta={meta} onPageChange={p => setFilter('page', p)} />
        </div>
      </div>

      {/* View detail modal */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.title} size="lg">
        {viewing && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge status={viewing.status} />
              {viewing.isFeatured && <Badge status="verified">Featured</Badge>}
              {viewing.isReported && <Badge status="rejected">Reported</Badge>}
              <span className="text-xs text-gray-400">{viewing.stats?.views ?? 0} views</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Freelancer</p>
                <p className="text-gray-900 dark:text-white">
                  {viewing.freelancer?.firstName} {viewing.freelancer?.lastName}
                  <span className="text-gray-400"> · {viewing.freelancer?.email}</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Category</p>
                <p className="text-gray-900 dark:text-white">
                  {viewing.category?.name} {viewing.subcategory?.name ? ` / ${viewing.subcategory.name}` : ''}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Starting price</p>
                <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(viewing.startingPrice)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Created</p>
                <p className="text-gray-900 dark:text-white">{new Date(viewing.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Short description</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">{viewing.shortDescription}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Description</p>
              <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap max-h-48 overflow-y-auto">{viewing.description}</p>
            </div>
            {viewing.skills?.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-2">Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {viewing.skills.map(s => <span key={s} className="badge badge-gray">{s}</span>)}
                </div>
              </div>
            )}
            {viewing.openReports?.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-2">Open reports ({viewing.openReports.length})</p>
                <div className="space-y-2">
                  {viewing.openReports.map(rp => (
                    <div key={rp._id} className="rounded-lg border border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10 p-3 text-sm">
                      <p className="text-gray-900 dark:text-white capitalize">{rp.reason?.replace(/_/g, ' ')}</p>
                      <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">{rp.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setViewing(null)}>Close</Button>
              <Button size="sm" onClick={() => { const c = viewing; setViewing(null); setEditing(c); }}>Edit</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Service" size="lg">
        {editing && (
          <form onSubmit={onSubmitEdit} className="space-y-4">
            <Input label="Title" name="title" defaultValue={editing.title} required maxLength={150} />
            <Textarea label="Short description" name="shortDescription" rows={2} defaultValue={editing.shortDescription} maxLength={200} />
            <Textarea label="Description" name="description" rows={4} defaultValue={editing.description} maxLength={5000} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select label="Status" name="status" defaultValue={editing.status}>
                {CATALOG_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
              <Select label="Featured" name="isFeatured" defaultValue={editing.isFeatured ? 'true' : 'false'}>
                <option value="false">No</option>
                <option value="true">Yes</option>
              </Select>
              <Select label="Active" name="isActive" defaultValue={editing.isActive ? 'true' : 'false'}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" type="button" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" size="sm" loading={saving}>Save changes</Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => remove(deleting._id)}
        title="Delete Service"
        message={`Are you sure you want to permanently delete "${deleting?.title}"?`}
        confirmLabel="Delete"
        danger
      >
        <p className="text-xs text-gray-400">Services with existing orders cannot be deleted — archive them instead.</p>
      </ConfirmModal>
    </div>
  );
}
