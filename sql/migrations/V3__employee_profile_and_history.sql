DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employee' AND column_name = 'birth_date'
    ) THEN
        ALTER TABLE employee ADD COLUMN birth_date DATE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employee' AND column_name = 'id_card_no'
    ) THEN
        ALTER TABLE employee ADD COLUMN id_card_no VARCHAR(30);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employee' AND column_name = 'employment_type'
    ) THEN
        ALTER TABLE employee ADD COLUMN employment_type VARCHAR(30);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employee' AND column_name = 'manager_employee_id'
    ) THEN
        ALTER TABLE employee ADD COLUMN manager_employee_id BIGINT;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS employee_profile (
    employee_id BIGINT PRIMARY KEY REFERENCES employee(employee_id) ON DELETE CASCADE,
    address VARCHAR(255),
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(30),
    education_level VARCHAR(50),
    marital_status VARCHAR(30),
    personal_email VARCHAR(100),
    notes VARCHAR(255),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employee_job_history (
    history_id BIGSERIAL PRIMARY KEY,
    employee_id BIGINT NOT NULL REFERENCES employee(employee_id) ON DELETE CASCADE,
    department_id BIGINT REFERENCES department(department_id),
    position_id BIGINT REFERENCES position(position_id),
    job_id BIGINT REFERENCES job(job_id),
    manager_employee_id BIGINT,
    start_date DATE NOT NULL,
    end_date DATE,
    change_reason VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_employee_manager ON employee(manager_employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_job_history_employee ON employee_job_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_job_history_active ON employee_job_history(employee_id, end_date);

INSERT INTO employee_profile (
    employee_id,
    address,
    emergency_contact_name,
    emergency_contact_phone,
    education_level,
    marital_status,
    personal_email,
    notes
)
SELECT
    e.employee_id,
    'Shanghai',
    'Emergency Contact',
    '13900000000',
    'Bachelor',
    'single',
    LOWER(e.employee_no) || '@personal.example.com',
    'Seed profile'
FROM employee e
WHERE NOT EXISTS (
    SELECT 1
    FROM employee_profile ep
    WHERE ep.employee_id = e.employee_id
);

INSERT INTO employee_job_history (
    employee_id,
    department_id,
    position_id,
    job_id,
    manager_employee_id,
    start_date,
    end_date,
    change_reason
)
SELECT
    e.employee_id,
    e.department_id,
    e.position_id,
    (SELECT p.job_id FROM position p WHERE p.position_id = e.position_id),
    e.manager_employee_id,
    e.hire_date,
    NULL,
    'initial_assignment'
FROM employee e
WHERE NOT EXISTS (
    SELECT 1
    FROM employee_job_history h
    WHERE h.employee_id = e.employee_id
      AND h.start_date = e.hire_date
      AND COALESCE(h.change_reason, '') = 'initial_assignment'
);
