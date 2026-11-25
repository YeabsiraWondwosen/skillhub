import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { categoryService } from '@/services/category.service';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal, { ConfirmModal } from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import Avatar from '@/components/ui/Avatar';
import CategoryIcon, { CATEGORY_ICON_NAMES } from '@/utils/categoryIcons';
import { SkeletonStats, SkeletonCard } from '@/components/ui/Skeleton';
import { format } from 'date-fns';
import { formatCurrency, formatCurrencyRange } from '@/utils/currency';
import {
  PlusIcon,
  TrashIcon,
  PencilIcon,
  ArrowPathIcon,
  TagIcon,
  WrenchIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  StarIcon,
  EyeSlashIcon,
  EyeIcon,
  CheckCircleIcon,
  XMarkIcon,
  Squares2X2Icon,
  FolderIcon,
  UsersIcon,
  BriefcaseIcon,
  CommandLineIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { clsx } from 'clsx';

const CATEGORY_COLORS = [
  '#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#84cc16',
  '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#a855f7',
  '#8b5cf6', '#64748b', '#0ea5e9', '#14b8a6', '#059669',
  '#e11d48', '#d946ef', '#f43f5e', '#78716c', '#2563eb',
];

const EMPTY_CAT_FORM = {
  _id: '',
  name: '',
  description: '',
  icon: '',
  color: '#6366f1',
  parent: '',
  featured: false,
  isActive: true,
  isHidden: false,
};

const EMPTY_SKILL_FORM = {
  name: '',
  aliases: '',
  demandLevel: 'moderate',
};

const JOB_STATUS_LABELS = {
  draft: 'Draft',
  open: 'Open',
  proposals_received: 'Proposals Received',
  freelancer_selected: 'Freelancer Selected',
  payment_pending: 'Payment Required',
  funded: 'Funded',
  in_progress: 'In Progress',
  delivery_submitted: 'Delivery Submitted',
  client_review: 'Client Review',
  completed: 'Completed',
  cancelled: 'Cancelled',
  paused: 'Paused',
};

function SkillRow({ skill, onEdit, onToggleActive, onDelete }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-700/50 group/skill">
      <WrenchIcon className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" />
      <span className={clsx('text-sm flex-1 min-w-0 truncate', skill.isActive === false ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-300')}>
        {skill.name}
      </span>
      <span className="text-xs text-gray-400 capitalize hidden sm:inline">{skill.demandLevel}</span>
      <Badge status={skill.isActive === false ? 'inactive' : 'active'}>{skill.isActive === false ? 'Inactive' : 'Active'}</Badge>
      <div className="flex gap-0.5">
        <button onClick={() => onToggleActive(skill)} className="btn-icon btn-ghost !w-7 !h-7" title={skill.isActive === false ? 'Activate' : 'Deactivate'}>
          {skill.isActive === false ? <CheckCircleIcon className="w-3.5 h-3.5" /> : <XMarkIcon className="w-3.5 h-3.5" />}
        </button>
        <button onClick={() => onEdit(skill)} className="btn-icon btn-ghost !w-7 !h-7" title="Edit">
          <PencilIcon className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onDelete(skill)} className="btn-icon btn-ghost !w-7 !h-7 text-danger-500" title="Delete">
          <TrashIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function SubRow({ sub, stats, onManage, onToggleSubActive, onToggleSubHidden, onEditSub, onDeleteSub, onAddSkill, onEditSkill, onToggleSkillActive, onDeleteSkill }) {
  const [expanded, setExpanded] = useState(false);
  const skills = sub.skills ?? [];
  return (
    <div>
      <div className={clsx(
        'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors',
        sub.isActive === false ? 'bg-gray-50 dark:bg-dark-800/50 border-gray-100 dark:border-gray-800' : 'bg-white dark:bg-dark-800 border-gray-100 dark:border-gray-800 hover:border-primary-200 dark:hover:border-primary-800'
      )}>
        <button onClick={() => setExpanded(!expanded)} className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-400" title={expanded ? 'Collapse' : 'Expand'}>
          {expanded ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-7 h-7 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center flex-shrink-0">
              <CategoryIcon icon={sub.icon} size={14} className="text-primary-600 dark:text-primary-400" />
            </span>
            <span className={clsx('text-sm font-medium truncate', sub.isActive === false ? 'text-gray-400' : 'text-gray-800 dark:text-gray-200')}>{sub.name}</span>
            {stats && (
              <>
                <Badge status="info">{stats.freelancers} freelancers</Badge>
                <Badge status="info">{stats.jobs} jobs</Badge>
              </>
            )}
            <Badge status="info">{skills.length} skills</Badge>
            {sub.isHidden && <Badge status="draft">Hidden</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {onManage && (
            <button onClick={onManage} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-primary-600 dark:text-primary-300 border border-primary-200 dark:border-primary-700/40 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
              Manage <ChevronRightIcon className="w-3 h-3" />
            </button>
          )}
          <button onClick={onAddSkill} className="btn-icon btn-ghost !w-7 !h-7 text-primary-600" title="Add skill">
            <PlusIcon className="w-3.5 h-3.5" />
          </button>
          <button onClick={onToggleSubActive} className="btn-icon btn-ghost !w-7 !h-7" title={sub.isActive === false ? 'Activate' : 'Deactivate'}>
            {sub.isActive === false ? <CheckCircleIcon className="w-3.5 h-3.5" /> : <XMarkIcon className="w-3.5 h-3.5" />}
          </button>
          <button onClick={onToggleSubHidden} className="btn-icon btn-ghost !w-7 !h-7" title={sub.isHidden ? 'Show' : 'Hide'}>
            {sub.isHidden ? <EyeSlashIcon className="w-3.5 h-3.5" /> : <EyeIcon className="w-3.5 h-3.5" />}
          </button>
          <button onClick={onEditSub} className="btn-icon btn-ghost !w-7 !h-7" title="Edit">
            <PencilIcon className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDeleteSub} className="btn-icon btn-ghost !w-7 !h-7 text-danger-500" title="Delete">
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="ml-7 mt-1 mb-1 space-y-0.5 border-l border-gray-100 dark:border-gray-800 pl-2">
              {skills.length === 0 && <p className="text-xs text-gray-400 px-3 py-1.5">No skills yet — add one.</p>}
              {skills.map(skill => (
                <SkillRow key={skill._id} skill={skill} onEdit={() => onEditSkill(sub, skill)} onToggleActive={() => onToggleSkillActive(skill._id)} onDelete={() => onDeleteSkill(skill)} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CategoryCard({ main, onManage, onAddSub, onToggleFeatured, onToggleActive, onToggleHidden, onEdit, onDelete }) {
  const stats = main.stats || {};
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card group hover:shadow-card-hover transition-all overflow-hidden"
    >
      <div className="flex items-start gap-3 p-5">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${main.color || '#6366f1'}18` }}>
          {main.icon ? <CategoryIcon icon={main.icon} size={24} /> : <FolderIcon className="w-6 h-6 text-gray-400" aria-hidden="true" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-white truncate">{main.name}</h3>
            {main.featured && <StarIconSolid className="w-4 h-4 text-amber-500 shrink-0" />}
            {main.isHidden && <Badge status="draft">Hidden</Badge>}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{main.description || ''}</p>
        </div>
        <Badge status={main.isActive === false ? 'inactive' : 'active'}>{main.isActive === false ? 'Inactive' : 'Active'}</Badge>
      </div>

      <div className="grid grid-cols-3 gap-3 px-5 pb-5">
        <div className="rounded-xl bg-gray-50 dark:bg-dark-800/60 border border-gray-100 dark:border-gray-800 p-3 text-center">
          <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.subcategories ?? 0}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mt-0.5">Subcategories</p>
        </div>
        <div className="rounded-xl bg-gray-50 dark:bg-dark-800/60 border border-gray-100 dark:border-gray-800 p-3 text-center">
          <p className="text-xl font-bold text-primary-600 dark:text-primary-400">{stats.freelancers ?? 0}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mt-0.5">Freelancers</p>
        </div>
        <div className="rounded-xl bg-gray-50 dark:bg-dark-800/60 border border-gray-100 dark:border-gray-800 p-3 text-center">
          <p className="text-xl font-bold text-success-600 dark:text-success-500">{stats.jobs ?? 0}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mt-0.5">Open Jobs</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 px-5 py-2.5 border-t border-gray-100 dark:border-gray-800">
        <span className="text-[11px] font-medium text-gray-400">Marketplace usage</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onAddSub} className="btn-icon btn-ghost !w-8 !h-8 text-primary-600" title="Add subcategory">
            <PlusIcon className="w-4 h-4" />
          </button>
          <button onClick={onToggleFeatured} className={clsx('p-1.5 rounded-lg transition-colors', main.featured ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'text-gray-300 hover:text-amber-400 dark:text-gray-600')} title={main.featured ? 'Unfeature' : 'Feature'}>
            {main.featured ? <StarIconSolid className="w-4 h-4" /> : <StarIcon className="w-4 h-4" />}
          </button>
          <button onClick={onToggleActive} className="btn-icon btn-ghost !w-8 !h-8" title={main.isActive === false ? 'Activate' : 'Deactivate'}>
            {main.isActive === false ? <CheckCircleIcon className="w-4 h-4" /> : <XMarkIcon className="w-4 h-4" />}
          </button>
          <button onClick={onToggleHidden} className="btn-icon btn-ghost !w-8 !h-8" title={main.isHidden ? 'Show' : 'Hide'}>
            {main.isHidden ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
          </button>
          <button onClick={onEdit} className="btn-icon btn-ghost !w-8 !h-8" title="Edit">
            <PencilIcon className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="btn-icon btn-ghost !w-8 !h-8 text-danger-500" title="Delete">
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      <button
        onClick={() => onManage(main)}
        className="w-full flex items-center justify-between px-5 py-2.5 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors border-t border-gray-100 dark:border-gray-800"
      >
        Manage <ArrowRightIcon className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

function FreelancersTable({ isLoading, data, onPageChange }) {
  const freelancers = data?.data ?? [];
  const meta = data?.meta;
  return (
    <div className="card overflow-hidden">
      {isLoading ? (
        <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : freelancers.length === 0 ? (
        <EmptyState icon={UsersIcon} title="No freelancers found"
          description="No freelancers are currently using this category." />
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                {['Freelancer', 'Skills', 'Verification Status', 'Profile Status', 'Actions'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {freelancers.map(f => {
                const u = f.user || {};
                const name = `${u.firstName || ''} ${u.lastName || ''}`.trim();
                const skills = f.skills || [];
                return (
                  <tr key={f._id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar src={u.avatar?.url} alt={name} size="sm" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{name || '—'}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1 max-w-56">
                        {skills.slice(0, 3).map(s => (
                          <span key={s._id || s.name} className="text-xs bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-300 rounded-md px-2 py-0.5">{s.name}</span>
                        ))}
                        {skills.length > 3 && <span className="text-xs text-gray-400">+{skills.length - 3}</span>}
                      </div>
                    </td>
                    <td>
                      {u.isVerifiedFreelancer
                        ? <Badge status="verified">Verified</Badge>
                        : <Badge status="unverified">Not verified</Badge>}
                    </td>
                    <td>
                      {u.isBanned ? <Badge status="banned">Banned</Badge>
                        : u.isActive === false ? <Badge status="cancelled">Inactive</Badge>
                          : <Badge status="active">Active</Badge>}
                    </td>
                    <td>
                      {u._id && (
                        <Link to={`/admin/users/${u._id}`} className="text-primary-600 hover:underline text-xs font-medium inline-flex items-center gap-1">
                          Manage <ArrowRightIcon className="w-3 h-3" />
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination meta={meta} onPageChange={onPageChange} />
    </div>
  );
}

function JobsTable({ isLoading, data, onPageChange }) {
  const jobs = data?.data ?? [];
  const meta = data?.meta;
  return (
    <div className="card overflow-hidden">
      {isLoading ? (
        <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : jobs.length === 0 ? (
        <EmptyState icon={BriefcaseIcon} title="No jobs found"
          description="No jobs are currently posted under this category." />
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                {['Job Title', 'Client', 'Budget', 'Status', 'Posted Date', 'Actions'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map(j => (
                <tr key={j._id}>
                  <td className="font-medium text-gray-900 dark:text-white max-w-64">{j.title}</td>
                  <td className="text-gray-700 dark:text-gray-300">
                    {j.client ? `${j.client.firstName || ''} ${j.client.lastName || ''}`.trim() || '—' : '—'}
                  </td>
                  <td className="text-gray-700 dark:text-gray-300">
                    {formatCurrencyRange(j.budget?.minAmount, j.budget?.maxAmount, j.budget?.currency) || '—'}
                  </td>
                  <td>
                    <Badge status={j.status === 'open' ? 'active' : j.status === 'cancelled' ? 'cancelled' : j.status === 'completed' ? 'completed' : j.status === 'in_progress' || j.status === 'proposals_received' || j.status === 'funded' || j.status === 'payment_pending' || j.status === 'freelancer_selected' || j.status === 'delivery_submitted' || j.status === 'client_review' ? 'pending' : 'draft'}>
                      {JOB_STATUS_LABELS[j.status] || j.status}
                    </Badge>
                  </td>
                  <td className="text-gray-400 text-xs">{format(new Date(j.createdAt), 'MMM d, yyyy')}</td>
                  <td>
                    <Link to={`/admin/jobs/${j._id}`} className="text-primary-600 hover:underline text-xs font-medium inline-flex items-center gap-1">
                      Manage <ArrowRightIcon className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination meta={meta} onPageChange={onPageChange} />
    </div>
  );
}

function ServicesTable({ isLoading, data, onPageChange }) {
  const services = data?.data ?? [];
  const meta = data?.meta;
  return (
    <div className="card overflow-hidden">
      {isLoading ? (
        <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : services.length === 0 ? (
        <EmptyState icon={CommandLineIcon} title="No services found"
          description="No services are currently posted under this category." />
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                {['Service', 'Freelancer', 'Category', 'Price', 'Orders', 'Status', 'Actions'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {services.map(s => (
                <tr key={s._id}>
                  <td className="font-medium text-gray-900 dark:text-white max-w-56 truncate">{s.title}</td>
                  <td className="text-gray-700 dark:text-gray-300">
                    {s.freelancer ? `${s.freelancer.firstName || ''} ${s.freelancer.lastName || ''}`.trim() || '—' : '—'}
                  </td>
                  <td className="text-gray-700 dark:text-gray-300">
                    {s.category?.name || '—'}{s.subcategory?.name ? ` / ${s.subcategory.name}` : ''}
                  </td>
                  <td className="font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                    {formatCurrency(s.startingPrice, s.currency) || '—'}
                  </td>
                  <td className="text-gray-600 dark:text-gray-300">{s.stats?.orders ?? 0}</td>
                  <td>
                    <Badge status={s.status}>{s.status}</Badge>
                  </td>
                  <td>
                    <Link to="/admin/services/catalogs" className="text-primary-600 hover:underline text-xs font-medium inline-flex items-center gap-1">
                      Manage <ArrowRightIcon className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination meta={meta} onPageChange={onPageChange} />
    </div>
  );
}

function CategoryForm({ form, setForm, isSub, mains, onSubmit, onCancel, loading }) {
  const [showIconPicker, setShowIconPicker] = useState(false);
  return (
    <div className="space-y-5">
      <Input label="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={isSub ? 'e.g. Web Development' : 'e.g. Development & Technology'} />
      {isSub && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Parent Main Category</label>
          <select value={form.parent} onChange={(e) => setForm({ ...form, parent: e.target.value })} className="input">
            <option value="">Select…</option>
            {mains.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="input" placeholder="Brief description…" maxLength={500} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Icon</label>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setShowIconPicker(!showIconPicker)} className="w-10 h-10 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-dark-700">
              {form.icon ? <CategoryIcon icon={form.icon} size={20} /> : <FolderIcon className="w-5 h-5 text-gray-400" aria-hidden="true" />}
            </button>
            <Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="Icon identifier (e.g. code)" className="flex-1" />
            <button type="button" onClick={() => setForm({ ...form, icon: '' })} className="btn-icon btn-ghost text-gray-400" title="Clear icon">
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-400">Use a line icon identifier, or an emoji for legacy styling.</p>
          <AnimatePresence>
            {showIconPicker && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="mt-2 p-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-dark-800 max-h-56 overflow-y-auto space-y-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Line icons</p>
                    <div className="grid grid-cols-8 gap-1">
                      {CATEGORY_ICON_NAMES.map(id => (
                        <button key={id} type="button" onClick={() => { setForm({ ...form, icon: id }); setShowIconPicker(false); }}
                          className={`w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white dark:hover:bg-dark-600 ${form.icon === id ? 'bg-primary-100 dark:bg-primary-900/30 ring-2 ring-primary-500' : ''}`}
                          title={id}>
                          <CategoryIcon icon={id} size={16} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Emoji (legacy)</p>
                    <div className="grid grid-cols-10 gap-1">
                      {['💻','🎨','✍️','📈','💼','💰','🎬','🎵','⚙️','📚','🤖','🎧','📋','🏠','🎯','📱','🎮','🏗️','📷','🔬','🧵','🎭','🎤','⚖️','📦'].map(icon => (
                        <button key={icon} type="button" onClick={() => { setForm({ ...form, icon }); setShowIconPicker(false); }}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white dark:hover:bg-dark-600 ${form.icon === icon ? 'bg-primary-100 dark:bg-primary-900/30 ring-2 ring-primary-500' : ''}`}>
                          <CategoryIcon icon={icon} size={16} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Color</label>
          <div className="flex items-center gap-2 flex-wrap">
            {CATEGORY_COLORS.map(c => (
              <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent hover:scale-105'}`} style={{ backgroundColor: c }} />
            ))}
            <input type="color" value={form.color || '#6366f1'} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-7 h-7 rounded-full cursor-pointer border-0 p-0" />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500" />
          <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500" />
          <span className="text-sm text-gray-700 dark:text-gray-300">Featured</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.isHidden} onChange={(e) => setForm({ ...form, isHidden: e.target.checked })} className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500" />
          <span className="text-sm text-gray-700 dark:text-gray-300">Hidden</span>
        </label>
      </div>
      <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button loading={loading} onClick={onSubmit}>Save</Button>
      </div>
    </div>
  );
}

function SkillForm({ form, setForm, onSubmit, onCancel, loading }) {
  return (
    <div className="space-y-4">
      <Input label="Skill Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. React Development" />
      <Input label="Aliases (comma separated)" value={form.aliases} onChange={(e) => setForm({ ...form, aliases: e.target.value })} placeholder="e.g. ReactJS, React.js" />
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Demand Level</label>
        <select value={form.demandLevel} onChange={(e) => setForm({ ...form, demandLevel: e.target.value })} className="input">
          <option value="high">High</option>
          <option value="moderate">Moderate</option>
          <option value="low">Low</option>
        </select>
      </div>
      <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button loading={loading} onClick={onSubmit}>Save</Button>
      </div>
    </div>
  );
}

export default function AdminCategories() {
  const qc = useQueryClient();
  const [showCreateCat, setShowCreateCat] = useState(false);
  const [editCat, setEditCat] = useState(null);
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [editingSkill, setEditingSkill] = useState(null);
  const [skillSub, setSkillSub] = useState(null);
  const [catForm, setCatForm] = useState({ ...EMPTY_CAT_FORM });
  const [skillForm, setSkillForm] = useState({ ...EMPTY_SKILL_FORM });
  const [deleteCatTarget, setDeleteCatTarget] = useState(null);
  const [deleteSkillTarget, setDeleteSkillTarget] = useState(null);
  const [view, setView] = useState({ type: 'list' });
  const [tab, setTab] = useState('freelancers');
  const [flPage, setFlPage] = useState(1);
  const [jobsPage, setJobsPage] = useState(1);
  const [servicesPage, setServicesPage] = useState(1);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-category-tree'] });
    qc.invalidateQueries({ queryKey: ['admin-categories-stats'] });
    qc.invalidateQueries({ queryKey: ['admin-categories-overview'] });
    qc.invalidateQueries({ queryKey: ['admin-category-detail'] });
  };

  const { data, isLoading } = useQuery({
    queryKey: ['admin-category-tree'],
    queryFn: () => categoryService.getAdminTree().then((r) => r.data),
    staleTime: 30000,
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-categories-stats'],
    queryFn: () => categoryService.getCategoriesStats().then((r) => r.data),
    staleTime: 60000,
  });

  const { data: overviewData, isLoading: overviewLoading } = useQuery({
    queryKey: ['admin-categories-overview'],
    queryFn: () => categoryService.getAdminCategoryOverview().then((r) => r.data),
    staleTime: 30000,
  });

  const tree = data?.data ?? [];
  const stats = statsData?.data;
  const overview = overviewData?.data ?? [];

  const inDetail = view.type === 'main' || view.type === 'sub';
  const catId = inDetail ? view.id : null;

  const detailQuery = useQuery({
    queryKey: ['admin-category-detail', catId],
    queryFn: () => categoryService.getAdminCategoryDetail(catId).then((r) => r.data),
    enabled: !!catId,
    staleTime: 30000,
  });
  const detail = detailQuery.data?.data;
  const detailCat = detail?.category;
  const isMainDetail = view.type === 'main';

  const freelancersQuery = useQuery({
    queryKey: ['admin-category-freelancers', catId, flPage],
    queryFn: () => categoryService.getAdminCategoryFreelancers(catId, { page: flPage, limit: 10 }).then((r) => r.data),
    enabled: inDetail && tab === 'freelancers',
  });

  const jobsQuery = useQuery({
    queryKey: ['admin-category-jobs', catId, jobsPage],
    queryFn: () => categoryService.getAdminCategoryJobs(catId, { page: jobsPage, limit: 10 }).then((r) => r.data),
    enabled: inDetail && tab === 'jobs',
  });

  const servicesQuery = useQuery({
    queryKey: ['admin-category-services', catId, servicesPage],
    queryFn: () => categoryService.getAdminCategoryServices(catId, { page: servicesPage, limit: 10 }).then((r) => r.data),
    enabled: inDetail && tab === 'services',
  });

  const skillsBySub = useMemo(() => {
    const map = {};
    for (const m of tree) {
      for (const s of m.subcategories || []) map[s._id] = s.skills || [];
    }
    return map;
  }, [tree]);

  const totalSkills = useMemo(() => tree.reduce((acc, m) => acc + (m.subcategories || []).reduce((a, s) => a + (s.skills || []).length, 0), 0), [tree]);

  const tabs = isMainDetail
    ? [
        { key: 'freelancers', label: 'Freelancers', icon: UsersIcon },
        { key: 'jobs', label: 'Jobs', icon: BriefcaseIcon },
        { key: 'services', label: 'Services', icon: CommandLineIcon },
        { key: 'subcategories', label: 'Subcategories', icon: FolderIcon },
      ]
    : [
        { key: 'freelancers', label: 'Freelancers', icon: UsersIcon },
        { key: 'jobs', label: 'Jobs', icon: BriefcaseIcon },
        { key: 'services', label: 'Services', icon: CommandLineIcon },
      ];

  const openMainDetail = (main) => {
    setView({ type: 'main', id: main._id });
    setTab('freelancers');
    setFlPage(1);
    setJobsPage(1);
    setServicesPage(1);
  };

  const openSubDetail = (sub, main) => {
    setView({ type: 'sub', id: sub._id, parentId: main._id, parentName: main.name });
    setTab('freelancers');
    setFlPage(1);
    setJobsPage(1);
    setServicesPage(1);
  };

  const goBack = () => {
    if (view.type === 'sub') {
      setView({ type: 'main', id: view.parentId });
    } else {
      setView({ type: 'list' });
    }
    setTab('freelancers');
    setFlPage(1);
    setJobsPage(1);
    setServicesPage(1);
  };

  const openCreateMain = () => {
    setCatForm({ ...EMPTY_CAT_FORM });
    setShowCreateCat(true);
  };

  const openCreateSub = (main) => {
    setCatForm({ ...EMPTY_CAT_FORM, parent: main._id });
    setShowCreateCat(true);
  };

  const openEditCat = (cat) => {
    setEditCat(cat);
    setCatForm({
      _id: cat._id,
      name: cat.name,
      description: cat.description || '',
      icon: cat.icon || '',
      color: cat.color || '#6366f1',
      parent: cat.parent || '',
      featured: cat.featured || false,
      isActive: cat.isActive !== false,
      isHidden: cat.isHidden || false,
    });
  };

  const openSkillCreate = (sub) => {
    setSkillSub(sub);
    setEditingSkill(null);
    setSkillForm({ ...EMPTY_SKILL_FORM });
    setShowSkillModal(true);
  };

  const openSkillEdit = (sub, skill) => {
    setSkillSub(sub);
    setEditingSkill(skill);
    setSkillForm({
      name: skill.name,
      aliases: (skill.aliases || []).join(', '),
      demandLevel: skill.demandLevel || 'moderate',
    });
    setShowSkillModal(true);
  };

  const { mutate: createCategory, isPending: isCreatingCat } = useMutation({
    mutationFn: (d) => categoryService.createCategory(d),
    onSuccess: () => { toast.success('Category created'); invalidate(); setShowCreateCat(false); setEditCat(null); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to create category'),
  });

  const { mutate: updateCategory, isPending: isUpdatingCat } = useMutation({
    mutationFn: ({ id, ...d }) => categoryService.updateCategory(id, d),
    onSuccess: () => { toast.success('Category updated'); invalidate(); setShowCreateCat(false); setEditCat(null); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to update category'),
  });

  const { mutate: deleteCategory } = useMutation({
    mutationFn: (id) => categoryService.deleteCategory(id),
    onSuccess: () => { toast.success('Category deleted'); invalidate(); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to delete category'),
  });

  const { mutate: createSkill, isPending: isCreatingSkill } = useMutation({
    mutationFn: ({ categoryId, data }) => categoryService.createSkill(categoryId, data),
    onSuccess: () => { toast.success('Skill added'); invalidate(); setShowSkillModal(false); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to add skill'),
  });

  const { mutate: updateSkill, isPending: isUpdatingSkill } = useMutation({
    mutationFn: ({ id, data }) => categoryService.updateSkill(id, data),
    onSuccess: () => { toast.success('Skill updated'); invalidate(); setShowSkillModal(false); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to update skill'),
  });

  const { mutate: deleteSkill } = useMutation({
    mutationFn: (id) => categoryService.deleteSkill(id),
    onSuccess: () => { toast.success('Skill deleted'); invalidate(); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to delete skill'),
  });

  const { mutate: toggleSkillActive } = useMutation({
    mutationFn: (id) => categoryService.toggleSkillActive(id),
    onSuccess: () => { toast.success('Skill status updated'); invalidate(); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const { mutate: seedCategories, isPending: isSeeding } = useMutation({
    mutationFn: () => categoryService.seedCategories(),
    onSuccess: (res) => { toast.success(res.data?.message || 'Categories seeded'); invalidate(); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to seed categories'),
  });

  const { mutate: toggleFeatured } = useMutation({
    mutationFn: (id) => categoryService.toggleFeatured(id),
    onSuccess: () => { toast.success('Updated'); invalidate(); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const { mutate: toggleHidden } = useMutation({
    mutationFn: (id) => categoryService.toggleHidden(id),
    onSuccess: () => { toast.success('Updated'); invalidate(); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const { mutate: bulkAction } = useMutation({
    mutationFn: ({ ids, action }) => categoryService.bulkCategoriesAction(ids, action),
    onSuccess: (res, vars) => { toast.success(`Bulk ${vars.action} completed`); invalidate(); },
    onError: (e) => toast.error(e.response?.data?.message || 'Bulk action failed'),
  });

  const handleCatSubmit = () => {
    if (!catForm.name.trim()) return toast.error('Category name is required');
    if (editCat) {
      const { _id, ...payload } = catForm;
      updateCategory({ id: _id, ...payload, parent: payload.parent || null });
    } else {
      createCategory({ ...catForm, parent: catForm.parent || undefined });
    }
  };

  const handleSkillSubmit = () => {
    if (!skillForm.name.trim()) return toast.error('Skill name is required');
    const payload = {
      name: skillForm.name.trim(),
      demandLevel: skillForm.demandLevel,
      aliases: skillForm.aliases.split(',').map(a => a.trim()).filter(Boolean),
    };
    if (editingSkill) {
      updateSkill({ id: editingSkill._id, data: payload });
    } else {
      createSkill({ categoryId: skillSub._id, data: payload });
    }
  };

  const mainsForForm = editCat && editCat.parent ? tree.filter(m => m._id !== editCat._id) : tree;

  return (
    <div className="page-container space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statsLoading ? (
          <SkeletonStats />
        ) : (
          <>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="stat-card group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                  <Squares2X2Icon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.mainCategories ?? 0}</div>
                  <div className="text-xs text-gray-500">Main Categories</div>
                </div>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="stat-card group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-success-100 dark:bg-success-900/30 flex items-center justify-center">
                  <FolderIcon className="w-5 h-5 text-success-600 dark:text-success-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.subcategories ?? 0}</div>
                  <div className="text-xs text-gray-500">Subcategories</div>
                </div>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="stat-card group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <WrenchIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.totalSkills ?? totalSkills}</div>
                  <div className="text-xs text-gray-500">Skills</div>
                </div>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="stat-card group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <StarIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.featured ?? 0}</div>
                  <div className="text-xs text-gray-500">Featured Mains</div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </div>

      {/* Header */}
      <PageHeader
        icon={TagIcon}
        title="Category Management"
        subtitle="Main category → Subcategory → Freelancers & Jobs"
        actions={
          <>
            <Button variant="secondary" loading={isSeeding} onClick={seedCategories} size="sm">
              <ArrowPathIcon className="w-4 h-4 mr-1" /> Seed Defaults
            </Button>
            <Button onClick={openCreateMain} size="sm">
              <PlusIcon className="w-4 h-4 mr-1" /> Add Main Category
            </Button>
          </>
        }
      />

      {view.type === 'list' ? (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Main Categories</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Usage across the marketplace — open jobs and freelancers per category.</p>
            </div>
          </div>
          {overviewLoading ? (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="card p-5 space-y-3 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-gray-700" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[0, 1, 2].map(k => <div key={k} className="h-16 bg-gray-200 dark:bg-gray-700 rounded-xl" />)}
                  </div>
                </div>
              ))}
            </div>
          ) : overview.length === 0 ? (
            <div className="card p-8">
              <EmptyState icon={TagIcon} title="No categories found"
                description="Create your first main category or seed the defaults."
                action={
                  <Button onClick={openCreateMain} size="sm">
                    <PlusIcon className="w-4 h-4 mr-1" /> Create First Main Category
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
              {overview.map(main => (
                <CategoryCard
                  key={main._id}
                  main={main}
                  onManage={openMainDetail}
                  onAddSub={() => openCreateSub(main)}
                  onToggleFeatured={() => toggleFeatured(main._id)}
                  onToggleActive={() => bulkAction({ ids: [main._id], action: main.isActive === false ? 'activate' : 'deactivate' })}
                  onToggleHidden={() => toggleHidden(main._id)}
                  onEdit={() => openEditCat(main)}
                  onDelete={() => setDeleteCatTarget(main)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-6">
          {/* Detail header */}
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={goBack} className="btn-icon btn-ghost" title="Back">
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            {detailCat ? (
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${detailCat.color || '#6366f1'}18` }}>
                  {detailCat.icon ? <CategoryIcon icon={detailCat.icon} size={22} /> : <FolderIcon className="w-5 h-5 text-gray-400" aria-hidden="true" />}
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate flex items-center gap-2">
                    {detailCat.name}
                    {detailCat.featured && <StarIconSolid className="w-4 h-4 text-amber-500 shrink-0" />}
                    {detailCat.isHidden && <Badge status="draft">Hidden</Badge>}
                  </h2>
                  {isMainDetail
                    ? <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{detailCat.description || ''}</p>
                    : <p className="text-xs text-gray-500 dark:text-gray-400">Subcategory of {view.parentName || 'Main Category'}</p>}
                </div>
              </div>
            ) : (
              <div className="flex-1 h-8 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            )}
            {isMainDetail && detailCat && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => openCreateSub(detailCat)} className="btn-icon btn-ghost !w-8 !h-8 text-primary-600" title="Add subcategory">
                  <PlusIcon className="w-4 h-4" />
                </button>
                <button onClick={() => toggleFeatured(detailCat._id)} className={clsx('p-1.5 rounded-lg transition-colors', detailCat.featured ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'text-gray-300 hover:text-amber-400 dark:text-gray-600')} title={detailCat.featured ? 'Unfeature' : 'Feature'}>
                  {detailCat.featured ? <StarIconSolid className="w-4 h-4" /> : <StarIcon className="w-4 h-4" />}
                </button>
                <button onClick={() => bulkAction({ ids: [detailCat._id], action: detailCat.isActive === false ? 'activate' : 'deactivate' })} className="btn-icon btn-ghost !w-8 !h-8" title={detailCat.isActive === false ? 'Activate' : 'Deactivate'}>
                  {detailCat.isActive === false ? <CheckCircleIcon className="w-4 h-4" /> : <XMarkIcon className="w-4 h-4" />}
                </button>
                <button onClick={() => toggleHidden(detailCat._id)} className="btn-icon btn-ghost !w-8 !h-8" title={detailCat.isHidden ? 'Show' : 'Hide'}>
                  {detailCat.isHidden ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                </button>
                <button onClick={() => openEditCat(detailCat)} className="btn-icon btn-ghost !w-8 !h-8" title="Edit">
                  <PencilIcon className="w-4 h-4" />
                </button>
                <button onClick={() => setDeleteCatTarget(detailCat)} className="btn-icon btn-ghost !w-8 !h-8 text-danger-500" title="Delete">
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="stat-card">
              <p className="stat-value text-primary-600 dark:text-primary-400">{detail?.stats?.freelancers ?? '–'}</p>
              <p className="stat-label">Total Freelancers</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="stat-card">
              <p className="stat-value text-success-600 dark:text-success-500">{detail?.stats?.jobs ?? '–'}</p>
              <p className="stat-label">Total Jobs</p>
            </motion.div>
            {isMainDetail && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="stat-card">
                <p className="stat-value">{detail?.stats?.subcategories ?? '–'}</p>
                <p className="stat-label">Total Subcategories</p>
              </motion.div>
            )}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: isMainDetail ? 0.15 : 0.1 }} className="stat-card">
              <p className="stat-value">{detail?.stats?.active ? 'Active' : detail ? 'Inactive' : '–'}</p>
              <p className="stat-label">Status</p>
            </motion.div>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} className={clsx('filter-pill inline-flex items-center gap-1.5', tab === t.key && 'filter-pill-active')}>
                <t.icon className="w-4 h-4" /> {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === 'freelancers' && (
            <FreelancersTable
              isLoading={freelancersQuery.isLoading}
              data={freelancersQuery.data}
              onPageChange={setFlPage}
            />
          )}
          {tab === 'jobs' && (
            <JobsTable
              isLoading={jobsQuery.isLoading}
              data={jobsQuery.data}
              onPageChange={setJobsPage}
            />
          )}
          {tab === 'services' && (
            <ServicesTable
              isLoading={servicesQuery.isLoading}
              data={servicesQuery.data}
              onPageChange={setServicesPage}
            />
          )}
          {tab === 'subcategories' && isMainDetail && (
            <div className="card p-4">
              {(detail?.subcategories || []).length === 0 ? (
                <EmptyState icon={FolderIcon} title="No subcategories"
                  description="Add a subcategory to this main category." />
              ) : (
                <div className="space-y-1">
                  {detail.subcategories.map(sub => (
                    <SubRow
                      key={sub._id}
                      sub={{ ...sub, skills: skillsBySub[sub._id] || sub.skills || [] }}
                      stats={sub.stats}
                      onManage={() => openSubDetail(sub, detailCat)}
                      onToggleSubActive={() => bulkAction({ ids: [sub._id], action: sub.isActive === false ? 'activate' : 'deactivate' })}
                      onToggleSubHidden={() => toggleHidden(sub._id)}
                      onEditSub={() => openEditCat(sub)}
                      onDeleteSub={() => setDeleteCatTarget(sub)}
                      onAddSkill={() => openSkillCreate(sub)}
                      onEditSkill={openSkillEdit}
                      onToggleSkillActive={toggleSkillActive}
                      onDeleteSkill={setDeleteSkillTarget}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Category Create/Edit Modal */}
      <Modal
        open={showCreateCat || !!editCat}
        onClose={() => { setShowCreateCat(false); setEditCat(null); }}
        title={editCat ? 'Edit Category' : catForm.parent ? 'Add Subcategory' : 'Add Main Category'}
        size="lg"
      >
        <CategoryForm
          form={catForm}
          setForm={setCatForm}
          isSub={!!catForm.parent}
          mains={mainsForForm}
          onSubmit={handleCatSubmit}
          onCancel={() => { setShowCreateCat(false); setEditCat(null); }}
          loading={isCreatingCat || isUpdatingCat}
        />
      </Modal>

      {/* Skill Create/Edit Modal */}
      <Modal
        open={showSkillModal}
        onClose={() => setShowSkillModal(false)}
        title={editingSkill ? 'Edit Skill' : `Add Skill to ${skillSub?.name || 'subcategory'}`}
      >
        <SkillForm
          form={skillForm}
          setForm={setSkillForm}
          onSubmit={handleSkillSubmit}
          onCancel={() => setShowSkillModal(false)}
          loading={isCreatingSkill || isUpdatingSkill}
        />
      </Modal>

      {/* Delete Category Confirm */}
      <ConfirmModal
        open={!!deleteCatTarget}
        onClose={() => setDeleteCatTarget(null)}
        onConfirm={() => { if (deleteCatTarget) deleteCategory(deleteCatTarget._id); setDeleteCatTarget(null); }}
        title="Delete Category"
        message={`Are you sure you want to delete "${deleteCatTarget?.name}"? Categories with subcategories or skills cannot be deleted.`}
        confirmLabel="Delete"
        danger
      />

      {/* Delete Skill Confirm */}
      <ConfirmModal
        open={!!deleteSkillTarget}
        onClose={() => setDeleteSkillTarget(null)}
        onConfirm={() => { if (deleteSkillTarget) deleteSkill(deleteSkillTarget._id); setDeleteSkillTarget(null); }}
        title="Delete Skill"
        message={`Are you sure you want to delete the skill "${deleteSkillTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
