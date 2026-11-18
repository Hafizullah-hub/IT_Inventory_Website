// backend/src/controllers/assetController.js
const Asset = require('../models/Asset');

let aiClient = null;
const filterCache = new Map();

async function getAiClient() {
  if (!aiClient) {
    const { GoogleGenAI } = await import('@google/genai');
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

async function computeStats(query = {}) {
  const result = await Asset.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        totalAssets: { $sum: 1 },
        totalValue: { $sum: { $ifNull: ['$procurement.amount', 0] } },
        workstations: {
          $sum: {
            $cond: [
              { $in: ['$core_details.type', ['Laptop', 'Desktop']] },
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
                  { $ne: ['$assignment.user', 'Unassigned'] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  return (
    result[0] || {
      totalAssets: 0,
      totalValue: 0,
      workstations: 0,
      assigned: 0,
    }
  );
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
2. For procurement.amount use $gt, $gte, $lt, $lte.
3. Output ONLY the MongoDB filter JSON object.`;

function buildSmartLocalFilter(promptText) {
  const text = promptText.toLowerCase();
  const andConditions = [];

  const types = [];
  if (/\blaptops?\b/.test(text)) types.push('Laptop');
  if (/\bdesktops?\b|\bpcs?\b/.test(text)) types.push('Desktop');
  if (/\bservers?\b/.test(text)) types.push('Server');
  if (/\bmonitors?\b|\bdisplays?\b|\bscreens?\b/.test(text)) types.push('Monitor');
  if (types.length === 1) {
    andConditions.push({ 'core_details.type': { $regex: `^${types[0]}$`, $options: 'i' } });
  } else if (types.length > 1) {
    andConditions.push({ 'core_details.type': { $in: types.map((t) => new RegExp(`^${t}$`, 'i')) } });
  }

  const depts = [];
  if (/\bit\b|\binformation technology\b/.test(text)) depts.push('IT');
  if (/\bfinance\b|\baccounting\b/.test(text)) depts.push('Finance');
  if (/\bhr\b|\bhuman resources?\b/.test(text)) depts.push('HR');
  if (/\boperations?\b|\bops\b/.test(text)) depts.push('Operations');
  if (depts.length === 1) {
    andConditions.push({ 'assignment.dept': { $regex: `^${depts[0]}$`, $options: 'i' } });
  } else if (depts.length > 1) {
    andConditions.push({ 'assignment.dept': { $in: depts.map((d) => new RegExp(`^${d}$`, 'i')) } });
  }

  const brands = [];
  if (/\bhpe\b/.test(text)) brands.push('HPE');
  else if (/\bhp\b/.test(text)) brands.push('^HP$');
  if (/\bdell\b/.test(text)) brands.push('Dell');
  if (/\blenovo\b|\bthinkpad\b/.test(text)) brands.push('Lenovo');
  if (brands.length === 1) {
    andConditions.push({ 'core_details.manufacturer': { $regex: brands[0], $options: 'i' } });
  } else if (brands.length > 1) {
    andConditions.push({
      'core_details.manufacturer': { $in: brands.map((b) => new RegExp(b, 'i')) },
    });
  }

  const avs = [];
  if (/crowdstrike|falcon/.test(text)) avs.push('CrowdStrike');
  if (/kaspersky/.test(text)) avs.push('Kaspersky');
  if (/sophos/.test(text)) avs.push('Sophos');
  if (avs.length > 0) {
    andConditions.push({ 'software.antivirus.name': { $regex: avs.join('|'), $options: 'i' } });
  }

  const ramMatches = [...text.matchAll(/\b(8|16|32|64|128|256)\s*gb\b/gi)].map((m) => `${m[1]}GB`);
  if (ramMatches.length > 0 && /ram|memory/.test(text)) {
    andConditions.push({ 'hardware.ram': { $regex: ramMatches.join('|'), $options: 'i' } });
  }

  const overMatch = text.match(/(?:over|above|more than|greater than|>)\s*(?:rm\s*)?([0-9,]+(?:\.[0-9]+)?)/i);
  if (overMatch) {
    const val = parseFloat(overMatch[1].replace(/,/g, ''));
    if (!isNaN(val)) andConditions.push({ 'procurement.amount': { $gt: val } });
  }
  const underMatch = text.match(/(?:under|below|less than|cheaper than|<)\s*(?:rm\s*)?([0-9,]+(?:\.[0-9]+)?)/i);
  if (underMatch) {
    const val = parseFloat(underMatch[1].replace(/,/g, ''));
    if (!isNaN(val)) andConditions.push({ 'procurement.amount': { $lt: val } });
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
      const regex = new RegExp(search, 'i');
      query.$or = [
        { documentId: regex },
        { 'core_details.asset_no': regex },
        { 'core_details.serial': regex },
        { 'core_details.manufacturer': regex },
        { 'core_details.model': regex },
        { 'core_details.comp_name': regex },
        { 'assignment.user': regex },
      ];
    }

    if (dept) query['assignment.dept'] = dept;
    if (type) query['core_details.type'] = type;

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
    res.json({ data: asset });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 3. CREATE NEW ASSET
exports.createAsset = async (req, res) => {
  try {
    const { documentId, core_details } = req.body;
    const finalId = documentId || core_details?.asset_no;

    if (!finalId) {
      return res.status(400).json({ message: 'Asset Number (documentId) is required' });
    }

    const existing = await Asset.findOne({ documentId: finalId }).lean();
    if (existing) {
      return res.status(409).json({ message: `Asset ${finalId} already exists` });
    }

    const newAsset = await Asset.create({ ...req.body, documentId: finalId });
    res.status(201).json({ data: newAsset });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// 4. UPDATE ASSET
exports.updateAsset = async (req, res) => {
  try {
    const updated = await Asset.findOneAndUpdate(
      { documentId: req.params.id },
      { $set: req.body },
      { new: true, runValidators: true }
    ).lean();
    if (!updated) return res.status(404).json({ message: 'Asset not found' });
    res.json({ data: updated });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// 5. DELETE ASSET
exports.deleteAsset = async (req, res) => {
  try {
    const deleted = await Asset.findOneAndDelete({ documentId: req.params.id });
    if (!deleted) return res.status(404).json({ message: 'Asset not found' });
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
      const cleanWords = prompt
        .trim()
        .replace(/[^a-zA-Z0-9\s-]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 1 && !['show', 'all', 'the', 'with', 'using', 'assets', 'in', 'or', 'and'].includes(w.toLowerCase()));

      const regex = new RegExp(cleanWords.join('|') || prompt.trim(), 'i');
      mongoFilter = {
        $or: [
          { documentId: regex },
          { 'core_details.type': regex },
          { 'core_details.manufacturer': regex },
          { 'core_details.model': regex },
          { 'assignment.user': regex },
          { 'assignment.dept': regex },
          { 'hardware.processor': regex },
          { 'hardware.ram': regex },
          { 'software.os.name': regex },
          { 'software.antivirus.name': regex },
          { 'procurement.supplier': regex },
        ],
      };
    }

    const filterString = JSON.stringify(mongoFilter);
    if (filterString.includes('$where') || filterString.includes('$function')) {
      return res.status(400).json({ message: 'Unsafe query operator blocked.' });
    }

    filterCache.set(normalizedPrompt, mongoFilter);

    const [assets, stats] = await Promise.all([
      Asset.find(mongoFilter).sort({ updatedAt: -1 }).limit(50).lean(),
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
