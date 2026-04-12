CREATE TABLE IF NOT EXISTS location (
    location_id BIGSERIAL PRIMARY KEY,
    location_code VARCHAR(30) NOT NULL UNIQUE,
    location_name VARCHAR(100) NOT NULL,
    country_code VARCHAR(10),
    city VARCHAR(50),
    address_line VARCHAR(255),
    status SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'department' AND column_name = 'department_code'
    ) THEN
        ALTER TABLE department ADD COLUMN department_code VARCHAR(30);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'department' AND column_name = 'location_id'
    ) THEN
        ALTER TABLE department ADD COLUMN location_id BIGINT REFERENCES location(location_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'department' AND column_name = 'manager_employee_id'
    ) THEN
        ALTER TABLE department ADD COLUMN manager_employee_id BIGINT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'department' AND column_name = 'description'
    ) THEN
        ALTER TABLE department ADD COLUMN description VARCHAR(255);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uk_department_department_code'
    ) THEN
        ALTER TABLE department
            ADD CONSTRAINT uk_department_department_code UNIQUE (department_code);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS job (
    job_id BIGSERIAL PRIMARY KEY,
    job_code VARCHAR(30) NOT NULL UNIQUE,
    job_title VARCHAR(100) NOT NULL,
    job_grade VARCHAR(30),
    min_salary NUMERIC(12,2),
    max_salary NUMERIC(12,2),
    description VARCHAR(255)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'position' AND column_name = 'position_code'
    ) THEN
        ALTER TABLE position ADD COLUMN position_code VARCHAR(30);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'position' AND column_name = 'job_id'
    ) THEN
        ALTER TABLE position ADD COLUMN job_id BIGINT REFERENCES job(job_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'position' AND column_name = 'department_id'
    ) THEN
        ALTER TABLE position ADD COLUMN department_id BIGINT REFERENCES department(department_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'position' AND column_name = 'headcount'
    ) THEN
        ALTER TABLE position ADD COLUMN headcount INTEGER NOT NULL DEFAULT 1;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'position' AND column_name = 'status'
    ) THEN
        ALTER TABLE position ADD COLUMN status SMALLINT NOT NULL DEFAULT 1;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uk_position_position_code'
    ) THEN
        ALTER TABLE position
            ADD CONSTRAINT uk_position_position_code UNIQUE (position_code);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_department_location ON department(location_id);
CREATE INDEX IF NOT EXISTS idx_position_job ON position(job_id);
CREATE INDEX IF NOT EXISTS idx_position_department ON position(department_id);

INSERT INTO location (location_code, location_name, country_code, city, address_line)
SELECT 'CN-SH-HQ', 'Shanghai Headquarters', 'CN', 'Shanghai', 'Pudong New Area'
WHERE NOT EXISTS (SELECT 1 FROM location WHERE location_code = 'CN-SH-HQ');

INSERT INTO location (location_code, location_name, country_code, city, address_line)
SELECT 'CN-SZ-BR', 'Shenzhen Branch', 'CN', 'Shenzhen', 'Nanshan District'
WHERE NOT EXISTS (SELECT 1 FROM location WHERE location_code = 'CN-SZ-BR');

UPDATE department
SET department_code = 'D001',
    location_id = (SELECT location_id FROM location WHERE location_code = 'CN-SH-HQ'),
    description = COALESCE(description, 'Core engineering department')
WHERE department_name = '研发部'
  AND (department_code IS NULL OR department_code = '');

UPDATE department
SET department_code = 'D002',
    location_id = (SELECT location_id FROM location WHERE location_code = 'CN-SH-HQ'),
    description = COALESCE(description, 'Human resources department')
WHERE department_name = '人事部'
  AND (department_code IS NULL OR department_code = '');

UPDATE department
SET department_code = 'D003',
    location_id = (SELECT location_id FROM location WHERE location_code = 'CN-SZ-BR'),
    description = COALESCE(description, 'Marketing department')
WHERE department_name = '市场部'
  AND (department_code IS NULL OR department_code = '');

INSERT INTO job (job_code, job_title, job_grade, min_salary, max_salary, description)
SELECT 'JOB-BE', 'Backend Engineer', 'P2', 15000, 28000, 'Backend engineering job family'
WHERE NOT EXISTS (SELECT 1 FROM job WHERE job_code = 'JOB-BE');

INSERT INTO job (job_code, job_title, job_grade, min_salary, max_salary, description)
SELECT 'JOB-HR', 'HR Specialist', 'P1', 8000, 16000, 'Human resources job family'
WHERE NOT EXISTS (SELECT 1 FROM job WHERE job_code = 'JOB-HR');

INSERT INTO job (job_code, job_title, job_grade, min_salary, max_salary, description)
SELECT 'JOB-MKT', 'Marketing Specialist', 'P1', 8000, 16000, 'Marketing job family'
WHERE NOT EXISTS (SELECT 1 FROM job WHERE job_code = 'JOB-MKT');

UPDATE position
SET position_code = 'POS-BE-001',
    job_id = (SELECT job_id FROM job WHERE job_code = 'JOB-BE'),
    department_id = (SELECT department_id FROM department WHERE department_name = '研发部')
WHERE position_name = '后端开发工程师'
  AND (position_code IS NULL OR position_code = '');

UPDATE position
SET position_code = 'POS-HR-001',
    job_id = (SELECT job_id FROM job WHERE job_code = 'JOB-HR'),
    department_id = (SELECT department_id FROM department WHERE department_name = '人事部')
WHERE position_name = 'HR专员'
  AND (position_code IS NULL OR position_code = '');

UPDATE position
SET position_code = 'POS-MKT-001',
    job_id = (SELECT job_id FROM job WHERE job_code = 'JOB-MKT'),
    department_id = (SELECT department_id FROM department WHERE department_name = '市场部')
WHERE position_name = '市场专员'
  AND (position_code IS NULL OR position_code = '');
