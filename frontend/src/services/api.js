// frontend/src/services/api.js
const API_BASE = '/api/assets';
const JPEG_OPTIMIZE_THRESHOLD = 1024 * 1024;
const JPEG_MAX_DIMENSION = 1920;

async function optimizeAssetImage(file) {
  if (
    file.type !== 'image/jpeg' ||
    file.size <= JPEG_OPTIMIZE_THRESHOLD ||
    typeof createImageBitmap !== 'function'
  ) {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, JPEG_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));

  try {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare the image for upload.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const compressed = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Could not compress the image for upload.'));
        },
        'image/jpeg',
        0.82
      );
    });

    if (compressed.size >= file.size * 0.9) return file;
    return new File([compressed], file.name, {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });
  } finally {
    bitmap.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}

export const AssetService = {
  async getAssets(params = {}) {
    const query = new URLSearchParams(params).toString();
    let res;
    try {
      res = await fetch(`${API_BASE}?${query}`, { cache: 'no-store' });
    } catch {
      throw new Error(
        'Cannot connect to the inventory API. Make sure the backend is running and the Next.js API proxy is configured.'
      );
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(
        errData.message || `Backend returned HTTP ${res.status} (${res.statusText}) at ${API_BASE}`
      );
    }
    return res.json();
  },

  async aiSearch(prompt) {
    const res = await fetch(`${API_BASE}/ai-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `AI search failed (HTTP ${res.status})`);
    return data;
  },

  async getAssetById(id) {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Asset not found');
    return res.json();
  },

  async createAsset(payload) {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to create asset');
    return data;
  },

  async updateAsset(id, payload) {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to update asset');
    return data;
  },

  getAssetImageUrl(id, version) {
    const url = `${API_BASE}/${encodeURIComponent(id)}/image`;
    return version ? `${url}?v=${encodeURIComponent(version)}` : url;
  },

  async uploadAssetImage(id, file) {
    const uploadFile = await optimizeAssetImage(file);
    const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}/image`, {
      method: 'PUT',
      headers: { 'Content-Type': uploadFile.type },
      body: uploadFile,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to upload asset photo');
    return data;
  },

  async deleteAssetImage(id) {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}/image`, {
      method: 'DELETE',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to remove asset photo');
    return data;
  },

  async deleteAsset(id) {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete asset');
    return res.json();
  },
};
