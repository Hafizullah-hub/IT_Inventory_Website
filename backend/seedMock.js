// backend/seedMock.js
require('dotenv').config();
const mongoose = require('mongoose');
const Asset = require('./src/models/Asset');

const employees = [
  'Ahmad Faiz bin Razak', 'Siti Nurhaliza binti Kamal', 'Tan Wei Ming', 'Rajesh Kumar a/l Subramaniam',
  'Nurul Izzah binti Hassan', 'Lee Chong Wei', 'Mohamad Hafizullah bin Din', 'Chong Mei Ling',
  'Amirul Hakim bin Zainal', 'Kavitha a/p Muthusamy', 'Farah Nadia binti Roslan', 'Wong Kar Wai',
  'Syafiqah binti Mahmud', 'Arvind a/l Krishnan', 'Zulhilmi bin Othman', 'Lim Kit Siang',
  'Aishah binti Ibrahim', 'Vikneswaran a/l Rajoo', 'Khairul Anuar bin Salleh', 'Ng Shu Wen',
  'Muhammad Danish bin Azman', 'Priya Darshini a/p Bala', 'Hafizah binti Noor', 'Goh Jin Wei',
  'Irfan Hakimi bin Yusof', 'Sathish a/l Ganesh', 'Nadia Humaira binti Zulkifli', 'Ong Yew Sin',
  'Firdaus bin Kamarudin', 'Teo Ee Yi', 'Nur Aina binti Zakaria', 'Thinaah a/p Muralitharan',
  'Azlan Shah bin Alias', 'Pearly Tan Koong Le', 'Syahirah binti Halim', 'Aaron Chia Teng Fong',
  'Soh Wooi Yik', 'Zii Jia Lee', 'Hazwan bin Bakri', 'Brendan Gan',
  'Safawi Rasid', 'Arif Aiman bin Hanapi', 'Faisal Halim', 'Dion Cools',
  'Syihan Hazmi', 'Stuart Wilkin', 'Paulo Josue', 'Endrick Dos Santos',
  'Unassigned', 'Unassigned'
];

const departments = ['IT', 'Finance', 'HR', 'Operations'];

const catalog = [
  // Laptops (26 units)
  { type: 'Laptop', prefix: 'LAP', brand: 'HP', model: 'EliteBook 840 G10', cpu: 'Intel Core i7-1365U', ram: '32GB DDR5', disk: '1TB NVMe SSD', os: 'Windows 11 Pro', price: 6450 },
  { type: 'Laptop', prefix: 'LAP', brand: 'Lenovo', model: 'ThinkPad T14 Gen 4', cpu: 'Intel Core i5-1335U', ram: '16GB DDR5', disk: '512GB NVMe SSD', os: 'Windows 11 Pro', price: 4890 },
  { type: 'Laptop', prefix: 'LAP', brand: 'Dell', model: 'Latitude 5440', cpu: 'Intel Core i7-1355U', ram: '16GB DDR4', disk: '512GB NVMe SSD', os: 'Windows 11 Pro', price: 5150 },
  { type: 'Laptop', prefix: 'LAP', brand: 'HP', model: 'ProBook 440 G10', cpu: 'Intel Core i5-1335U', ram: '16GB DDR4', disk: '512GB NVMe SSD', os: 'Windows 11 Pro', price: 4100 },
  { type: 'Laptop', prefix: 'LAP', brand: 'Lenovo', model: 'ThinkPad X1 Carbon Gen 11', cpu: 'Intel Core i7-1370P', ram: '32GB LPDDR5', disk: '1TB NVMe SSD', os: 'Windows 11 Pro', price: 7850 },
  { type: 'Laptop', prefix: 'LAP', brand: 'HP', model: 'Victus 16-r0000', cpu: 'Intel Core i7-13700H', ram: '32GB DDR5', disk: '1TB NVMe SSD', os: 'Windows 11 Pro', price: 5600 },
  // Desktops (12 units)
  { type: 'Desktop', prefix: 'DSK', brand: 'Dell', model: 'OptiPlex 7010 SFF', cpu: 'Intel Core i5-13500', ram: '16GB DDR4', disk: '512GB NVMe SSD', os: 'Windows 11 Pro', price: 3650 },
  { type: 'Desktop', prefix: 'DSK', brand: 'HP', model: 'Pro SFF 400 G9', cpu: 'Intel Core i5-12500', ram: '16GB DDR4', disk: '512GB NVMe SSD', os: 'Windows 11 Pro', price: 3390 },
  { type: 'Desktop', prefix: 'DSK', brand: 'Lenovo', model: 'ThinkCentre M70s Gen 4', cpu: 'Intel Core i7-13700', ram: '32GB DDR4', disk: '1TB NVMe SSD', os: 'Windows 11 Pro', price: 4450 },
  // Servers (4 units)
  { type: 'Server', prefix: 'SRV', brand: 'HPE', model: 'ProLiant DL380 Gen11', cpu: 'Dual Intel Xeon Gold 6426Y', ram: '256GB DDR5 ECC', disk: '4x 1.92TB NVMe RAID10', os: 'Windows Server 2022', price: 38500 },
  { type: 'Server', prefix: 'SRV', brand: 'Dell', model: 'PowerEdge R760xs', cpu: 'Dual Intel Xeon Silver 4410Y', ram: '128GB DDR5 ECC', disk: '4x 960GB SSD RAID5', os: 'Windows Server 2022', price: 29800 },
  // Monitors (8 units)
  { type: 'Monitor', prefix: 'MON', brand: 'Dell', model: 'UltraSharp 27 U2724DE', cpu: 'N/A', ram: 'N/A', disk: 'N/A', os: 'N/A', price: 2150 },
  { type: 'Monitor', prefix: 'MON', brand: 'HP', model: 'E24 G5 FHD Monitor', cpu: 'N/A', ram: 'N/A', disk: 'N/A', os: 'N/A', price: 890 },
];

const suppliers = [
  'VSTECS Astar Sdn Bhd',
  'Ingram Micro Malaysia Sdn Bhd',
  'SNS Network (M) Sdn Bhd',
  'VADS Business Process Sdn Bhd',
  'Jos Malaysia Sdn Bhd',
];

const antiviruses = [
  'CrowdStrike Falcon Sensor',
  'Kaspersky Endpoint Security',
  'Sophos Intercept X',
];

const locationsByDept = {
  IT: 'Level 12, Menara Cyberjaya',
  Finance: 'Level 10, Menara Cyberjaya',
  HR: 'Level 8, Menara Cyberjaya',
  Operations: 'Port Klang Logistics Hub - Block B',
};

function generate50Assets() {
  const assets = [];

  for (let i = 1; i <= 50; i++) {
    const numStr = String(i).padStart(3, '0');
    const dept = departments[(i - 1) % departments.length];
    const deptCode = dept === 'Operations' ? 'OPS' : dept === 'Finance' ? 'FIN' : dept;

    // Pick balanced device types: 28 Laptops, 10 Desktops, 4 Servers, 8 Monitors
    let spec;
    if (i <= 28) {
      spec = catalog[i % 6]; // Laptops
    } else if (i <= 38) {
      spec = catalog[6 + (i % 3)]; // Desktops
    } else if (i <= 42) {
      spec = catalog[9 + (i % 2)]; // Servers
    } else {
      spec = catalog[11 + (i % 2)]; // Monitors
    }

    const year = i % 3 === 0 ? '2025' : '2026';
    const month = String(((i * 2) % 11) + 1).padStart(2, '0');
    const day = String(((i * 3) % 25) + 1).padStart(2, '0');

    const documentId = `${deptCode}-${spec.prefix}-${year}-${numStr}`;
    const serialPrefix = spec.brand === 'HP' ? '5CG' : spec.brand === 'Dell' ? 'CN0' : spec.brand === 'Lenovo' ? 'PF4' : 'CZJ';
    const serial = `${serialPrefix}${year.slice(-2)}${numStr}X${(i * 7) % 9}M`;

    const isMonitor = spec.type === 'Monitor';
    const isServer = spec.type === 'Server';
    const avName = isMonitor ? 'N/A' : antiviruses[i % antiviruses.length];
    const supplier = suppliers[i % suppliers.length];

    assets.push({
      documentId,
      core_details: {
        asset_no: documentId,
        serial,
        type: spec.type,
        manufacturer: spec.brand,
        model: spec.model,
        comp_name: isMonitor ? 'N/A (Display Unit)' : `MY-${deptCode}-${spec.prefix}${numStr}`,
        ad: isMonitor ? 'Not Applicable' : 'Joined - corp.company.my',
        box_locate: `IT Store Room - Rack ${String.fromCharCode(65 + (i % 4))}${(i % 5) + 1}`,
      },
      assignment: {
        user: isServer ? 'Infrastructure & Cloud Team' : employees[i - 1],
        dept: isServer ? 'IT' : dept,
        company: 'TechCorp Malaysia Sdn Bhd',
        location: isServer ? `Cyberjaya Data Center - Rack C0${(i % 4) + 1}` : locationsByDept[dept],
        last_use: `2026-11-${String(10 + (i % 8)).padStart(2, '0')}`,
      },
      hardware: {
        processor: spec.cpu,
        ram: spec.ram,
        hardisk: spec.disk,
        additional_hardware: isMonitor
          ? 'DisplayPort & USB-C Cable'
          : isServer
          ? 'Dual Redundant PSU, 25GbE SFP28 NIC'
          : 'Wireless Mouse, Laptop Bag, Power Adapter',
      },
      software: {
        os: {
          name: spec.os,
          bit: isMonitor ? 'N/A' : '64-bit',
          product_key: isMonitor ? 'N/A' : `W269N-WFGWX-YVC9B-4J6C9-K${numStr}`,
        },
        office: {
          version: isMonitor || isServer ? 'N/A' : 'Microsoft 365 Apps for Enterprise',
          licence_key: isMonitor || isServer ? 'N/A' : `M365-ENT-${year}-${numStr}`,
        },
        antivirus: {
          name: avName,
          product_key: isMonitor ? 'N/A' : `AV-KEY-${year}-${numStr}`,
          start_date: isMonitor ? '' : `${year}-${month}-${day}`,
          expiry_date: isMonitor ? '' : `${Number(year) + 1}-${month}-${day}`,
          last_update: isMonitor ? '' : '2026-11-18',
        },
        other_app: isMonitor
          ? 'Display Manager'
          : isServer
          ? 'VMware vSphere, Veeam Backup Agent'
          : dept === 'Finance'
          ? 'SAP GUI 8.0, Adobe Acrobat Pro, Chrome'
          : dept === 'IT'
          ? 'VS Code, Docker Desktop, Postman, Git'
          : 'Microsoft Teams, Zoom, Chrome, Adobe Reader',
      },
      procurement: {
        supplier,
        capex_no: `CAPEX-${year}-${deptCode}-${String((i % 20) + 1).padStart(3, '0')}`,
        po_no: `PO-${year}-${String(1000 + i)}`,
        po_date: `${year}-${month}-${day}`,
        invoice_no: `INV-${year}${String(5000 + i)}`,
        amount: spec.price,
        warranty: `3 Years Onsite Support (Exp: ${Number(year) + 3}-${month}-${day})`,
      },
      metadata: {
        remark1: `Standard ${dept} ${spec.type} deployment batch ${year}`,
        remark2: 'Verified and tagged by IT Asset Management team',
        file_seq: `FILE-${year}-${deptCode}-${numStr}`,
      },
    });
  }

  return assets;
}

async function seed50() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB Atlas...');

    const mockAssets = generate50Assets();

    // Clear old test records and insert all 50 cleanly in one fast bulk operation
    await Asset.deleteMany({});

    const ops = mockAssets.map((item) => ({
      updateOne: {
        filter: { documentId: item.documentId },
        update: { $set: item },
        upsert: true,
      },
    }));

    const result = await Asset.bulkWrite(ops);
    console.log(`Successfully seeded ${mockAssets.length} IT assets into MongoDB!`);
    console.log(`Inserted/Upserted: ${result.upsertedCount + result.modifiedCount} records.`);
    process.exit(0);
  } catch (err) {
    console.error('Error seeding 50 assets:', err.message);
    process.exit(1);
  }
}

seed50();
