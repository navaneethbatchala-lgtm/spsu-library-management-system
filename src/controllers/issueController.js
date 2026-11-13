/**
 * Issue & Return Controller
 * Handles book lending and returns with transactions
 */

const { pool, withTransaction } = require('../config/db');

const LOAN_PERIOD_DAYS = parseInt(process.env.LOAN_PERIOD_DAYS) || 14;
const FINE_RATE = parseFloat(process.env.FINE_RATE_PER_DAY) || 5.00;
const MAX_BOOKS = parseInt(process.env.MAX_BOOKS_PER_STUDENT) || 3;

// GET /api/issues - All issues with optional filters
async function getIssues(req, res) {
  try {
    const { status, student_id, book_id } = req.query;
    let sql = `
      SELECT bi.id, bi.issue_date, bi.due_date, bi.return_date, bi.fine_amount, bi.status, bi.remarks,
             b.id AS book_id, b.title AS book_title, b.author, b.isbn,
             s.id AS student_id, s.full_name AS student_name, s.roll_number, s.department,
             u.full_name AS issued_by_name
      FROM book_issues bi
      JOIN books b ON bi.book_id = b.id
      JOIN students s ON bi.student_id = s.id
      LEFT JOIN users u ON bi.issued_by = u.id
      WHERE 1=1
    `;
    const params = [];
    if (status === 'ISSUED') {
      sql += ` AND bi.return_date IS NULL`;
    } else if (status === 'RETURNED') {
      sql += ` AND bi.return_date IS NOT NULL`;
    } else if (status === 'OVERDUE') {
      sql += ` AND bi.return_date IS NULL AND bi.due_date < CURDATE()`;
    } else if (status) {
      sql += ` AND bi.status = ?`;
      params.push(status);
    }
    if (student_id) { sql += ` AND bi.student_id = ?`; params.push(student_id); }
    if (book_id) { sql += ` AND bi.book_id = ?`; params.push(book_id); }
    sql += ` ORDER BY bi.created_at DESC`;

    const [issues] = await pool.execute(sql, params);

    // Dynamically update OVERDUE status
    const today = new Date().toISOString().split('T')[0];
    const updated = issues.map(issue => {
      if (issue.status === 'ISSUED' && issue.due_date < today) {
        const days = Math.floor((new Date(today) - new Date(issue.due_date)) / (1000 * 60 * 60 * 24));
        return { ...issue, status: 'OVERDUE', computed_fine: (days * FINE_RATE).toFixed(2) };
      }
      return issue;
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error('[GET ISSUES ERROR]', error);
    return res.status(500).json({ success: false, message: 'Error fetching issues.' });
  }
}

// POST /api/issues/issue - Issue a book
async function issueBook(req, res) {
  try {
    const { book_id, student_id, remarks } = req.body;
    if (!book_id || !student_id) {
      return res.status(400).json({ success: false, message: 'Book and Student are required.' });
    }

    const result = await withTransaction(async (conn) => {
      // 1. Lock the book row for update
      const [[book]] = await conn.execute(
        'SELECT id, title, available_copies FROM books WHERE id = ? FOR UPDATE',
        [book_id]
      );
      if (!book) throw { status: 404, message: 'Book not found.' };
      if (book.available_copies < 1) throw { status: 409, message: `"${book.title}" has no available copies right now.` };

      // 2. Check student
      const [[student]] = await conn.execute(
        'SELECT id, full_name, roll_number, status FROM students WHERE id = ?',
        [student_id]
      );
      if (!student) throw { status: 404, message: 'Student not found.' };
      if (student.status === 'suspended') throw { status: 403, message: `Student "${student.full_name}" is suspended and cannot borrow books.` };

      // 3. Check if student already has this book
      const [[dupCheck]] = await conn.execute(
        `SELECT id FROM book_issues WHERE book_id = ? AND student_id = ? AND return_date IS NULL LIMIT 1`,
        [book_id, student_id]
      );
      if (dupCheck) throw { status: 409, message: `${student.full_name} already has a copy of "${book.title}" currently issued.` };

      // 4. Check active loan limit
      const [[loanCount]] = await conn.execute(
        `SELECT COUNT(*) AS count FROM book_issues WHERE student_id = ? AND return_date IS NULL`,
        [student_id]
      );
      if (loanCount.count >= MAX_BOOKS) throw { status: 409, message: `${student.full_name} has reached the maximum loan limit of ${MAX_BOOKS} books.` };

      // 5. Calculate dates
      const issueDate = new Date().toISOString().split('T')[0];
      const dueDate = new Date(Date.now() + LOAN_PERIOD_DAYS * 86400000).toISOString().split('T')[0];

      // 6. Create issue record
      const [insertResult] = await conn.execute(
        `INSERT INTO book_issues (book_id, student_id, issued_by, issue_date, due_date, status, remarks) VALUES (?, ?, ?, ?, ?, 'ISSUED', ?)`,
        [book_id, student_id, req.session.user.id, issueDate, dueDate, remarks || null]
      );

      // 7. Decrement available copies
      await conn.execute(
        'UPDATE books SET available_copies = available_copies - 1 WHERE id = ?',
        [book_id]
      );

      // 8. Log
      await conn.execute(
        `INSERT INTO activity_logs (user_id, action_type, details) VALUES (?, 'BOOK_ISSUED', ?)`,
        [req.session.user.id, `Issued "${book.title}" to ${student.full_name} (Roll: ${student.roll_number}). Due: ${dueDate}`]
      );

      return { issueId: insertResult.insertId, dueDate, issueDate, bookTitle: book.title, studentName: student.full_name };
    });

    return res.status(201).json({
      success: true,
      message: `"${result.bookTitle}" issued to ${result.studentName}. Due date: ${result.dueDate}`,
      data: result
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    console.error('[ISSUE BOOK ERROR]', error);
    return res.status(500).json({ success: false, message: 'Error issuing book.' });
  }
}

// POST /api/issues/:id/return - Return a book
async function returnBook(req, res) {
  try {
    const { remarks } = req.body;
    const issueId = req.params.id;

    const result = await withTransaction(async (conn) => {
      const [[issue]] = await conn.execute(
        `SELECT bi.*, b.title AS book_title, s.full_name AS student_name, s.roll_number
         FROM book_issues bi
         JOIN books b ON bi.book_id = b.id
         JOIN students s ON bi.student_id = s.id
         WHERE bi.id = ? FOR UPDATE`,
        [issueId]
      );
      if (!issue) throw { status: 404, message: 'Issue record not found.' };
      if (issue.status === 'RETURNED') throw { status: 409, message: 'This book has already been returned.' };

      // Calculate fine
      const today = new Date().toISOString().split('T')[0];
      let fineAmount = 0;
      if (today > issue.due_date) {
        const daysLate = Math.floor((new Date(today) - new Date(issue.due_date)) / (1000 * 60 * 60 * 24));
        fineAmount = parseFloat((daysLate * FINE_RATE).toFixed(2));
      }

      // Update issue record
      await conn.execute(
        `UPDATE book_issues SET return_date = ?, fine_amount = ?, status = 'RETURNED', remarks = ? WHERE id = ?`,
        [today, fineAmount, remarks || issue.remarks, issueId]
      );

      // Increment available copies
      await conn.execute(
        'UPDATE books SET available_copies = available_copies + 1 WHERE id = ?',
        [issue.book_id]
      );

      // Log
      const fineMsg = fineAmount > 0 ? ` Fine: ₹${fineAmount}` : '';
      await conn.execute(
        `INSERT INTO activity_logs (user_id, action_type, details) VALUES (?, 'BOOK_RETURNED', ?)`,
        [req.session.user.id, `Returned "${issue.book_title}" by ${issue.student_name} (Roll: ${issue.roll_number}).${fineMsg}`]
      );

      return { issueId, bookTitle: issue.book_title, studentName: issue.student_name, returnDate: today, fineAmount };
    });

    const fineMsg = result.fineAmount > 0 ? ` Fine collected: ₹${result.fineAmount}` : ' No fine.';
    return res.json({
      success: true,
      message: `"${result.bookTitle}" returned successfully.${fineMsg}`,
      data: result
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    console.error('[RETURN BOOK ERROR]', error);
    return res.status(500).json({ success: false, message: 'Error processing return.' });
  }
}

// GET /api/issues/overdue - All overdue books
async function getOverdue(req, res) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const [rows] = await pool.execute(
      `SELECT bi.id, bi.issue_date, bi.due_date, bi.fine_amount,
              b.title AS book_title, b.isbn,
              s.full_name AS student_name, s.roll_number, s.phone, s.department,
              DATEDIFF(CURDATE(), bi.due_date) AS days_overdue,
              ROUND(DATEDIFF(CURDATE(), bi.due_date) * ?, 2) AS current_fine
       FROM book_issues bi
       JOIN books b ON bi.book_id = b.id
       JOIN students s ON bi.student_id = s.id
       WHERE bi.return_date IS NULL AND bi.due_date < ?
       ORDER BY bi.due_date ASC`,
      [FINE_RATE, today]
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('[GET OVERDUE ERROR]', error);
    return res.status(500).json({ success: false, message: 'Error fetching overdue records.' });
  }
}

module.exports = { getIssues, issueBook, returnBook, getOverdue };
