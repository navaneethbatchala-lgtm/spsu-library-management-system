/**
 * Student Management Controller
 */

const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

// GET /api/students
async function getStudents(req, res) {
  try {
    const { search, department, status } = req.query;
    let sql = `
      SELECT s.id, s.roll_number, s.full_name, s.email, s.phone, s.department,
             s.semester, s.status, s.created_at,
             u.username,
             (SELECT COUNT(*) FROM book_issues bi WHERE bi.student_id = s.id AND bi.return_date IS NULL) AS active_loans
      FROM students s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ` AND (s.full_name LIKE ? OR s.roll_number LIKE ? OR s.email LIKE ?)`;
      const sv = `%${search}%`;
      params.push(sv, sv, sv);
    }
    if (department) {
      sql += ` AND s.department = ?`;
      params.push(department);
    }
    if (status) {
      sql += ` AND s.status = ?`;
      params.push(status);
    }
    sql += ` ORDER BY s.roll_number ASC`;

    const [students] = await pool.execute(sql, params);
    return res.json({ success: true, data: students });
  } catch (error) {
    console.error('[GET STUDENTS ERROR]', error);
    return res.status(500).json({ success: false, message: 'Error fetching students.' });
  }
}

// GET /api/students/:id
async function getStudentById(req, res) {
  try {
    const [rows] = await pool.execute(
      `SELECT s.*, u.username FROM students s LEFT JOIN users u ON s.user_id = u.id WHERE s.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Student not found.' });
    return res.json({ success: true, data: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error fetching student.' });
  }
}

// GET /api/students/:id/history - Borrowing history
async function getStudentHistory(req, res) {
  try {
    const [rows] = await pool.execute(
      `SELECT bi.id, bi.issue_date, bi.due_date, bi.return_date, bi.fine_amount, bi.status, bi.remarks,
              b.title AS book_title, b.author, b.isbn
       FROM book_issues bi
       JOIN books b ON bi.book_id = b.id
       WHERE bi.student_id = ?
       ORDER BY bi.created_at DESC`,
      [req.params.id]
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error fetching history.' });
  }
}

// POST /api/students - Register student
async function addStudent(req, res) {
  try {
    const { roll_number, full_name, email, phone, department, semester, createLogin, password } = req.body;

    if (!roll_number || !full_name || !email || !phone || !department || !semester) {
      return res.status(400).json({ success: false, message: 'All fields are required: Roll No, Name, Email, Phone, Department, Semester.' });
    }
    const sem = parseInt(semester);
    if (isNaN(sem) || sem < 1 || sem > 8) {
      return res.status(400).json({ success: false, message: 'Semester must be between 1 and 8.' });
    }

    // Check duplicates
    const [dupRoll] = await pool.execute('SELECT id FROM students WHERE roll_number = ?', [roll_number.trim()]);
    if (dupRoll.length > 0) return res.status(409).json({ success: false, message: `Roll number "${roll_number}" is already registered.` });

    const [dupEmail] = await pool.execute('SELECT id FROM students WHERE email = ?', [email.trim()]);
    if (dupEmail.length > 0) return res.status(409).json({ success: false, message: `Email "${email}" is already registered.` });

    let userId = null;

    // Create a login account if requested
    if (createLogin) {
      const username = roll_number.toLowerCase().trim();
      const pwd = password || 'Student@123';
      const hash = await bcrypt.hash(pwd, 10);

      const [userDup] = await pool.execute('SELECT id FROM users WHERE username = ?', [username]);
      if (userDup.length > 0) return res.status(409).json({ success: false, message: `Username "${username}" is already taken.` });

      const [userResult] = await pool.execute(
        `INSERT INTO users (username, email, password_hash, role, full_name) VALUES (?, ?, ?, 'student', ?)`,
        [username, email.trim(), hash, full_name.trim()]
      );
      userId = userResult.insertId;
    }

    const [result] = await pool.execute(
      `INSERT INTO students (user_id, roll_number, full_name, email, phone, department, semester) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, roll_number.trim(), full_name.trim(), email.trim(), phone.trim(), department.trim(), sem]
    );

    await pool.execute(
      `INSERT INTO activity_logs (user_id, action_type, details) VALUES (?, 'STUDENT_REGISTERED', ?)`,
      [req.session.user.id, `Registered student ${full_name.trim()} (Roll: ${roll_number.trim()})`]
    );

    return res.status(201).json({ success: true, message: 'Student registered successfully.', studentId: result.insertId });
  } catch (error) {
    console.error('[ADD STUDENT ERROR]', error);
    return res.status(500).json({ success: false, message: 'Error registering student.' });
  }
}

// PUT /api/students/:id - Update student
async function updateStudent(req, res) {
  try {
    const { full_name, email, phone, department, semester, status } = req.body;
    const id = req.params.id;

    const [current] = await pool.execute('SELECT * FROM students WHERE id = ?', [id]);
    if (current.length === 0) return res.status(404).json({ success: false, message: 'Student not found.' });

    const s = current[0];
    const sem = semester ? parseInt(semester) : s.semester;
    if (isNaN(sem) || sem < 1 || sem > 8) return res.status(400).json({ success: false, message: 'Semester must be between 1 and 8.' });

    await pool.execute(
      `UPDATE students SET full_name=?, email=?, phone=?, department=?, semester=?, status=? WHERE id=?`,
      [full_name || s.full_name, email || s.email, phone || s.phone,
       department || s.department, sem, status || s.status, id]
    );

    // Sync user full_name if linked
    if (s.user_id) {
      await pool.execute('UPDATE users SET full_name=? WHERE id=?', [full_name || s.full_name, s.user_id]);
    }

    return res.json({ success: true, message: 'Student updated successfully.' });
  } catch (error) {
    console.error('[UPDATE STUDENT ERROR]', error);
    return res.status(500).json({ success: false, message: 'Error updating student.' });
  }
}

// DELETE /api/students/:id
async function deleteStudent(req, res) {
  try {
    const [current] = await pool.execute('SELECT * FROM students WHERE id = ?', [req.params.id]);
    if (current.length === 0) return res.status(404).json({ success: false, message: 'Student not found.' });

    const student = current[0];
    const [activeLoans] = await pool.execute(
      `SELECT COUNT(*) AS count FROM book_issues WHERE student_id = ? AND return_date IS NULL`,
      [req.params.id]
    );
    if (activeLoans[0].count > 0) {
      return res.status(409).json({ success: false, message: `Cannot delete: ${student.full_name} has ${activeLoans[0].count} book(s) currently issued.` });
    }

    // Clean up historical returned records for this student before deletion
    await pool.execute('DELETE FROM book_issues WHERE student_id = ? AND return_date IS NOT NULL', [req.params.id]);

    if (student.user_id) {
      await pool.execute('DELETE FROM users WHERE id = ?', [student.user_id]);
    }
    await pool.execute('DELETE FROM students WHERE id = ?', [req.params.id]);

    await pool.execute(
      `INSERT INTO activity_logs (user_id, action_type, details) VALUES (?, 'STUDENT_DELETED', ?)`,
      [req.session.user.id, `Deleted student ${student.full_name} (Roll: ${student.roll_number})`]
    );

    return res.json({ success: true, message: `Student "${student.full_name}" has been removed.` });
  } catch (error) {
    console.error('[DELETE STUDENT ERROR]', error);
    return res.status(500).json({ success: false, message: 'Error deleting student.' });
  }
}

// GET /api/students/departments - Distinct departments
async function getDepartments(req, res) {
  try {
    const [rows] = await pool.execute('SELECT DISTINCT department FROM students ORDER BY department');
    return res.json({ success: true, data: rows.map(r => r.department) });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Error fetching departments.' });
  }
}

// GET /api/students/profile/me - Get logged-in student's own profile
async function getMyProfile(req, res) {
  try {
    const studentIdParam = req.query.studentId;

    // 0. If Administrator is previewing the student portal:
    if (req.session.user.role === 'admin') {
      if (studentIdParam) {
        const [chosen] = await pool.execute(
          `SELECT s.*, u.username, u.email AS user_email
           FROM students s
           LEFT JOIN users u ON s.user_id = u.id
           WHERE s.id = ?`,
          [studentIdParam]
        );
        if (chosen.length > 0) {
          return res.json({ success: true, data: chosen[0], isAdminPreview: true });
        }
      }

      const [demoStudent] = await pool.execute(
        `SELECT s.*, u.username, u.email AS user_email
         FROM students s
         LEFT JOIN users u ON s.user_id = u.id
         ORDER BY s.id ASC LIMIT 1`
      );
      if (demoStudent.length > 0) {
        return res.json({ success: true, data: demoStudent[0], isAdminPreview: true });
      }
    }

    // 1. Normal student: check by user_id
    const userId = req.session.user.id;
    const [rows] = await pool.execute(
      `SELECT s.*, u.username, u.email AS user_email
       FROM students s
       JOIN users u ON s.user_id = u.id
       WHERE s.user_id = ?`,
      [userId]
    );
    if (rows.length > 0) {
      return res.json({ success: true, data: rows[0] });
    }

    // 2. Fallback check by email or full_name matching session user
    const [fallback] = await pool.execute(
      `SELECT s.*, ? AS username FROM students s WHERE s.email = ? OR s.full_name = ? LIMIT 1`,
      [req.session.user.username, req.session.user.email, req.session.user.fullName]
    );
    if (fallback.length > 0) {
      return res.json({ success: true, data: fallback[0] });
    }

    // 3. Fallback: if student record doesn't exist, create a default profile for the user
    return res.json({
      success: true,
      data: {
        id: 0,
        roll_number: req.session.user.username.toUpperCase(),
        full_name: req.session.user.fullName,
        email: req.session.user.email,
        phone: 'Not provided',
        department: 'Engineering & Technology',
        semester: 1,
        status: 'active'
      }
    });
  } catch (error) {
    console.error('[GET MY PROFILE ERROR]', error);
    return res.status(500).json({ success: false, message: 'Error fetching student profile.' });
  }
}

// GET /api/students/profile/history - Get logged-in student's own borrowing history
async function getMyHistory(req, res) {
  try {
    const userId = req.session.user.id;
    const userEmail = req.session.user.email;
    const studentIdParam = req.query.studentId;

    let studentWhere = '(s.user_id = ? OR s.email = ?)';
    let params = [userId, userEmail];

    // If Administrator is previewing the student portal
    if (req.session.user.role === 'admin') {
      if (studentIdParam) {
        studentWhere = 's.id = ?';
        params = [studentIdParam];
      } else {
        const [demo] = await pool.execute('SELECT id FROM students ORDER BY id ASC LIMIT 1');
        if (demo.length > 0) {
          studentWhere = 's.id = ?';
          params = [demo[0].id];
        }
      }
    }

    const [rows] = await pool.execute(
      `SELECT bi.id, bi.issue_date, bi.due_date, bi.return_date, bi.fine_amount, bi.status, bi.remarks,
              b.title AS book_title, b.author, b.isbn, b.shelf_location
       FROM book_issues bi
       JOIN books b ON bi.book_id = b.id
       JOIN students s ON bi.student_id = s.id
       WHERE ${studentWhere}
       ORDER BY bi.created_at DESC`,
      params
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('[GET MY HISTORY ERROR]', error);
    return res.status(500).json({ success: false, message: 'Error fetching history.' });
  }
}

module.exports = {
  getStudents,
  getStudentById,
  getStudentHistory,
  addStudent,
  updateStudent,
  deleteStudent,
  getDepartments,
  getMyProfile,
  getMyHistory
};
