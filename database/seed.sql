-- ====================================================================
-- LIBRARY MANAGEMENT SYSTEM (LMS) - SEED DATA SCRIPT
-- Target Database: lms_db
-- Passwords: All hashed using bcryptjs (Salt rounds: 10)
-- Default Logins:
--   Admin:   username='admin'     | password='Admin@123'
--   Student: username='rahul101'  | password='Student@123'
--   Student: username='priya104'  | password='Student@123'
--   Student: username='aman112'   | password='Student@123'
-- ====================================================================

USE `lms_db`;

SET FOREIGN_KEY_CHECKS = 0;

-- Clean existing data for clean re-seeding
TRUNCATE TABLE `activity_logs`;
TRUNCATE TABLE `book_issues`;
TRUNCATE TABLE `books`;
TRUNCATE TABLE `students`;
TRUNCATE TABLE `categories`;
TRUNCATE TABLE `users`;

-- ====================================================================
-- 1. SEED: users
-- Passwords below are real bcrypt hashes:
--   'Admin@123'   -> $2a$10$Q7WupimtDAXy/uig6Xzrquz8amuA88btDkiG9fyARaj9Wi2vsFHZW
--   'Student@123' -> $2a$10$tR1O5kcI6ysd3IzDamali.Vm/T94xWc25peP6YiUCLirl7Aosjy4e
-- ====================================================================
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `role`, `full_name`) VALUES
(1, 'admin', 'admin@lms.local', '$2a$10$Q7WupimtDAXy/uig6Xzrquz8amuA88btDkiG9fyARaj9Wi2vsFHZW', 'admin', 'Chief Librarian Dr. Sharma'),
(2, 'rahul101', 'rahul.kumar@college.edu', '$2a$10$tR1O5kcI6ysd3IzDamali.Vm/T94xWc25peP6YiUCLirl7Aosjy4e', 'student', 'Rahul Kumar'),
(3, 'priya104', 'priya.sharma@college.edu', '$2a$10$tR1O5kcI6ysd3IzDamali.Vm/T94xWc25peP6YiUCLirl7Aosjy4e', 'student', 'Priya Sharma'),
(4, 'aman112', 'aman.singh@college.edu', '$2a$10$tR1O5kcI6ysd3IzDamali.Vm/T94xWc25peP6YiUCLirl7Aosjy4e', 'student', 'Aman Singh');

-- ====================================================================
-- 2. SEED: categories
-- ====================================================================
INSERT INTO `categories` (`id`, `name`, `description`) VALUES
(1, 'Computer Science & Engineering', 'Software engineering, algorithms, systems, web and AI'),
(2, 'Electronics & Communication', 'Digital electronics, signal processing, VLSI and communications'),
(3, 'Mechanical Engineering', 'Thermodynamics, mechanics, manufacturing and robotics'),
(4, 'Civil Engineering', 'Structural design, construction technology and mechanics'),
(5, 'Mathematics & Applied Sciences', 'Calculus, linear algebra, discrete math and applied physics'),
(6, 'Management & Humanities', 'Operations research, communication skills and ethics');

-- ====================================================================
-- 3. SEED: students
-- ====================================================================
INSERT INTO `students` (`id`, `user_id`, `roll_number`, `full_name`, `email`, `phone`, `department`, `semester`, `status`) VALUES
(1, 2, '22CS101', 'Rahul Kumar', 'rahul.kumar@college.edu', '9876543210', 'Computer Science & Engineering', 6, 'active'),
(2, 3, '22EC104', 'Priya Sharma', 'priya.sharma@college.edu', '9876543211', 'Electronics & Communication', 6, 'active'),
(3, 4, '23IT112', 'Aman Singh', 'aman.singh@college.edu', '9876543212', 'Information Technology', 4, 'active'),
(4, NULL, '23ME105', 'Sneha Patel', 'sneha.patel@college.edu', '9876543213', 'Mechanical Engineering', 4, 'active'),
(5, NULL, '24CS140', 'Vikram Verma', 'vikram.verma@college.edu', '9876543214', 'Computer Science & Engineering', 2, 'active');

-- ====================================================================
-- 4. SEED: books
-- Notice available_copies is accurately balanced against currently issued books!
-- ====================================================================
INSERT INTO `books` (`id`, `isbn`, `title`, `author`, `category_id`, `publisher`, `edition_year`, `total_copies`, `available_copies`, `shelf_location`) VALUES
(1, '978-0132350884', 'Clean Code: A Handbook of Agile Software Craftsmanship', 'Robert C. Martin', 1, 'Prentice Hall', 2008, 5, 4, 'Rack A-1'),
(2, '978-0262033848', 'Introduction to Algorithms (CLRS 3rd Ed)', 'Thomas H. Cormen, Charles E. Leiserson', 1, 'MIT Press', 2009, 4, 3, 'Rack A-2'),
(3, '978-0131103627', 'The C Programming Language (2nd Ed)', 'Brian W. Kernighan, Dennis M. Ritchie', 1, 'Prentice Hall', 1988, 6, 6, 'Rack A-3'),
(4, '978-0073529325', 'Database System Concepts (6th Ed)', 'Abraham Silberschatz, Henry F. Korth', 1, 'McGraw-Hill', 2010, 5, 4, 'Rack B-1'),
(5, '978-0131499263', 'Digital Design: Principles and Practices', 'John F. Wakerly', 2, 'Pearson', 2005, 3, 3, 'Rack C-1'),
(6, '978-0073398204', 'Engineering Mechanics: Statics & Dynamics', 'Ferdinand P. Beer, E. Russell Johnston', 3, 'McGraw-Hill', 2012, 4, 4, 'Rack D-1'),
(7, '978-0470458211', 'Advanced Engineering Mathematics (10th Ed)', 'Erwin Kreyszig', 5, 'Wiley', 2011, 5, 5, 'Rack E-1');

-- ====================================================================
-- 5. SEED: book_issues
-- Sample data includes:
--   - 1 active loan within due date
--   - 1 overdue loan with accrued fine
--   - 1 active loan near due date
--   - 1 successfully returned loan with paid fine
-- ====================================================================
INSERT INTO `book_issues` (`id`, `book_id`, `student_id`, `issued_by`, `issue_date`, `due_date`, `return_date`, `fine_amount`, `status`, `remarks`) VALUES
(1, 1, 1, 1, DATE_SUB(CURDATE(), INTERVAL 5 DAY), DATE_ADD(CURDATE(), INTERVAL 9 DAY), NULL, 0.00, 'ISSUED', 'Issued for semester project work'),
(2, 2, 2, 1, DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_SUB(CURDATE(), INTERVAL 6 DAY), NULL, 30.00, 'OVERDUE', 'Automated overdue alert sent'),
(3, 4, 3, 1, DATE_SUB(CURDATE(), INTERVAL 10 DAY), DATE_ADD(CURDATE(), INTERVAL 4 DAY), NULL, 0.00, 'ISSUED', 'Standard academic loan'),
(4, 3, 1, 1, DATE_SUB(CURDATE(), INTERVAL 30 DAY), DATE_SUB(CURDATE(), INTERVAL 16 DAY), DATE_SUB(CURDATE(), INTERVAL 14 DAY), 10.00, 'RETURNED', 'Returned with 2 days late fine paid in cash');

-- ====================================================================
-- 6. SEED: activity_logs
-- ====================================================================
INSERT INTO `activity_logs` (`id`, `user_id`, `action_type`, `details`, `ip_address`) VALUES
(1, 1, 'SYSTEM_INIT', 'Database initialized and schema verified successfully', '127.0.0.1'),
(2, 1, 'BOOK_ADDED', 'Acquired 5 copies of "Clean Code" (ISBN: 978-0132350884)', '127.0.0.1'),
(3, 1, 'STUDENT_REGISTERED', 'Registered student Rahul Kumar (Roll: 22CS101)', '127.0.0.1'),
(4, 1, 'BOOK_ISSUED', 'Issued "Clean Code" to Rahul Kumar (Roll: 22CS101)', '127.0.0.1'),
(5, 1, 'BOOK_ISSUED', 'Issued "Introduction to Algorithms" to Priya Sharma (Roll: 22EC104)', '127.0.0.1'),
(6, 1, 'BOOK_RETURNED', 'Returned "The C Programming Language" by Rahul Kumar', '127.0.0.1');

SET FOREIGN_KEY_CHECKS = 1;
