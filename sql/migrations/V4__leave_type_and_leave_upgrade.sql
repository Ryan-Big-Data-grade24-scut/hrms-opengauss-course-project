CREATE TABLE IF NOT EXISTS leave_type (
    leave_type_id BIGSERIAL PRIMARY KEY,
    leave_code VARCHAR(30) NOT NULL UNIQUE,
    leave_name VARCHAR(50) NOT NULL,
    requires_approval SMALLINT NOT NULL DEFAULT 1,
    status SMALLINT NOT NULL DEFAULT 1
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leave_request' AND column_name = 'leave_type_id'
    ) THEN
        ALTER TABLE leave_request ADD COLUMN leave_type_id BIGINT REFERENCES leave_type(leave_type_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leave_request' AND column_name = 'approver_user_id'
    ) THEN
        ALTER TABLE leave_request ADD COLUMN approver_user_id BIGINT REFERENCES sys_user(user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leave_request' AND column_name = 'approved_at'
    ) THEN
        ALTER TABLE leave_request ADD COLUMN approved_at TIMESTAMP;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leave_request' AND column_name = 'approval_comment'
    ) THEN
        ALTER TABLE leave_request ADD COLUMN approval_comment VARCHAR(255);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leave_type_id ON leave_request(leave_type_id);
CREATE INDEX IF NOT EXISTS idx_leave_approver_user ON leave_request(approver_user_id);

INSERT INTO leave_type (leave_code, leave_name, requires_approval, status)
SELECT 'annual', 'Annual Leave', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM leave_type WHERE leave_code = 'annual');

INSERT INTO leave_type (leave_code, leave_name, requires_approval, status)
SELECT 'sick', 'Sick Leave', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM leave_type WHERE leave_code = 'sick');

INSERT INTO leave_type (leave_code, leave_name, requires_approval, status)
SELECT 'personal', 'Personal Leave', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM leave_type WHERE leave_code = 'personal');

UPDATE leave_request lr
SET leave_type_id = lt.leave_type_id
FROM leave_type lt
WHERE lr.leave_type = lt.leave_code
  AND lr.leave_type_id IS NULL;

UPDATE leave_request
SET approver_user_id = (
        SELECT user_id FROM sys_user WHERE username = 'hr01'
    ),
    approved_at = CURRENT_TIMESTAMP
WHERE approval_status = 'approved'
  AND approver_user_id IS NULL;
