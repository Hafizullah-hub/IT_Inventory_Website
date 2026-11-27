// backend/src/models/Asset.js
const mongoose = require('mongoose');

const AssetSchema = new mongoose.Schema(
  {
    // Internal record ID; asset numbers are optional business identifiers.
    documentId: {
      type: String,
      required: [true, 'Document ID (Asset No) is required'],
      unique: true,
      trim: true,
      index: true,
    },
    imageId: { type: mongoose.Schema.Types.ObjectId, default: null },
    core_details: {
      asset_no: { type: String, default: '', trim: true },
      serial: { type: String, default: '' },
      type: { type: String, default: '' }, // e.g., Laptop, Desktop, Server
      manufacturer: { type: String, default: '' },
      model: { type: String, default: '' },
      comp_name: { type: String, default: '' },
      ad: { type: String, default: '' }, // Active Directory status/domain
      box_locate: { type: String, default: '' },
    },
    assignment: {
      user: { type: String, default: 'Unassigned', index: true },
      dept: { type: String, default: '', index: true },
      company: { type: String, default: '' },
      location: { type: String, default: '' },
      last_use: { type: String, default: '' },
    },
    hardware: {
      processor: { type: String, default: '' },
      ram: { type: String, default: '' },
      hardisk: { type: String, default: '' },
      additional_hardware: { type: String, default: '' },
    },
    software: {
      os: {
        name: { type: String, default: '' },
        bit: { type: String, default: '' },
        product_key: { type: String, default: '' },
      },
      office: {
        version: { type: String, default: '' },
        licence_key: { type: String, default: '' },
      },
      antivirus: {
        name: { type: String, default: '' },
        product_key: { type: String, default: '' },
        start_date: { type: String, default: '' },
        expiry_date: { type: String, default: '' },
        last_update: { type: String, default: '' },
      },
      other_app: { type: String, default: '' },
    },
    procurement: {
      supplier: { type: String, default: '' },
      capex_no: { type: String, default: '' },
      po_no: { type: String, default: '' },
      po_date: { type: String, default: '' },
      invoice_no: { type: String, default: '' },
      amount: { type: Number, default: 0 },
      warranty: { type: String, default: '' },
    },
    metadata: {
      remark1: { type: String, default: '' },
      remark2: { type: String, default: '' },
      file_seq: { type: String, default: '' },
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// Compound text index for fast global search bar queries
AssetSchema.index({
  documentId: 'text',
  'core_details.serial': 'text',
  'core_details.comp_name': 'text',
  'assignment.user': 'text',
  'assignment.dept': 'text',
});

module.exports = mongoose.model('Asset', AssetSchema);
