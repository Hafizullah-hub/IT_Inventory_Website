// backend/src/controllers/assetController.js
const { randomUUID } = require('crypto');
const mongoose = require('mongoose');
const Asset = require('../models/Asset');

const IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function uppercaseStringValues(value) {
  if (typeof value === 'string') return value.toUpperCase();
  if (Array.isArray(value)) return value.map(uppercaseStringValues);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, uppercaseStringValues(nestedValue)])
    );
  }
  return value;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getAssetImageBucket() {
  if (!mongoose.connection.db) {
    throw new Error('MongoDB is not connected.');
  }
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'assetImages',
  });
}

function matchesImageType(buffer, contentType) {
  if (contentType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (contentType === 'image/png') {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (contentType === 'image/webp') {
    return buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP';
  }
  return false;
}

async function removeStoredImage(bucket, imageId) {
  if (!imageId) return;
  const [file] = await bucket.find({ _id: imageId }).limit(1).toArray();
  if (file) await bucket.delete(imageId);
}

async function findLatestStoredImage(bucket, documentId) {
  const [file] = await bucket
    .find({ 'metadata.documentId': documentId })
    .sort({ uploadDate: -1 })
    .limit(1)
    .toArray();
  return file || null;
}

let aiClient = null;
const filterCache = new Map();

async function getAiClient() {
  if (!aiClient) {
    const { GoogleGenAI } = await import('@google/genai');
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

function mergeAnalyticsGroups(groups, sortByValue = false) {
  const merged = new Map();

  for (const group of groups) {
    const name = group.name.trim();
    const key = name.toLowerCase();
    const existing = merged.get(key);

    if (existing) {
      existing.count += group.count;
      existing.value += group.value;
      if (group.count > existing.displayCount) {
        existing.name = name;
        existing.displayCount = group.count;
      }
    } else {
      merged.set(key, { ...group, name, displayCount: group.count });
    }
  }

  return [...merged.values()]
    .sort((a, b) =>
      sortByValue
        ? b.value - a.value || b.count - a.count
        : b.count - a.count || b.value - a.value
    )
    .map(({ displayCount, ...group }) => group);
}

async function computeStats(query = {}) {
  const [facetResult] = await Asset.aggregate([
    { $match: query },
    {
      $facet: {
        summary: [
          {
            $group: {
              _id: null,
              totalAssets: { $sum: 1 },
              totalValue: { $sum: { $ifNull: ['$procurement.amount', 0] } },
              workstations: {
                $sum: {
                  $cond: [
                    {
                      $in: [
                        { $toUpper: { $ifNull: ['$core_details.type', ''] } },
                        ['LAPTOP', 'DESKTOP'],
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              assigned: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $gt: [{ $strLenCP: { $ifNull: ['$assignment.user', ''] } }, 0] },
                        {
                          $ne: [
                            { $toUpper: { $ifNull: ['$assignment.user', ''] } },
                            'UNASSIGNED',
                          ],
                        },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ],
        byDept: [
          {
            $group: {
              _id: { $ifNull: ['$assignment.dept', 'Unassigned'] },
              count: { $sum: 1 },
              value: { $sum: { $ifNull: ['$procurement.amount', 0] } },
            },
          },
          { $sort: { value: -1, count: -1 } },
        ],
        byBrand: [
          {
            $group: {
              _id: { $ifNull: ['$core_details.manufacturer', 'Other'] },
              count: { $sum: 1 },
              value: { $sum: { $ifNull: ['$procurement.amount', 0] } },
            },
          },
          { $sort: { count: -1, value: -1 } },
        ],
        byType: [
          {
            $group: {
              _id: { $ifNull: ['$core_details.type', 'Other'] },
              count: { $sum: 1 },
              value: { $sum: { $ifNull: ['$procurement.amount', 0] } },
            },
          },
          { $sort: { count: -1, value: -1 } },
        ],
      },
    },
  ]);

  const base = facetResult?.summary?.[0] || {
    totalAssets: 0,
    totalValue: 0,
    workstations: 0,
    assigned: 0,
  };

  return {
    totalAssets: base.totalAssets,
    totalValue: base.totalValue,
    workstations: base.workstations,
    assigned: base.assigned,
    analytics: {
      byDept: mergeAnalyticsGroups(
        (facetResult?.byDept || []).map((d) => ({
          name: d._id || 'UNASSIGNED',
          count: d.count,
          value: d.value,
        })),
        true
      ),
      byBrand: mergeAnalyticsGroups(
        (facetResult?.byBrand || []).map((b) => ({
          name: b._id || 'OTHER',
          count: b.count,
          value: b.value,
        }))
      ),
      byType: mergeAnalyticsGroups(
        (facetResult?.byType || []).map((t) => ({
          name: t._id || 'OTHER',
          count: t.count,
          value: t.value,
        }))
      ),
    },
  };
}

const AI_SYSTEM_INSTRUCTION = `Convert the user's query into a raw MongoDB filter JSON object.
Fields:
documentId, core_details.asset_no, core_details.serial, core_details.type (Laptop/Desktop/Server/Monitor), core_details.manufacturer, core_details.model, core_details.comp_name,
assignment.user, assignment.dept (IT/Finance/HR/Operations), assignment.company, assignment.location,
hardware.processor, hardware.ram, hardware.hardisk,
software.os.name, software.office.version, software.antivirus.name, software.other_app,
procurement.supplier, procurement.capex_no, procurement.po_no, procurement.invoice_no, procurement.amount (Number), procurement.warranty.
Rules:
1. For String fields use {"$regex":"value","$options":"i"}.
2. When the user specifies multiple criteria, use $and to match ALL of them.
3. For procurement.amount use $gt, $gte, $lt, $lte.
4. Output ONLY the MongoDB filter JSON object.`;

function buildSmartLocalFilter(promptText) {
  let remaining = promptText.toLowerCase();
  const andConditions = [];

  // 1. Price / Amount comparisons
  const overRegex = /(?:over|above|more than|greater than|>)\s*(?:rm\s*)?([0-9,]+(?:\.[0-9]+)?)/i;
  const overMatch = remaining.match(overRegex);
  if (overMatch) {
    const val = parseFloat(overMatch[1].replace(/,/g, ''));
    if (!isNaN(val)) andConditions.push({ 'procurement.amount': { $gt: val } });
    remaining = remaining.replace(overRegex, ' ');
  }

  const underRegex = /(?:under|below|less than|cheaper than|<)\s*(?:rm\s*)?([0-9,]+(?:\.[0-9]+)?)/i;
  const underMatch = remaining.match(underRegex);
  if (underMatch) {
    const val = parseFloat(underMatch[1].replace(/,/g, ''));
    if (!isNaN(val)) andConditions.push({ 'procurement.amount': { $lt: val } });
    remaining = remaining.replace(underRegex, ' ');
  }

  // 2. RAM sizes
  const ramMatches = [...remaining.matchAll(/\b(8|16|32|64|128|256)\s*gb\b/gi)].map(
    (m) => `${m[1]}GB`
  );
  if (ramMatches.length > 0 && /\b(ram|memory)\b/i.test(remaining)) {
    andConditions.push({ 'hardware.ram': { $regex: ramMatches.join('|'), $options: 'i' } });
    remaining = remaining
      .replace(/\b(8|16|32|64|128|256)\s*gb\b/gi, ' ')
      .replace(/\b(ram|memory)\b/gi, ' ');
  }

  // 3. Asset Types
  const types = [];
  if (/\blaptops?\b/i.test(remaining)) {
    types.push('Laptop');
    remaining = remaining.replace(/\blaptops?\b/gi, ' ');
  }
  if (/\b(desktops?|pcs?)\b/i.test(remaining)) {
    types.push('Desktop');
    remaining = remaining.replace(/\b(desktops?|pcs?)\b/gi, ' ');
  }
  if (/\bservers?\b/i.test(remaining)) {
    types.push('Server');
    remaining = remaining.replace(/\bservers?\b/gi, ' ');
  }
  if (/\b(monitors?|displays?|screens?)\b/i.test(remaining)) {
    types.push('Monitor');
    remaining = remaining.replace(/\b(monitors?|displays?|screens?)\b/gi, ' ');
  }
  if (types.length === 1) {
    andConditions.push({ 'core_details.type': { $regex: `^${types[0]}$`, $options: 'i' } });
  } else if (types.length > 1) {
    andConditions.push({
      'core_details.type': { $in: types.map((t) => new RegExp(`^${t}$`, 'i')) },
    });
  }

  // 4. Departments
  const depts = [];
  if (/\b(it|information technology)\b/i.test(remaining)) {
    depts.push('IT');
    remaining = remaining.replace(/\b(it|information technology)\b/gi, ' ');
  }
  if (/\b(finance|accounting)\b/i.test(remaining)) {
    depts.push('Finance');
    remaining = remaining.replace(/\b(finance|accounting)\b/gi, ' ');
  }
  if (/\b(hr|human resources?)\b/i.test(remaining)) {
    depts.push('HR');
    remaining = remaining.replace(/\b(hr|human resources?)\b/gi, ' ');
  }
  if (/\b(operations?|ops)\b/i.test(remaining)) {
    depts.push('Operations');
    remaining = remaining.replace(/\b(operations?|ops)\b/gi, ' ');
  }
  if (depts.length === 1) {
    andConditions.push({ 'assignment.dept': { $regex: `^${depts[0]}$`, $options: 'i' } });
  } else if (depts.length > 1) {
    andConditions.push({
      'assignment.dept': { $in: depts.map((d) => new RegExp(`^${d}$`, 'i')) },
    });
  }

  // 5. Manufacturers / Brands
  const brands = [];
  if (/\bhpe\b/i.test(remaining)) {
    brands.push('^HPE$');
    remaining = remaining.replace(/\bhpe\b/gi, ' ');
  } else if (/\bhp\b/i.test(remaining)) {
    brands.push('^HP$');
    remaining = remaining.replace(/\bhp\b/gi, ' ');
  }
  if (/\bdell\b/i.test(remaining)) {
    brands.push('^Dell$');
    remaining = remaining.replace(/\bdell\b/gi, ' ');
  }
  if (/\blenovo\b/i.test(remaining)) {
    brands.push('^Lenovo$');
    remaining = remaining.replace(/\blenovo\b/gi, ' ');
  }
  if (brands.length === 1) {
    andConditions.push({ 'core_details.manufacturer': { $regex: brands[0], $options: 'i' } });
  } else if (brands.length > 1) {
    andConditions.push({
      'core_details.manufacturer': { $in: brands.map((b) => new RegExp(b, 'i')) },
    });
  }

  // 6. Antivirus
  const avs = [];
  if (/\b(crowdstrike|falcon)\b/i.test(remaining)) {
    avs.push('CrowdStrike');
    remaining = remaining.replace(/\b(crowdstrike|falcon)\b/gi, ' ');
  }
  if (/\bkaspersky\b/i.test(remaining)) {
    avs.push('Kaspersky');
    remaining = remaining.replace(/\bkaspersky\b/gi, ' ');
  }
  if (/\bsophos\b/i.test(remaining)) {
    avs.push('Sophos');
    remaining = remaining.replace(/\bsophos\b/gi, ' ');
  }
  if (avs.length > 0) {
    andConditions.push({ 'software.antivirus.name': { $regex: avs.join('|'), $options: 'i' } });
  }

  // 7. Strip English filler words & field-label words
  const stopWords = new Set([
    'show', 'me', 'all', 'the', 'with', 'using', 'assets', 'asset', 'in', 'or', 'and',
    'for', 'from', 'that', 'have', 'has', 'are', 'is', 'by', 'of', 'to', 'on', 'at',
    'department', 'dept', 'antivirus', 'av', 'brand', 'model', 'type', 'find', 'list',
    'get', 'search', 'which', 'what', 'who', 'assigned', 'computer', 'computers', 'unit', 'units',
    'processor', 'processors', 'cpu', 'cpus', 'storage', 'disk', 'hardisk', 'hard', 'drive',
    'ram', 'memory', 'os', 'operating', 'system', 'software', 'app', 'apps', 'application',
    'supplier', 'vendor', 'bought', 'purchased', 'procured', 'price', 'cost', 'amount', 'rm',
    'over', 'under', 'above', 'below', 'more', 'less', 'than', 'greater', 'cheaper',
    'running', 'installed', 'equipped', 'located', 'location', 'office', 'user', 'employee', 'staff',
    'machines', 'machine', 'devices', 'device', 'workstations', 'workstation', 'hardware'
  ]);

  const leftoverTokens = remaining
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !stopWords.has(w));

  for (const token of leftoverTokens) {
    const tokenRegex = new RegExp(token, 'i');
    andConditions.push({
      $or: [
        { 'core_details.model': tokenRegex },
        { 'core_details.asset_no': tokenRegex },
        { 'core_details.serial': tokenRegex },
        { documentId: tokenRegex },
        { 'core_details.comp_name': tokenRegex },
        { 'assignment.user': tokenRegex },
        { 'assignment.location': tokenRegex },
        { 'hardware.processor': tokenRegex },
        { 'hardware.ram': tokenRegex },
        { 'hardware.hardisk': tokenRegex },
        { 'software.os.name': tokenRegex },
        { 'software.other_app': tokenRegex },
        { 'procurement.supplier': tokenRegex },
        { 'procurement.capex_no': tokenRegex },
      ],
    });
  }

  if (andConditions.length === 0) return null;
  return andConditions.length === 1 ? andConditions[0] : { $and: andConditions };
}

// 1. GET ALL ASSETS
exports.getAssets = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', dept = '', type = '' } = req.query;
    const query = {};

    if (search) {
      const terms = search.trim().split(/\s+/).filter(Boolean);
      const termFilters = terms.map((term) => {
        const regex = new RegExp(term, 'i');
        return {
          $or: [
            { documentId: regex },
            { 'core_details.asset_no': regex },
            { 'core_details.serial': regex },
            { 'core_details.manufacturer': regex },
            { 'core_details.model': regex },
            { 'core_details.comp_name': regex },
            { 'assignment.user': regex },
          ],
        };
      });
      if (termFilters.length === 1) {
        query.$or = termFilters[0].$or;
      } else if (termFilters.length > 1) {
        query.$and = termFilters;
      }
    }

    if (dept) query['assignment.dept'] = new RegExp(`^${escapeRegex(dept.trim())}$`, 'i');
    if (type) query['core_details.type'] = new RegExp(`^${escapeRegex(type.trim())}$`, 'i');

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [assets, stats] = await Promise.all([
      Asset.find(query).sort({ updatedAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      computeStats(query),
    ]);

    res.json({
      data: assets,
      stats,
      pagination: {
        total: stats.totalAssets,
        page: parseInt(page),
        pages: Math.ceil(stats.totalAssets / parseInt(limit)) || 1,
      },
    });
  } catch (err) {
    console.error('Error in getAssets:', err);
    res.status(500).json({ message: err.message });
  }
};

// 2. GET SINGLE ASSET BY DOCUMENT ID
exports.getAssetById = async (req, res) => {
  try {
    const asset = await Asset.findOne({ documentId: req.params.id }).lean();
    if (!asset) return res.status(404).json({ message: 'Asset not found' });

    if (!asset.imageId) {
      try {
        const bucket = getAssetImageBucket();
        const file = await findLatestStoredImage(bucket, asset.documentId);
        if (file) {
          asset.imageId = file._id;
          await Asset.updateOne(
            { _id: asset._id, imageId: null },
            { $set: { imageId: file._id } }
          );
        }
      } catch (imageError) {
        console.error('Could not recover asset photo reference:', imageError);
      }
    }

    res.json({ data: asset });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 3. CREATE NEW ASSET
exports.createAsset = async (req, res) => {
  try {
    const body = uppercaseStringValues(req.body || {});
    const { documentId, core_details } = body;
    const assetNo = String(core_details?.asset_no || '').trim();
    const finalId = String(documentId || '').trim() || assetNo || randomUUID().toUpperCase();

    const existing = await Asset.findOne({
      documentId: new RegExp(`^${escapeRegex(finalId)}$`, 'i'),
    }).lean();
    if (existing) {
      return res.status(409).json({ message: `Asset ${finalId} already exists` });
    }

    const newAsset = await Asset.create({
      ...body,
      documentId: finalId,
      core_details: { ...(core_details || {}), asset_no: assetNo },
    });
    res.status(201).json({ data: newAsset });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// 4. UPDATE ASSET
exports.updateAsset = async (req, res) => {
  try {
    const body = uppercaseStringValues(req.body || {});
    const updated = await Asset.findOneAndUpdate(
      { documentId: req.params.id },
      { $set: body },
      { new: true, runValidators: true }
    ).lean();
    if (!updated) return res.status(404).json({ message: 'Asset not found' });
    res.json({ data: updated });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Asset photos are stored separately from asset documents in MongoDB GridFS.
exports.getAssetImage = async (req, res) => {
  try {
    const asset = await Asset.findOne({ documentId: req.params.id }).lean();
    if (!asset) return res.status(404).json({ message: 'Asset not found' });

    const bucket = getAssetImageBucket();
    let file;
    if (asset.imageId) {
      [file] = await bucket.find({ _id: asset.imageId }).limit(1).toArray();
    } else {
      file = await findLatestStoredImage(bucket, asset.documentId);
      if (file) {
        await Asset.updateOne(
          { _id: asset._id, imageId: null },
          { $set: { imageId: file._id } }
        );
      }
    }
    if (!file) return res.status(404).json({ message: 'Asset photo not found' });

    res.set(
      'Content-Type',
      file.metadata?.contentType || file.contentType || 'application/octet-stream'
    );
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    const downloadStream = bucket.openDownloadStream(file._id);
    downloadStream.on('error', (err) => {
      console.error('Error streaming asset photo:', err);
      if (res.headersSent) {
        res.destroy();
      } else {
        res.status(500).json({ message: 'Could not load asset photo' });
      }
    });
    downloadStream.pipe(res);
  } catch (err) {
    console.error('Error loading asset photo:', err);
    res.status(500).json({ message: err.message });
  }
};

exports.uploadAssetImage = async (req, res) => {
  let bucket;
  let uploadedImageId;
  try {
    const contentType = String(req.get('content-type') || '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    if (!IMAGE_TYPES[contentType]) {
      return res.status(415).json({ message: 'Choose a JPEG, PNG, or WebP image.' });
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ message: 'The uploaded image is empty or invalid.' });
    }
    if (!matchesImageType(req.body, contentType)) {
      return res.status(400).json({ message: 'The image data does not match its file type.' });
    }

    const asset = await Asset.findOne({ documentId: req.params.id });
    if (!asset) return res.status(404).json({ message: 'Asset not found' });

    bucket = getAssetImageBucket();
    const extension = IMAGE_TYPES[contentType];
    const uploadStream = bucket.openUploadStream(
      `asset-${asset._id}.${extension}`,
      {
        metadata: { documentId: asset.documentId, contentType },
      }
    );
    uploadedImageId = await new Promise((resolve, reject) => {
      uploadStream.once('error', reject);
      uploadStream.once('finish', () => resolve(uploadStream.id));
      uploadStream.end(req.body);
    });

    const previousImageId = asset.imageId;
    const updated = await Asset.findOneAndUpdate(
      { _id: asset._id },
      { $set: { imageId: uploadedImageId } },
      { new: true, runValidators: true }
    ).lean();
    if (!updated) {
      await removeStoredImage(bucket, uploadedImageId);
      return res.status(404).json({ message: 'Asset not found' });
    }

    try {
      await removeStoredImage(bucket, previousImageId);
    } catch (cleanupError) {
      console.error('New asset photo saved, but old photo cleanup failed:', cleanupError);
      return res.status(200).json({
        data: { imageId: updated.imageId },
        warning: 'The new photo was saved, but the previous photo could not be removed.',
      });
    }

    res.json({ data: { imageId: updated.imageId } });
  } catch (err) {
    if (bucket && uploadedImageId) {
      try {
        await removeStoredImage(bucket, uploadedImageId);
      } catch (cleanupError) {
        console.error('Could not clean up an incomplete asset photo upload:', cleanupError);
      }
    }
    console.error('Error uploading asset photo:', err);
    res.status(500).json({ message: err.message });
  }
};

exports.deleteAssetImage = async (req, res) => {
  try {
    const asset = await Asset.findOne({ documentId: req.params.id });
    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    if (!asset.imageId) return res.json({ message: 'Asset has no photo.' });

    const imageId = asset.imageId;
    const updated = await Asset.findOneAndUpdate(
      { _id: asset._id },
      { $unset: { imageId: 1 } },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ message: 'Asset not found' });

    try {
      await removeStoredImage(getAssetImageBucket(), imageId);
    } catch (cleanupError) {
      console.error('Asset photo reference removed, but GridFS cleanup failed:', cleanupError);
      return res.status(500).json({
        message: 'Photo reference removed, but the stored image could not be deleted.',
      });
    }
    res.json({ message: 'Asset photo removed.' });
  } catch (err) {
    console.error('Error removing asset photo:', err);
    res.status(500).json({ message: err.message });
  }
};

// 5. DELETE ASSET
exports.deleteAsset = async (req, res) => {
  try {
    const deleted = await Asset.findOneAndDelete({ documentId: req.params.id });
    if (!deleted) return res.status(404).json({ message: 'Asset not found' });
    if (deleted.imageId) {
      try {
        await removeStoredImage(getAssetImageBucket(), deleted.imageId);
      } catch (cleanupError) {
        console.error('Asset deleted, but photo cleanup failed:', cleanupError);
        return res.status(500).json({
          message: 'Asset deleted, but its stored photo could not be removed.',
        });
      }
    }
    res.json({ message: 'Asset deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 6. NATURAL LANGUAGE AI SEARCH
exports.aiSearchAssets = async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ message: 'Please enter a search question.' });
    }

    const normalizedPrompt = prompt.trim().toLowerCase();
    let mongoFilter = filterCache.get(normalizedPrompt);

    if (!mongoFilter) {
      mongoFilter = buildSmartLocalFilter(normalizedPrompt);
    }

    if (!mongoFilter && process.env.GEMINI_API_KEY) {
      const ai = await getAiClient();
      const models = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.6-flash'];

      for (const modelName of models) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt.trim(),
            config: {
              systemInstruction: AI_SYSTEM_INSTRUCTION,
              responseMimeType: 'application/json',
              temperature: 0,
              maxOutputTokens: 200,
              thinkingConfig: { thinkingBudget: 0 },
            },
          });

          if (response && response.text) {
            const parsed = JSON.parse(response.text);
            mongoFilter = parsed.filter ? parsed.filter : parsed;
            break;
          }
        } catch (err) {
          continue;
        }
      }
    }

    if (!mongoFilter) {
      mongoFilter = {};
    }

    const filterString = JSON.stringify(mongoFilter);
    if (filterString.includes('$where') || filterString.includes('$function')) {
      return res.status(400).json({ message: 'Unsafe query operator blocked.' });
    }

    filterCache.set(normalizedPrompt, mongoFilter);

    const [assets, stats] = await Promise.all([
      Asset.find(mongoFilter).sort({ updatedAt: -1 }).limit(100).lean(),
      computeStats(mongoFilter),
    ]);

    res.json({
      data: assets,
      stats,
      filter: mongoFilter,
      pagination: {
        total: assets.length,
        page: 1,
        pages: 1,
      },
    });
  } catch (err) {
    console.error('AI Search Error:', err);
    res.status(500).json({ message: 'AI Search failed: ' + err.message });
  }
};
