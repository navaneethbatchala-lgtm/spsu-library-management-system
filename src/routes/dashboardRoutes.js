const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../controllers/dashboardController');
const { requireAdmin } = require('../middleware/auth');

router.get('/stats', requireAdmin, getDashboardStats);

module.exports = router;
