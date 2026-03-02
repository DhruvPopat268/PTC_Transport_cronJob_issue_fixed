CREATE TABLE IF NOT EXISTS cron_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_type VARCHAR(50) NOT NULL,
  status ENUM('Started', 'Completed', 'Failed') NOT NULL,
  vehicles_processed INT DEFAULT 0,
  vehicles_success INT DEFAULT 0,
  vehicles_failed INT DEFAULT 0,
  vehicles_invalid INT DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  INDEX idx_job_type (job_type),
  INDEX idx_status (status),
  INDEX idx_started_at (started_at)
);

CREATE TABLE IF NOT EXISTS vehicle_process_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cron_log_id INT,
  vehicle_id INT,
  registration_number VARCHAR(20),
  status ENUM('Success', 'Failed', 'Invalid') NOT NULL,
  error_message TEXT,
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cron_log_id) REFERENCES cron_logs(id) ON DELETE CASCADE,
  INDEX idx_cron_log_id (cron_log_id),
  INDEX idx_vehicle_id (vehicle_id),
  INDEX idx_status (status)
);
