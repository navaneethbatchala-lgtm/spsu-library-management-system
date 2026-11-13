const express = require('express');
const router = express.Router();
const { getIssues, issueBook, returnBook, getOverdue } = require('../controllers/issueController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.get('/', requireAuth, getIssues);
router.get('/overdue', requireAdmin, getOverdue);
router.post('/', requireAdmin, issueBook);
router.post('/issue', requireAdmin, issueBook);
router.post('/:id/return', requireAdmin, returnBook);

module.exports = router;
