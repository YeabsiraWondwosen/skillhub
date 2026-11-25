import { useState } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { useMyResumes, useResume, useDeleteResume, useDownloadResume } from '@hooks/useResume';
import { FileText, Download, Palette, CircleCheck, LoaderCircle, Circle, CircleX, X } from 'lucide-react';

const STATUS_CONFIG = {
  completed: { color: 'text-green-600 bg-green-50 dark:bg-green-900/20', icon: CircleCheck, label: 'Ready' },
  generating: { color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20', icon: LoaderCircle, label: 'Generating', spin: true },
  draft: { color: 'text-gray-600 bg-gray-50 dark:bg-gray-800', icon: Circle, label: 'Draft' },
  failed: { color: 'text-red-600 bg-red-50 dark:bg-red-900/20', icon: CircleX, label: 'Failed' },
};

function ResumeCard({ resume, onSelect, onDelete, onDownload }) {
  const status = STATUS_CONFIG[resume.status] || STATUS_CONFIG.draft;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-md transition-all cursor-pointer"
      onClick={() => onSelect(resume._id)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
            <FileText size={22} className="text-gray-400" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Resume v{resume.version || 1}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {new Date(resume.createdAt).toLocaleDateString()}
              {resume.generationDuration > 0 && ` • ${(resume.generationDuration / 1000).toFixed(1)}s`}
            </p>
          </div>
        </div>
        <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1', status.color)}>
          {status.icon && <status.icon className={clsx('w-3 h-3', status.spin && 'animate-spin')} aria-hidden="true" />}
          {status.label}
        </span>
      </div>

      {resume.status === 'completed' && (
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1"><Download size={12} aria-hidden="true" /> {resume.downloadCount || 0} downloads</span>
            <span className="inline-flex items-center gap-1"><Palette size={12} aria-hidden="true" /> {resume.customization?.template || 'modern'}</span>
          </div>
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => onDownload(resume._id)}
              className="px-2.5 py-1 text-xs font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              Download
            </button>
            <button
              onClick={() => onDelete(resume._id)}
              className="px-2.5 py-1 text-xs font-medium text-red-500 bg-red-50 dark:bg-red-900/10 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {resume.status === 'failed' && resume.errorMessage && (
        <p className="mt-2 text-xs text-red-500">{resume.errorMessage}</p>
      )}
    </motion.div>
  );
}

function ResumePreviewModal({ resumeId, onClose }) {
  const { data: resume, isLoading } = useResume(resumeId);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-8" onClick={e => e.stopPropagation()}>
          <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-gray-500 mt-3 text-center">Loading preview...</p>
        </div>
      </div>
    );
  }

  if (!resume) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-gray-900 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Resume Preview</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close preview">
            <X size={20} />
          </button>
        </div>

        {/* Preview Content */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 space-y-4">
          {/* Header */}
          <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
            <h2 className="text-2xl font-bold" style={{ color: resume.customization?.accentColor || '#2563eb' }}>
              {resume.content?.fullName}
            </h2>
            {resume.content?.tagline && (
              <p className="text-gray-600 dark:text-gray-400 mt-1">{resume.content.tagline}</p>
            )}
            <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-500">
              {resume.content?.email && <span>{resume.content.email}</span>}
              {resume.content?.location && <span>• {resume.content.location}</span>}
              {resume.content?.github && <span>• github.com/{resume.content.github}</span>}
            </div>
            {resume.content?.stats && (
              <div className="flex gap-3 mt-2 text-xs font-medium" style={{ color: resume.customization?.accentColor }}>
                {resume.content.stats.completedProjects > 0 && <span>{resume.content.stats.completedProjects} Projects</span>}
                {resume.content.stats.averageRating > 0 && <span>• {resume.content.stats.averageRating}/5 Rating</span>}
                {resume.content.stats.freelancerLevel !== 'newcomer' && (
                  <span>• {resume.content.stats.freelancerLevel?.replace('_', ' ')}</span>
                )}
              </div>
            )}
          </div>

          {/* Summary */}
          {(resume.aiContent?.professionalSummary || resume.content?.summary) && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: resume.customization?.accentColor }}>
                Professional Summary
              </h4>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {resume.aiContent?.professionalSummary || resume.content.summary}
              </p>
            </div>
          )}

          {/* Skills */}
          {resume.content?.skills?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: resume.customization?.accentColor }}>
                Technical Skills
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {resume.content.skills.map((skill, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                    {skill.name} {skill.level && <span className="opacity-60">• {skill.level}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Experience */}
          {resume.content?.experience?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: resume.customization?.accentColor }}>
                Work Experience
              </h4>
              {resume.content.experience.map((exp, i) => (
                <div key={i} className="mb-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{exp.title} at {exp.company}</p>
                  <p className="text-xs text-gray-500">
                    {exp.startDate && new Date(exp.startDate).toLocaleDateString()} - {exp.isCurrent ? 'Present' : exp.endDate ? new Date(exp.endDate).toLocaleDateString() : ''}
                  </p>
                  {exp.description && <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{exp.description}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Education */}
          {resume.content?.education?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: resume.customization?.accentColor }}>
                Education
              </h4>
              {resume.content.education.map((edu, i) => (
                <div key={i} className="mb-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{edu.degree}{edu.fieldOfStudy ? ` in ${edu.fieldOfStudy}` : ''}</p>
                  <p className="text-xs text-gray-500">{edu.institution}</p>
                </div>
              ))}
            </div>
          )}

          {/* Portfolio */}
          {resume.content?.portfolio?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: resume.customization?.accentColor }}>
                Portfolio & Projects
              </h4>
              {resume.content.portfolio.map((p, i) => (
                <div key={i} className="mb-1.5">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{p.title}</p>
                  {p.technologies?.length > 0 && (
                    <p className="text-xs" style={{ color: resume.customization?.accentColor }}>
                      {p.technologies.join(' • ')}
                    </p>
                  )}
                  {p.description && <p className="text-xs text-gray-600 dark:text-gray-400">{p.description}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Languages */}
          {resume.content?.languages?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: resume.customization?.accentColor }}>
                Languages
              </h4>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {resume.content.languages.map(l => `${l.name}${l.proficiency ? ` (${l.proficiency})` : ''}`).join(' • ')}
              </p>
            </div>
          )}

          {/* GitHub */}
          {resume.content?.github?.username && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: resume.customization?.accentColor }}>
                GitHub Profile
              </h4>
              <p className="text-sm" style={{ color: resume.customization?.accentColor }}>
                github.com/{resume.content.github.username}
              </p>
              <p className="text-xs text-gray-500">
                {resume.content.github.totalStars} Stars • {resume.content.github.totalForks} Forks • Score: {resume.content.github.contributionScore}/100
              </p>
            </div>
          )}
        </div>

        {/* AI Enhancements Note */}
        {resume.aiContent?.generatedAt && (
          <p className="text-xs text-gray-400 mt-3 text-center">
            Content enhanced by AI • Generated {new Date(resume.generatedAt).toLocaleString()}
          </p>
        )}
      </motion.div>
    </div>
  );
}

export default function ResumeHistory({ onBuildNew }) {
  const [previewId, setPreviewId] = useState(null);
  const { data: resumesData, isLoading } = useMyResumes({ limit: 20 });
  const deleteResume = useDeleteResume();
  const downloadResume = useDownloadResume();

  const resumes = resumesData?.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Your Resumes</h3>
        {onBuildNew && (
          <button
            onClick={onBuildNew}
            className="px-4 py-2 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            + New Resume
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : resumes.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
          <FileText size={40} className="mx-auto mb-3 text-gray-400" aria-hidden="true" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No resumes generated yet</p>
          {onBuildNew && (
            <button onClick={onBuildNew} className="mt-3 text-sm text-primary-500 hover:text-primary-600 font-medium">
              Build your first resume
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {resumes.map(resume => (
            <ResumeCard
              key={resume._id}
              resume={resume}
              onSelect={setPreviewId}
              onDelete={(id) => deleteResume.mutate(id)}
              onDownload={(id) => downloadResume.mutate(id)}
            />
          ))}
        </div>
      )}

      {previewId && (
        <ResumePreviewModal
          resumeId={previewId}
          onClose={() => setPreviewId(null)}
        />
      )}
    </div>
  );
}
