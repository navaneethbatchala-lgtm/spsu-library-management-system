/**
 * Book Management Controller
 * CRUD, search, availability check
 */

const { pool } = require('../config/db');

// GET /api/books - List all books with optional search/filter
async function getBooks(req, res) {
  try {
    const { search, category, available } = req.query;
    let sql = `
      SELECT b.id, b.isbn, b.title, b.author, b.publisher, b.edition_year,
             b.total_copies, b.available_copies, b.shelf_location,
             c.name AS category_name, c.id AS category_id
      FROM books b
      JOIN categories c ON b.category_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ` AND (b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ? OR b.publisher LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    if (category) {
      sql += ` AND b.category_id = ?`;
      params.push(category);
    }
    if (available === 'true') {
      sql += ` AND b.available_copies > 0`;
    }

    sql += ` ORDER BY b.title ASC`;
    const [books] = await pool.execute(sql, params);
    return res.json({ success: true, data: books });
  } catch (error) {
    console.error('[GET BOOKS ERROR]', error);
    return res.status(500).json({ success: false, message: 'Error fetching books.' });
  }
}

// GET /api/books/:id - Get single book
async function getBookById(req, res) {
  try {
    const [rows] = await pool.execute(
      `SELECT b.*, c.name AS category_name FROM books b JOIN categories c ON b.category_id = c.id WHERE b.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Book not found.' });
    return res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('[GET BOOK BY ID ERROR]', error);
    return res.status(500).json({ success: false, message: 'Error fetching book.' });
  }
}

// POST /api/books - Add new book
async function addBook(req, res) {
  try {
    const { isbn, title, author, category_id, publisher, edition_year, total_copies, shelf_location } = req.body;

    if (!isbn || !title || !author || !category_id) {
      return res.status(400).json({ success: false, message: 'ISBN, Title, Author, and Category are required.' });
    }
    const copies = parseInt(total_copies) || 1;
    if (copies < 1) return res.status(400).json({ success: false, message: 'Total copies must be at least 1.' });

    // Check ISBN duplicate
    const [existing] = await pool.execute('SELECT id FROM books WHERE isbn = ?', [isbn.trim()]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: `A book with ISBN "${isbn}" already exists.` });
    }

    const [result] = await pool.execute(
      `INSERT INTO books (isbn, title, author, category_id, publisher, edition_year, total_copies, available_copies, shelf_location)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [isbn.trim(), title.trim(), author.trim(), category_id,
       publisher || null, edition_year || null, copies, copies,
       shelf_location || null]
    );

    // Log
    await pool.execute(
      `INSERT INTO activity_logs (user_id, action_type, details) VALUES (?, 'BOOK_ADDED', ?)`,
      [req.session.user.id, `Added book "${title.trim()}" (ISBN: ${isbn.trim()}, Copies: ${copies})`]
    );

    return res.status(201).json({ success: true, message: 'Book added successfully.', bookId: result.insertId });
  } catch (error) {
    console.error('[ADD BOOK ERROR]', error);
    return res.status(500).json({ success: false, message: 'Error adding book.' });
  }
}

// PUT /api/books/:id - Update book
async function updateBook(req, res) {
  try {
    const { isbn, title, author, category_id, publisher, edition_year, total_copies, shelf_location } = req.body;
    const bookId = req.params.id;

    const [current] = await pool.execute('SELECT * FROM books WHERE id = ?', [bookId]);
    if (current.length === 0) return res.status(404).json({ success: false, message: 'Book not found.' });

    const book = current[0];
    const newTotal = parseInt(total_copies) || book.total_copies;
    const issuedCount = book.total_copies - book.available_copies;
    if (newTotal < issuedCount) {
      return res.status(400).json({ success: false, message: `Cannot reduce copies to ${newTotal}. ${issuedCount} copies are currently issued.` });
    }
    const newAvailable = newTotal - issuedCount;

    // Check ISBN conflict with another book
    if (isbn && isbn.trim() !== book.isbn) {
      const [dup] = await pool.execute('SELECT id FROM books WHERE isbn = ? AND id != ?', [isbn.trim(), bookId]);
      if (dup.length > 0) return res.status(409).json({ success: false, message: 'Another book with this ISBN already exists.' });
    }

    await pool.execute(
      `UPDATE books SET isbn=?, title=?, author=?, category_id=?, publisher=?, edition_year=?, total_copies=?, available_copies=?, shelf_location=? WHERE id=?`,
      [isbn || book.isbn, title || book.title, author || book.author, category_id || book.category_id,
       publisher || book.publisher, edition_year || book.edition_year, newTotal, newAvailable,
       shelf_location || book.shelf_location, bookId]
    );

    await pool.execute(
      `INSERT INTO activity_logs (user_id, action_type, details) VALUES (?, 'BOOK_UPDATED', ?)`,
      [req.session.user.id, `Updated book "${title || book.title}" (ID: ${bookId})`]
    );

    return res.json({ success: true, message: 'Book updated successfully.' });
  } catch (error) {
    console.error('[UPDATE BOOK ERROR]', error);
    return res.status(500).json({ success: false, message: 'Error updating book.' });
  }
}

// DELETE /api/books/:id - Delete book
async function deleteBook(req, res) {
  try {
    const [current] = await pool.execute('SELECT * FROM books WHERE id = ?', [req.params.id]);
    if (current.length === 0) return res.status(404).json({ success: false, message: 'Book not found.' });

    const book = current[0];
    // Check active issues
    const [activeIssues] = await pool.execute(
      `SELECT COUNT(*) AS count FROM book_issues WHERE book_id = ? AND status = 'ISSUED'`,
      [req.params.id]
    );
    if (activeIssues[0].count > 0) {
      return res.status(409).json({ success: false, message: `Cannot delete: ${activeIssues[0].count} copy/copies of this book are currently issued to students.` });
    }

    // Clean up any historical returned borrowing records for this book before deletion
    await pool.execute('DELETE FROM book_issues WHERE book_id = ? AND status = "RETURNED"', [req.params.id]);
    await pool.execute('DELETE FROM books WHERE id = ?', [req.params.id]);
    await pool.execute(
      `INSERT INTO activity_logs (user_id, action_type, details) VALUES (?, 'BOOK_DELETED', ?)`,
      [req.session.user.id, `Deleted book "${book.title}" (ISBN: ${book.isbn})`]
    );

    return res.json({ success: true, message: `"${book.title}" has been removed from the library.` });
  } catch (error) {
    console.error('[DELETE BOOK ERROR]', error);
    return res.status(500).json({ success: false, message: 'Error deleting book.' });
  }
}

// GET /api/books/search/availability - Quick availability check
async function checkAvailability(req, res) {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ success: false, message: 'Search query is required.' });

    const [books] = await pool.execute(
      `SELECT b.id, b.isbn, b.title, b.author, b.total_copies, b.available_copies,
              b.shelf_location, c.name AS category_name
       FROM books b JOIN categories c ON b.category_id = c.id
       WHERE b.title LIKE ? OR b.isbn LIKE ? OR b.author LIKE ?
       ORDER BY b.title LIMIT 20`,
      [`%${q}%`, `%${q}%`, `%${q}%`]
    );

    return res.json({ success: true, data: books });
  } catch (error) {
    console.error('[CHECK AVAILABILITY ERROR]', error);
    return res.status(500).json({ success: false, message: 'Error checking availability.' });
  }
}

// GET /api/books/categories - All categories
async function getCategories(req, res) {
  try {
    const [cats] = await pool.execute('SELECT * FROM categories ORDER BY name');
    return res.json({ success: true, data: cats });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error fetching categories.' });
  }
}

// POST /api/books/categories - Add category
async function addCategory(req, res) {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Category name is required.' });
    const [result] = await pool.execute('INSERT INTO categories (name, description) VALUES (?, ?)', [name.trim(), description || null]);
    return res.status(201).json({ success: true, message: 'Category added.', id: result.insertId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Category already exists.' });
    return res.status(500).json({ success: false, message: 'Error adding category.' });
  }
}

module.exports = { getBooks, getBookById, addBook, updateBook, deleteBook, checkAvailability, getCategories, addCategory };
