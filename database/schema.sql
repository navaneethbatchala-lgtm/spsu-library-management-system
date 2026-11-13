-- ====================================================================
-- LIBRARY MANAGEMENT SYSTEM (LMS) - RELATIONAL DATABASE SCHEMA
-- Target Database: MySQL 8.0+
-- Database Name: lms_db
-- Character Set: utf8mb4 | Collation: utf8mb4_unicode_ci
-- ====================================================================

-- 1. Create and switch to lms_db database safely
CREATE DATABASE IF NOT EXISTS `lms_db`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `lms_db`;

-- Disable foreign key checks during schema definitions for safe ordering
SET FOREIGN_KEY_CHECKS = 0;

-- ====================================================================
-- 2. TABLE: users
-- Purpose: Authentication, credentials and role-based access control.
-- Passwords must ALWAYS be stored as bcrypt hashes, never plaintext.
-- ====================================================================
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL,
  `email` VARCHAR(100) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'student') NOT NULL DEFAULT 'student',
  `full_name` VARCHAR(100) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `uk_users_username` UNIQUE (`username`),
  CONSTRAINT `uk_users_email` UNIQUE (`email`),
  INDEX `idx_users_role` (`role`),
  INDEX `idx_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- 3. TABLE: categories
-- Purpose: Academic subject categorization for library books.
-- ====================================================================
DROP TABLE IF EXISTS `categories`;
CREATE TABLE `categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `uk_categories_name` UNIQUE (`name`),
  INDEX `idx_categories_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- 4. TABLE: students
-- Purpose: Student directory with academic roll number and profile info.
-- Can link to a user account for student self-service portal.
-- ====================================================================
DROP TABLE IF EXISTS `students`;
CREATE TABLE `students` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT DEFAULT NULL,
  `roll_number` VARCHAR(30) NOT NULL,
  `full_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(15) NOT NULL,
  `department` VARCHAR(100) NOT NULL,
  `semester` TINYINT NOT NULL,
  `status` ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `uk_students_roll` UNIQUE (`roll_number`),
  CONSTRAINT `uk_students_email` UNIQUE (`email`),
  CONSTRAINT `uk_students_user_id` UNIQUE (`user_id`),
  CONSTRAINT `chk_students_semester` CHECK (`semester` BETWEEN 1 AND 8),
  CONSTRAINT `fk_students_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_students_roll` (`roll_number`),
  INDEX `idx_students_department` (`department`),
  INDEX `idx_students_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- 5. TABLE: books
-- Purpose: Complete catalog of library books, ISBN, and live stock tracking.
-- ====================================================================
DROP TABLE IF EXISTS `books`;
CREATE TABLE `books` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `isbn` VARCHAR(20) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `author` VARCHAR(200) NOT NULL,
  `category_id` INT NOT NULL,
  `publisher` VARCHAR(150) DEFAULT NULL,
  `edition_year` SMALLINT DEFAULT NULL,
  `total_copies` INT NOT NULL DEFAULT 1,
  `available_copies` INT NOT NULL DEFAULT 1,
  `shelf_location` VARCHAR(50) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `uk_books_isbn` UNIQUE (`isbn`),
  CONSTRAINT `chk_books_total_copies` CHECK (`total_copies` >= 0),
  CONSTRAINT `chk_books_available_copies` CHECK (`available_copies` >= 0 AND `available_copies` <= `total_copies`),
  CONSTRAINT `fk_books_category` FOREIGN KEY (`category_id`)
    REFERENCES `categories` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_books_isbn` (`isbn`),
  INDEX `idx_books_title` (`title`),
  INDEX `idx_books_author` (`author`),
  INDEX `idx_books_category` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- 6. TABLE: book_issues
-- Purpose: Lending transactions, due dates, return timestamps & fines.
-- ====================================================================
DROP TABLE IF EXISTS `book_issues`;
CREATE TABLE `book_issues` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `book_id` INT NOT NULL,
  `student_id` INT NOT NULL,
  `issued_by` INT DEFAULT NULL,
  `issue_date` DATE NOT NULL,
  `due_date` DATE NOT NULL,
  `return_date` DATE DEFAULT NULL,
  `fine_amount` DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
  `status` ENUM('ISSUED', 'RETURNED', 'OVERDUE') NOT NULL DEFAULT 'ISSUED',
  `remarks` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `chk_issues_fine` CHECK (`fine_amount` >= 0.00),
  CONSTRAINT `chk_issues_dates` CHECK (`due_date` >= `issue_date`),
  CONSTRAINT `fk_issues_book` FOREIGN KEY (`book_id`)
    REFERENCES `books` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_issues_student` FOREIGN KEY (`student_id`)
    REFERENCES `students` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_issues_admin` FOREIGN KEY (`issued_by`)
    REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_issues_status` (`status`),
  INDEX `idx_issues_due_date` (`due_date`),
  INDEX `idx_issues_book_id` (`book_id`),
  INDEX `idx_issues_student_id` (`student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- 7. TABLE: activity_logs
-- Purpose: Complete audit trail and live dashboard activity feed.
-- ====================================================================
DROP TABLE IF EXISTS `activity_logs`;
CREATE TABLE `activity_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT DEFAULT NULL,
  `action_type` VARCHAR(50) NOT NULL,
  `details` TEXT NOT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_logs_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_logs_action_type` (`action_type`),
  INDEX `idx_logs_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- 8. TABLE: sessions (MySQL-backed session store for express-session)
-- Purpose: Persists login sessions across server restarts safely in MySQL.
-- Compatible with express-mysql-session.
-- ====================================================================
DROP TABLE IF EXISTS `sessions`;
CREATE TABLE `sessions` (
  `session_id` VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
  `expires` INT UNSIGNED NOT NULL,
  `data` MEDIUMTEXT COLLATE utf8mb4_bin,
  PRIMARY KEY (`session_id`),
  INDEX `idx_sessions_expires` (`expires`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
