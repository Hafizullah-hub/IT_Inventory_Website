// backend/src/routes/assetRoutes.js
const express = require('express');
const router = express.Router();
const assetController = require('../controllers/assetController');
const parseAssetImage = express.raw({ type: 'image/*', limit: '10mb' });

function handleImageParseError(err, req, res, next) {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Asset photo must be 10 MB or smaller.' });
  }
  next(err);
}

router.get('/', assetController.getAssets);
router.post('/', assetController.createAsset);
router.post('/ai-search', assetController.aiSearchAssets);
router.get('/:id/image', assetController.getAssetImage);
router.put('/:id/image', parseAssetImage, handleImageParseError, assetController.uploadAssetImage);
router.delete('/:id/image', assetController.deleteAssetImage);
router.get('/:id', assetController.getAssetById);
router.put('/:id', assetController.updateAsset);
router.delete('/:id', assetController.deleteAsset);

module.exports = router;
