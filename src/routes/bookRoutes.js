const express = require('express');
const router = express.Router();
const { getBooks, getBookById, addBook, updateBook, deleteBook, checkAvailability, getCategories, addCategory } = require('../controllers/bookController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.get('/availability', requireAuth, checkAvailability);
router.get('/categories', requireAuth, getCategories);
router.post('/categories', requireAdmin, addCategory);
router.get('/', requireAuth, getBooks);
router.get('/:id', requireAuth, getBookById);
router.post('/', requireAdmin, addBook);
router.put('/:id', requireAdmin, updateBook);
router.delete('/:id', requireAdmin, deleteBook);

module.exports = router;
