/**
 * Dashboard Controller - Statistics and activity feed
 */

const { pool } = require('../config/db');

async function getDashboardStats(req, res) {
  try {
    const [[books]] = await pool.execute('SELECT COUNT(*) AS total FROM books');
    const [[students]] = await pool.execute('SELECT COUNT(*) AS total FROM students WHERE status = "active"');
    const [[available]] = await pool.execute('SELECT COALESCE(SUM(available_copies), 0) AS total FROM books');
    const [[issued]] = await pool.execute(`SELECT COUNT(*) AS total FROM book_issues WHERE return_date IS NULL`);
    const [[overdue]] = await pool.execute(`SELECT COUNT(*) AS total FROM book_issues WHERE return_date IS NULL AND due_date < CURDATE()`);
    const [[totalCopies]] = await pool.execute('SELECT COALESCE(SUM(total_copies), 0) AS total FROM books');

    // Recent activity logs
    const [activity] = await pool.execute(
      `SELECT al.action_type, al.details, al.created_at, u.full_name AS actor
       FROM activity_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ORDER BY al.created_at DESC LIMIT 10`
    );

    // Top issued books (last 30 days)
    const [topBooks] = await pool.execute(
      `SELECT b.title, b.author, COUNT(bi.id) AS issue_count
       FROM book_issues bi JOIN books b ON bi.book_id = b.id
       WHERE bi.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY bi.book_id, b.title, b.author
       ORDER BY issue_count DESC LIMIT 5`
    );

    // Monthly issue trend (last 6 months)
    const [monthlyTrend] = await pool.execute(
      `SELECT DATE_FORMAT(issue_date, '%b %Y') AS month,
              DATE_FORMAT(issue_date, '%Y-%m') AS ym,
              COUNT(*) AS issued,
              SUM(CASE WHEN status = 'RETURNED' THEN 1 ELSE 0 END) AS returned
       FROM book_issues
       WHERE issue_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY ym, month
       ORDER BY ym ASC`
    );

    return res.json({
      success: true,
      data: {
        totalBooks: books.total,
        totalStudents: students.total,
        availableCopies: available.total || 0,
        issuedBooks: issued.total,
        overdueBooks: overdue.total,
        totalCopies: totalCopies.total || 0,
        activity,
        topBooks,
        monthlyTrend
      }
    });
  } catch (error) {
    console.error('[DASHBOARD STATS ERROR]', error);
    return res.status(500).json({ success: false, message: 'Error loading dashboard.' });
  }
}

module.exports = { getDashboardStats };
