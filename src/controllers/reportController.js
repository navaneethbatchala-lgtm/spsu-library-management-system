/**
 * Reports Controller
 */

const { pool } = require('../config/db');

// GET /api/reports/books
async function booksReport(req, res) {
  try {
    const [rows] = await pool.execute(
      `SELECT b.isbn, b.title, b.author, b.publisher, b.edition_year,
              b.total_copies, b.available_copies,
              (b.total_copies - b.available_copies) AS issued_copies,
              b.shelf_location, c.name AS category
       FROM books b JOIN categories c ON b.category_id = c.id
       ORDER BY c.name, b.title`
    );
    return res.json({ success: true, data: rows });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Error generating report.' });
  }
}

// GET /api/reports/students
async function studentsReport(req, res) {
  try {
    const [rows] = await pool.execute(
      `SELECT s.roll_number, s.full_name, s.email, s.phone, s.department,
              s.semester, s.status,
              COUNT(CASE WHEN bi.return_date IS NULL THEN 1 END) AS active_loans,
              COUNT(CASE WHEN bi.status = 'RETURNED' THEN 1 END) AS books_returned,
              COALESCE(SUM(bi.fine_amount), 0) AS total_fine_paid
       FROM students s
       LEFT JOIN book_issues bi ON s.id = bi.student_id
       GROUP BY s.id ORDER BY s.roll_number`
    );
    return res.json({ success: true, data: rows });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Error generating report.' });
  }
}

// GET /api/reports/issued
async function issuedReport(req, res) {
  try {
    const { from, to } = req.query;
    let sql = `
      SELECT bi.id, bi.issue_date, bi.due_date, bi.return_date, bi.fine_amount, bi.status,
             b.isbn, b.title AS book_title, b.author,
             s.roll_number, s.full_name AS student_name, s.department
      FROM book_issues bi
      JOIN books b ON bi.book_id = b.id
      JOIN students s ON bi.student_id = s.id
      WHERE 1=1
    `;
    const params = [];
    if (from) { sql += ` AND bi.issue_date >= ?`; params.push(from); }
    if (to) { sql += ` AND bi.issue_date <= ?`; params.push(to); }
    sql += ` ORDER BY bi.issue_date DESC`;

    const [rows] = await pool.execute(sql, params);
    return res.json({ success: true, data: rows });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Error generating report.' });
  }
}

// GET /api/reports/overdue
async function overdueReport(req, res) {
  try {
    const FINE_RATE = parseFloat(process.env.FINE_RATE_PER_DAY) || 5.00;
    const [rows] = await pool.execute(
      `SELECT bi.id, bi.issue_date, bi.due_date,
              DATEDIFF(CURDATE(), bi.due_date) AS days_overdue,
              ROUND(DATEDIFF(CURDATE(), bi.due_date) * ?, 2) AS accrued_fine,
              b.isbn, b.title AS book_title,
              s.roll_number, s.full_name AS student_name, s.phone, s.department
       FROM book_issues bi
       JOIN books b ON bi.book_id = b.id
       JOIN students s ON bi.student_id = s.id
       WHERE bi.return_date IS NULL AND bi.due_date < CURDATE()
       ORDER BY bi.due_date ASC`,
      [FINE_RATE]
    );
    return res.json({ success: true, data: rows });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Error generating report.' });
  }
}

module.exports = { booksReport, studentsReport, issuedReport, overdueReport };
