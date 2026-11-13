const express = require('express');
const router = express.Router();
const {
  getStudents,
  getStudentById,
  getStudentHistory,
  addStudent,
  updateStudent,
  deleteStudent,
  getDepartments,
  getMyProfile,
  getMyHistory
} = require('../controllers/studentController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.get('/departments', requireAuth, getDepartments);
router.get('/profile/me', requireAuth, getMyProfile);
router.get('/profile/history', requireAuth, getMyHistory);
router.get('/', requireAdmin, getStudents);
router.get('/:id', requireAdmin, getStudentById);
router.get('/:id/history', requireAuth, getStudentHistory);
router.post('/', requireAdmin, addStudent);
router.put('/:id', requireAdmin, updateStudent);
router.delete('/:id', requireAdmin, deleteStudent);

module.exports = router;
