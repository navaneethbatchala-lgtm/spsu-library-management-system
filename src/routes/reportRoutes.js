const express = require('express');
const router = express.Router();
const { booksReport, studentsReport, issuedReport, overdueReport } = require('../controllers/reportController');
const { requireAdmin } = require('../middleware/auth');

router.get('/books', requireAdmin, booksReport);
router.get('/students', requireAdmin, studentsReport);
router.get('/issued', requireAdmin, issuedReport);
router.get('/overdue', requireAdmin, overdueReport);

module.exports = router;
