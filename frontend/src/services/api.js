// frontend/src/services/api.js
const API_BASE = '/api/assets';

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

  async deleteAsset(id) {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete asset');
    return res.json();
  },
};
