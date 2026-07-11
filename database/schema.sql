CREATE DATABASE IF NOT EXISTS demenscan
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE demenscan;

CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(150) NOT NULL,
  role ENUM('admin', 'super_admin') NOT NULL DEFAULT 'admin',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assessment_submissions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  submission_code VARCHAR(40) NOT NULL UNIQUE,
  total_score INT NOT NULL,
  max_score INT NOT NULL DEFAULT 97,
  risk_level ENUM('low', 'moderate', 'high') NOT NULL,
  section4_score INT NOT NULL DEFAULT 0,
  section5_score INT NOT NULL DEFAULT 0,
  section6_score INT NOT NULL DEFAULT 0,
  age INT NULL,
  gender VARCHAR(50) NULL,
  education VARCHAR(150) NULL,
  marital_status VARCHAR(100) NULL,
  monthly_income VARCHAR(100) NULL,
  family_dementia_history VARCHAR(50) NULL,
  sleep_time TIME NULL,
  wake_time TIME NULL,
  smoking VARCHAR(100) NULL,
  alcohol VARCHAR(100) NULL,
  exercise_frequency VARCHAR(100) NULL,
  diseases JSON NULL,
  feedback_json JSON NULL,
  user_agent TEXT NULL,
  ip_address VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created_at (created_at),
  INDEX idx_risk_level (risk_level),
  INDEX idx_total_score (total_score),
  INDEX idx_age (age)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assessment_answers (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  submission_id BIGINT NOT NULL,
  section_id INT NOT NULL,
  question_id VARCHAR(30) NOT NULL,
  question_text TEXT NOT NULL,
  answer_value JSON NULL,
  score INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES assessment_submissions(id) ON DELETE CASCADE,
  INDEX idx_submission_id (submission_id),
  INDEX idx_question_id (question_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

