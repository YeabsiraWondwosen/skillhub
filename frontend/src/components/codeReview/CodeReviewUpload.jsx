import { useState, useRef, useCallback } from 'react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { useSubmitFileReview, useSubmitPasteReview } from '@hooks/useCodeReview';
import {
  Bug, Lock, Zap, CircleCheck, Wrench, Palette, Folder, FileText, X,
} from 'lucide-react';

const FOCUS_AREAS = [
  { id: 'bugs', label: 'Bugs', icon: Bug, description: 'Logic errors, null refs, type issues' },
  { id: 'security', label: 'Security', icon: Lock, description: 'XSS, injection, secrets' },
  { id: 'performance', label: 'Performance', icon: Zap, description: 'N+1, memory leaks, O(n²)' },
  { id: 'best_practice', label: 'Best Practices', icon: CircleCheck, description: 'SOLID, DRY, error handling' },
  { id: 'maintainability', label: 'Maintainability', icon: Wrench, description: 'Complexity, coupling, docs' },
  { id: 'style', label: 'Style', icon: Palette, description: 'Formatting, naming, imports' },
];

const SEVERITY_OPTIONS = [
  { value: 'all', label: 'All Issues' },
  { value: 'critical', label: 'Critical Only' },
  { value: 'high', label: 'High+' },
  { value: 'medium', label: 'Medium+' },
];

const LANGUAGE_OPTIONS = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'go', label: 'Go' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'php', label: 'PHP' },
  { value: 'rust', label: 'Rust' },
  { value: 'swift', label: 'Swift' },
];

export default function CodeReviewUpload({ onComplete }) {
  const [mode, setMode] = useState('paste');
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [fileName, setFileName] = useState('');
  const [focusAreas, setFocusAreas] = useState([]);
  const [severity, setSeverity] = useState('all');
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState([]);
  const fileInputRef = useRef(null);

  const submitFileReview = useSubmitFileReview();
  const submitPasteReview = useSubmitPasteReview();

  const isSubmitting = submitFileReview.isPending || submitPasteReview.isPending;

  const toggleFocusArea = (area) => {
    setFocusAreas(prev =>
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    );
  };

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  }, []);

  const handleFiles = (newFiles) => {
    const codeExts = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.go', '.rb', '.php', '.rs', '.swift', '.kt', '.sql', '.html', '.css', '.json', '.yaml', '.sh'];
    const validFiles = newFiles.filter(f => {
      const ext = '.' + f.name.split('.').pop()?.toLowerCase();
      return codeExts.includes(ext) || f.type.startsWith('text/');
    });
    setFiles(prev => [...prev, ...validFiles].slice(0, 10));
  };

  const handleSubmit = async () => {
    if (mode === 'paste') {
      if (!code.trim()) return;
      const result = await submitPasteReview.mutateAsync({
        code,
        language,
        fileName: fileName || undefined,
        focusAreas: focusAreas.length > 0 ? focusAreas : undefined,
        severity,
      });
      onComplete?.(result.data._id);
    } else {
      if (files.length === 0) return;
      const formData = new FormData();
      files.forEach(f => formData.append('files', f));
      formData.append('severity', severity);
      focusAreas.forEach(a => formData.append('focusAreas', a));

      const result = await submitFileReview.mutateAsync(formData);
      onComplete?.(result.data._id);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
      {/* Mode Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode('paste')}
          className={clsx(
            'flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all',
            mode === 'paste'
              ? 'bg-primary-500 text-white shadow-md'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
          )}
        >
          Paste Code
        </button>
        <button
          onClick={() => setMode('upload')}
          className={clsx(
            'flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all',
            mode === 'upload'
              ? 'bg-primary-500 text-white shadow-md'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
          )}
        >
          Upload Files
        </button>
      </div>

      {/* Paste Mode */}
      {mode === 'paste' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            >
              {LANGUAGE_OPTIONS.map(l => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="Filename (optional)"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="relative">
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste your code here..."
              rows={16}
              className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-sm text-gray-900 dark:text-white font-mono placeholder-gray-400 focus:ring-2 focus:ring-primary-500 resize-y"
            />
            <span className="absolute bottom-3 right-3 text-xs text-gray-400">
              {code.length.toLocaleString()} chars
            </span>
          </div>
        </div>
      )}

      {/* Upload Mode */}
      {mode === 'upload' && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={clsx(
            'border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer',
            dragActive
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10'
              : 'border-gray-200 dark:border-gray-700 hover:border-primary-400',
          )}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".js,.jsx,.ts,.tsx,.py,.java,.cpp,.c,.go,.rb,.php,.rs,.swift,.kt,.sql,.html,.css,.json,.yaml,.sh,.txt"
            className="hidden"
            onChange={(e) => handleFiles(Array.from(e.target.files || []))}
          />
          <div className="flex items-center justify-center mb-3">
            <Folder size={40} className="text-gray-400" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Drop code files here or click to browse
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Max 10 files, 100KB each. Supports JS, TS, Python, Java, Go, and more.
          </p>
        </div>
      )}

      {/* File List */}
      {mode === 'upload' && files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((file, i) => (
            <div key={i} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-gray-500" aria-hidden="true" />
                <span className="text-sm text-gray-700 dark:text-gray-300">{file.name}</span>
                <span className="text-xs text-gray-400">({(file.size / 1024).toFixed(1)}KB)</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setFiles(prev => prev.filter((_, j) => j !== i)); }}
                className="text-gray-400 hover:text-red-500"
                aria-label={`Remove ${file.name}`}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Focus Areas */}
      <div className="mt-6">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Focus Areas</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {FOCUS_AREAS.map(area => (
            <button
              key={area.id}
              onClick={() => toggleFocusArea(area.id)}
              className={clsx(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all text-left',
                focusAreas.includes(area.id)
                  ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                  : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300',
              )}
            >
              <span className="flex items-center"><area.icon size={16} aria-hidden="true" /></span>
              <span className="font-medium">{area.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Severity */}
      <div className="mt-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Minimum Severity</h4>
        <div className="flex gap-2">
          {SEVERITY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSeverity(opt.value)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                severity === opt.value
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Submit */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || (mode === 'paste' ? !code.trim() : files.length === 0)}
          className={clsx(
            'px-6 py-2.5 rounded-lg font-medium text-sm transition-all',
            isSubmitting || (mode === 'paste' ? !code.trim() : files.length === 0)
              ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-primary-500 text-white hover:bg-primary-600 shadow-md hover:shadow-lg',
          )}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Analyzing...
            </span>
          ) : 'Review Code'}
        </button>
      </div>
    </div>
  );
}
