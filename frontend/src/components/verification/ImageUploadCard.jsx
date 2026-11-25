import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PhotoIcon, XMarkIcon, ArrowUpTrayIcon, CheckCircleIcon,
  ExclamationCircleIcon, TrashIcon, ArrowsPointingOutIcon,
} from '@heroicons/react/24/outline';
import { clsx } from 'clsx';

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png,.webp';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function compressImage(file, maxWidth = 1920, quality = 0.85) {
  return new Promise((resolve) => {
    if (file.size <= 1024 * 1024) {
      resolve(file);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < file.size) {
            resolve(new File([blob], file.name, { type: file.type }));
          } else {
            resolve(file);
          }
        },
        file.type,
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

function validateFile(file) {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return `Invalid file type: ${file.type}. Accepted: JPG, PNG, WebP`;
  }
  if (file.size > MAX_SIZE_BYTES) {
    return `File too large: ${formatSize(file.size)}. Maximum: 5 MB`;
  }
  return null;
}

export default function ImageUploadCard({
  label,
  sublabel,
  file,
  existingUrl,
  onFileSelect,
  onRemove,
  uploading = false,
  progress = 0,
  success = false,
  error = null,
  required = false,
  className,
}) {
  const [preview, setPreview] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const inputRef = useRef(null);

  const displayUrl = preview || existingUrl || null;

  useEffect(() => {
    if (file && file instanceof File) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    if (!file) {
      setPreview(null);
    }
  }, [file]);

  const processFile = useCallback(async (f) => {
    if (!f) return;
    const err = validateFile(f);
    if (err) {
      setValidationError(err);
      return;
    }
    setValidationError(null);
    const compressed = await compressImage(f);
    onFileSelect?.(compressed);
  }, [onFileSelect]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    processFile(f);
  }, [processFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleClick = () => {
    if (!uploading) inputRef.current?.click();
  };

  const handleInputChange = (e) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
    e.target.value = '';
  };

  return (
    <>
      <div className={clsx('relative', className)}>
        {label && (
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={handleClick}
          className={clsx(
            'relative rounded-xl border-2 transition-all duration-200 overflow-hidden',
            displayUrl
              ? 'border-green-200 dark:border-green-800/40'
              : dragOver
              ? 'border-primary-400 bg-primary-50/50 dark:bg-primary-900/10'
              : 'border-dashed border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500 cursor-pointer',
            error || validationError ? 'border-red-300 dark:border-red-700' : '',
            uploading ? 'pointer-events-none' : ''
          )}
        >
          {/* Upload state - no image */}
          {!displayUrl && !uploading && (
            <div className="flex flex-col items-center justify-center py-8 px-4">
              <div className={clsx(
                'w-12 h-12 rounded-full flex items-center justify-center mb-3',
                dragOver ? 'bg-primary-100 dark:bg-primary-900/30' : 'bg-gray-100 dark:bg-gray-800'
              )}>
                <ArrowUpTrayIcon className={clsx('w-5 h-5', dragOver ? 'text-primary-500' : 'text-gray-400')} />
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {sublabel || 'Click or drag to upload'}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">JPG, PNG, or WebP • Max 5 MB</p>
            </div>
          )}

          {/* Upload state - in progress */}
          {uploading && (
            <div className="p-4">
              {displayUrl && (
                <div className="relative mb-3">
                  <img src={displayUrl} alt="Uploading" className="w-full h-40 object-cover rounded-lg" />
                  <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-10 h-10 border-3 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                      <p className="text-white text-xs font-semibold mt-2">{Math.round(progress)}%</p>
                    </div>
                  </div>
                </div>
              )}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full bg-primary-500 rounded-full"
                  transition={{ duration: 0.3 }}
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1 text-center">Uploading...</p>
            </div>
          )}

          {/* Image preview */}
          {displayUrl && !uploading && (
            <div className="relative group">
              <img
                src={displayUrl}
                alt={label || 'Upload preview'}
                className="w-full h-48 object-cover"
                onError={(e) => { e.target.style.display = 'none'; }}
              />

              {/* Success overlay */}
              {success && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute top-2 left-2 bg-green-500 text-white rounded-full p-1 shadow-lg"
                >
                  <CheckCircleIcon className="w-5 h-5" />
                </motion.div>
              )}

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                <button
                  onClick={(e) => { e.stopPropagation(); setLightbox(true); }}
                  className="p-2 bg-white/90 dark:bg-gray-800/90 rounded-full hover:bg-white dark:hover:bg-gray-800 transition-colors"
                  title="View full size"
                >
                  <ArrowsPointingOutIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
                  className="p-2 bg-white/90 dark:bg-gray-800/90 rounded-full hover:bg-white dark:hover:bg-gray-800 transition-colors"
                  title="Replace image"
                >
                  <ArrowUpTrayIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onRemove?.(); setValidationError(null); }}
                  className="p-2 bg-red-500/90 rounded-full hover:bg-red-600 transition-colors"
                  title="Remove image"
                >
                  <TrashIcon className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            className="hidden"
            onChange={handleInputChange}
          />
        </div>

        {/* Error messages */}
        {(validationError || error) && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1 mt-1.5"
          >
            <ExclamationCircleIcon className="w-3.5 h-3.5 text-red-500 shrink-0" />
            <p className="text-[11px] text-red-500">{validationError || error}</p>
          </motion.div>
        )}

        {/* Success message */}
        {success && !uploading && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1 mt-1.5"
          >
            <CheckCircleIcon className="w-3.5 h-3.5 text-green-500 shrink-0" />
            <p className="text-[11px] text-green-600 dark:text-green-400">Uploaded successfully</p>
          </motion.div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && displayUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
            onClick={() => setLightbox(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setLightbox(false)}
                className="absolute -top-10 right-0 text-white/70 hover:text-white transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
              <img
                src={displayUrl}
                alt="Full size preview"
                className="max-w-full max-h-[85vh] rounded-lg object-contain"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
