const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, uploadPhoto, deletePhoto, reorderPhotos } = require('../controllers/profileController');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/me', authenticate, (req, res) => {
  req.params.id = req.user.id;
  getProfile(req, res);
});
router.get('/:id', authenticate, getProfile);
router.put('/me', authenticate, updateProfile);
router.post('/me/photos', authenticate, upload.single('photo'), uploadPhoto);
router.delete('/me/photos/:photoId', authenticate, deletePhoto);
router.put('/me/photos/reorder', authenticate, reorderPhotos);

module.exports = router;
