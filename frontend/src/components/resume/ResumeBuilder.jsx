import { useState } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { useGenerateResume, useResumeTemplates } from '@hooks/useResume';
import {
  Palette, ScrollText, Sparkles, Heart, FilePen, Wrench, Briefcase,
  GraduationCap, Rocket, Globe, Github, FileText,
} from 'lucide-react';

const TEMPLATES = [
  { id: 'modern', name: 'Modern', icon: Palette, color: 'border-blue-400 bg-blue-50 dark:bg-blue-900/10', accent: '#2563eb' },
  { id: 'classic', name: 'Classic', icon: ScrollText, color: 'border-gray-700 bg-gray-50 dark:bg-gray-800', accent: '#1a1a2e' },
  { id: 'minimal', name: 'Minimal', icon: Sparkles, color: 'border-gray-400 bg-gray-50 dark:bg-gray-800', accent: '#374151' },
  { id: 'creative', name: 'Creative', icon: Heart, color: 'border-purple-400 bg-purple-50 dark:bg-purple-900/10', accent: '#7c3aed' },
];

const FONT_SIZES = [
  { id: 'small', label: 'Compact', desc: 'More content per page' },
  { id: 'medium', label: 'Standard', desc: 'Balanced layout' },
  { id: 'large', label: 'Spacious', desc: 'Easier to read' },
];

const SECTIONS = [
  { id: 'summary', label: 'Professional Summary', icon: FilePen },
  { id: 'skills', label: 'Technical Skills', icon: Wrench },
  { id: 'experience', label: 'Work Experience', icon: Briefcase },
  { id: 'education', label: 'Education', icon: GraduationCap },
  { id: 'portfolio', label: 'Portfolio & Projects', icon: Rocket },
  { id: 'certifications', label: 'Certifications', icon: ScrollText },
  { id: 'languages', label: 'Languages', icon: Globe },
  { id: 'github', label: 'GitHub Profile', icon: Github },
];

const ACCENT_COLORS = [
  { id: '#2563eb', name: 'Blue' },
  { id: '#1a1a2e', name: 'Dark' },
  { id: '#374151', name: 'Gray' },
  { id: '#7c3aed', name: 'Purple' },
  { id: '#059669', name: 'Green' },
  { id: '#dc2626', name: 'Red' },
  { id: '#d97706', name: 'Amber' },
  { id: '#0891b2', name: 'Cyan' },
];

export default function ResumeBuilder({ onGenerated }) {
  const [template, setTemplate] = useState('modern');
  const [fontSize, setFontSize] = useState('medium');
  const [accentColor, setAccentColor] = useState('#2563eb');
  const [includeGitHub, setIncludeGitHub] = useState(true);
  const [includePortfolio, setIncludePortfolio] = useState(true);
  const [includeCertifications, setIncludeCertifications] = useState(true);
  const [sectionOrder, setSectionOrder] = useState(SECTIONS.map(s => s.id));

  const generateResume = useGenerateResume();

  const moveSection = (index, direction) => {
    const newOrder = [...sectionOrder];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    setSectionOrder(newOrder);
  };

  const handleGenerate = async () => {
    const result = await generateResume.mutateAsync({
      template,
      fontSize,
      accentColor,
      includeGitHub,
      includePortfolio,
      includeCertifications,
      sectionOrder,
    });
    onGenerated?.(result.data);
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Build Your Resume</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          AI will enhance your profile content and generate a professional PDF resume.
        </p>
      </div>

      {/* Template Selection */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Template</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {TEMPLATES.map(tmpl => (
            <button
              key={tmpl.id}
              onClick={() => { setTemplate(tmpl.id); setAccentColor(tmpl.accent); }}
              className={clsx(
                'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                template === tmpl.id
                  ? tmpl.color
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300',
              )}
            >
              <tmpl.icon size={28} className="mx-auto text-gray-600 dark:text-gray-300" aria-hidden="true" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{tmpl.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Font Size */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Font Size</h4>
        <div className="flex gap-2">
          {FONT_SIZES.map(fs => (
            <button
              key={fs.id}
              onClick={() => setFontSize(fs.id)}
              className={clsx(
                'flex-1 px-3 py-2 rounded-lg text-sm transition-all text-center',
                fontSize === fs.id
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200',
              )}
            >
              <span className="font-medium">{fs.label}</span>
              <span className="block text-[10px] opacity-70 mt-0.5">{fs.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Accent Color */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Accent Color</h4>
        <div className="flex gap-2 flex-wrap">
          {ACCENT_COLORS.map(color => (
            <button
              key={color.id}
              onClick={() => setAccentColor(color.id)}
              className={clsx(
                'w-8 h-8 rounded-full border-2 transition-all',
                accentColor === color.id ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent hover:scale-105',
              )}
              style={{ backgroundColor: color.id }}
              title={color.name}
            />
          ))}
        </div>
      </div>

      {/* Include Sections */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Include Sections</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { key: 'includeGitHub', label: 'GitHub Profile', icon: Github, value: includeGitHub, setter: setIncludeGitHub },
            { key: 'includePortfolio', label: 'Portfolio', icon: Rocket, value: includePortfolio, setter: setIncludePortfolio },
            { key: 'includeCertifications', label: 'Certifications', icon: ScrollText, value: includeCertifications, setter: setIncludeCertifications },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => opt.setter(!opt.value)}
              className={clsx(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all',
                opt.value
                  ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-300 text-primary-700 dark:text-primary-300'
                  : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500',
              )}
            >
              <opt.icon size={16} className="flex-shrink-0" aria-hidden="true" />
              <span className="font-medium">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Section Order */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Section Order</h4>
        <div className="space-y-1.5">
          {sectionOrder.map((sectionId, index) => {
            const section = SECTIONS.find(s => s.id === sectionId);
            if (!section) return null;
            return (
              <div key={sectionId} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                <span className="text-sm w-6 text-center text-gray-400">{index + 1}</span>
                <span className="text-sm flex items-center"><section.icon size={15} aria-hidden="true" /></span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1">{section.label}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => moveSection(index, -1)}
                    disabled={index === 0}
                    className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs px-1"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => moveSection(index, 1)}
                    disabled={index === sectionOrder.length - 1}
                    className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs px-1"
                  >
                    ▼
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Generate Button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleGenerate}
          disabled={generateResume.isPending}
          className={clsx(
            'px-8 py-3 rounded-xl font-medium text-sm transition-all flex items-center gap-2',
            generateResume.isPending
              ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-primary-500 text-white hover:bg-primary-600 shadow-lg hover:shadow-xl',
          )}
        >
          {generateResume.isPending ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating Resume...
            </>
          ) : (
            <>
              <FileText size={16} aria-hidden="true" />
              Generate Resume
            </>
          )}
        </button>
      </div>
    </div>
  );
}
