'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export default function AssetPhotoField({
  id = 'asset-photo',
  file,
  imageUrl,
  onFileChange,
  disabled = false,
  className = '',
}) {
  const [previewUrl, setPreviewUrl] = useState('');
  const [fileError, setFileError] = useState('');

  useEffect(() => {
    if (!previewUrl) return undefined;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const handleChange = (event) => {
    const selectedFile = event.target.files?.[0] || null;
    event.target.value = '';
    setFileError('');

    if (selectedFile && !ALLOWED_TYPES.has(selectedFile.type)) {
      setFileError('Choose a JPEG, PNG, or WebP image.');
      setPreviewUrl('');
      onFileChange(null);
      return;
    }
    if (selectedFile && selectedFile.size > MAX_FILE_SIZE) {
      setFileError('Image must be 10 MB or smaller.');
      setPreviewUrl('');
      onFileChange(null);
      return;
    }

    setPreviewUrl(selectedFile ? URL.createObjectURL(selectedFile) : '');
    onFileChange(selectedFile);
  };

  const displayedImage = file ? previewUrl : imageUrl;

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-800 dark:text-slate-200">
        Asset photo
      </label>
      <div className="mb-3 flex h-48 items-center justify-center overflow-hidden rounded-lg border border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-900">
        {displayedImage ? (
          <Image
            src={displayedImage}
            alt="Asset"
            width={640}
            height={480}
            unoptimized
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="text-sm text-slate-500 dark:text-slate-400">No photo selected</span>
        )}
      </div>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleChange}
        disabled={disabled}
        className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 dark:text-slate-300 dark:file:bg-slate-700 dark:file:text-slate-100"
      />
      {fileError ? (
        <p role="alert" className="mt-1 text-xs font-medium text-red-700 dark:text-red-400">
          {fileError}
        </p>
      ) : (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          JPEG, PNG, or WebP; maximum size 10 MB.
        </p>
      )}
    </div>
  );
}
