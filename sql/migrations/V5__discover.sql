-- V5: Skills intelligence + ML + Vector + Graph
-- Requires openGauss 7.0+ (DB4AI, DataVec, Apache AGE)

-- ========== 1. New columns on employee ==========
ALTER TABLE employee ADD COLUMN IF NOT EXISTS tenure INTEGER DEFAULT 0;
ALTER TABLE employee ADD COLUMN IF NOT EXISTS engagement_score SMALLINT DEFAULT 75;
ALTER TABLE employee ADD COLUMN IF NOT EXISTS last_promotion_months INTEGER DEFAULT 12;
ALTER TABLE employee ADD COLUMN IF NOT EXISTS manager_changes INTEGER DEFAULT 0;
ALTER TABLE employee ADD COLUMN IF NOT EXISTS overtime_count INTEGER DEFAULT 0;
ALTER TABLE employee ADD COLUMN IF NOT EXISTS attrition_flag SMALLINT DEFAULT 0;
-- skill_profile vector(300) added later via DataVec extension

-- ========== 2. Skill system ==========
CREATE TABLE IF NOT EXISTS skill_category (
    category_id       BIGSERIAL PRIMARY KEY,
    category_name     VARCHAR(100) NOT NULL UNIQUE,
    parent_category_id BIGINT REFERENCES skill_category(category_id),
    description       VARCHAR(255),
    sort_order        INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS skill (
    skill_id       BIGSERIAL PRIMARY KEY,
    skill_name     VARCHAR(100) NOT NULL UNIQUE,
    category_id    BIGINT NOT NULL REFERENCES skill_category(category_id),
    description    VARCHAR(255),
    skill_group_id BIGINT REFERENCES skill(skill_id),
    status         SMALLINT DEFAULT 1
);

CREATE TABLE IF NOT EXISTS employee_skill (
    employee_skill_id BIGSERIAL PRIMARY KEY,
    employee_id       BIGINT NOT NULL REFERENCES employee(employee_id) ON DELETE CASCADE,
    skill_id          BIGINT NOT NULL REFERENCES skill(skill_id),
    proficiency_level SMALLINT NOT NULL DEFAULT 0 CHECK (proficiency_level BETWEEN 0 AND 5),
    acquired_from     VARCHAR(30) DEFAULT 'self',
    is_core           BOOLEAN DEFAULT false,
    acquired_date     DATE,
    last_used_date    DATE,
    is_inferred       BOOLEAN DEFAULT false,
    confirmed_by      BIGINT REFERENCES sys_user(user_id),
    confirmed_at      TIMESTAMP,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (employee_id, skill_id, acquired_from)
);

CREATE TABLE IF NOT EXISTS position_required_skill (
    position_skill_id BIGSERIAL PRIMARY KEY,
    position_id       BIGINT NOT NULL REFERENCES position(position_id) ON DELETE CASCADE,
    skill_id          BIGINT NOT NULL REFERENCES skill(skill_id),
    required_level    SMALLINT NOT NULL CHECK (required_level BETWEEN 1 AND 5),
    importance_weight SMALLINT NOT NULL DEFAULT 2 CHECK (importance_weight BETWEEN 1 AND 3),
    UNIQUE (position_id, skill_id)
);

CREATE TABLE IF NOT EXISTS employee_project (
    project_id    BIGSERIAL PRIMARY KEY,
    project_name  VARCHAR(200) NOT NULL,
    employee_id   BIGINT NOT NULL REFERENCES employee(employee_id) ON DELETE CASCADE,
    role          VARCHAR(100),
    start_date    DATE,
    end_date      DATE,
    description   TEXT,
    UNIQUE (employee_id, project_name)
);

CREATE TABLE IF NOT EXISTS project_tech_stack (
    pts_id     BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES employee_project(project_id) ON DELETE CASCADE,
    skill_id   BIGINT NOT NULL REFERENCES skill(skill_id),
    UNIQUE (project_id, skill_id)
);

-- ========== 3. Indexes ==========
CREATE INDEX IF NOT EXISTS idx_es_employee   ON employee_skill(employee_id);
CREATE INDEX IF NOT EXISTS idx_es_skill      ON employee_skill(skill_id);
CREATE INDEX IF NOT EXISTS idx_es_emp_level  ON employee_skill(employee_id, proficiency_level);
CREATE INDEX IF NOT EXISTS idx_prs_position  ON position_required_skill(position_id);
CREATE INDEX IF NOT EXISTS idx_ep_employee   ON employee_project(employee_id);
CREATE INDEX IF NOT EXISTS idx_pts_project   ON project_tech_stack(project_id);
CREATE INDEX IF NOT EXISTS idx_skill_group   ON skill(skill_group_id);

-- ========== 4. Seed data: skill categories ==========
INSERT INTO skill_category (category_id, category_name, description, sort_order) VALUES
(1, 'Programming',  'Programming languages and coding', 1),
(2, 'Database',     'Database design and management', 2),
(3, 'Framework',    'Development frameworks and tools', 3),
(4, 'Management',   'Management and leadership skills', 4),
(5, 'DataScience',  'Data science and analytics', 5),
(6, 'DevOps',       'Infrastructure and deployment', 6);

-- ========== 5. Seed data: skills ==========
INSERT INTO skill (skill_id, skill_name, category_id, description, skill_group_id) VALUES
(1,  'Python',      1, 'Python programming language', 2),
(2,  'Java',        1, 'Java programming language', 1),
(3,  'SQL',         2, 'SQL query language', NULL),
(4,  'openGauss',   2, 'openGauss database management', NULL),
(5,  'PostgreSQL',  2, 'PostgreSQL database', 4),
(6,  'Vue.js',      3, 'Vue.js frontend framework', NULL),
(7,  'Flask',       3, 'Flask Python web framework', NULL),
(8,  'Docker',      6, 'Docker containerization', NULL),
(9,  'ProjectMgmt', 4, 'Project management', NULL),
(10, 'TeamMgmt',    4, 'Team management and leadership', 9),
(11, 'DataAnalysis',5, 'Data analysis and visualization', NULL),
(12, 'ETL',         5, 'ETL data pipeline development', 11),
(13, 'Linux',       6, 'Linux system administration', NULL),
(14, 'Redis',       3, 'Redis caching system', NULL),
(15, 'Git',         6, 'Git version control', NULL),
(16, 'Go',          1, 'Go programming language', 2),
(17, 'Kubernetes',  6, 'Kubernetes orchestration', 8),
(18, 'MachineLearning',5, 'Machine learning and AI', NULL),
(19, 'React',       3, 'React frontend framework', 6),
(20, 'CPlusPlus',   1, 'C++ programming language', 2);

-- ========== 6. Seed data: position skill requirements ==========
-- Positions: 1=Backend, 2=HR, 3=Marketing, 4=Fullstack, 5=DataAnalyst, 6=DevOps
INSERT INTO position_required_skill (position_id, skill_id, required_level, importance_weight) VALUES
-- Backend Engineer
(1, 1, 4, 3), (1, 3, 4, 3), (1, 4, 3, 2), (1, 7, 3, 2), (1, 15, 3, 2), (1, 8, 2, 1),
-- HR Specialist
(2, 9, 4, 3), (2, 10, 3, 3), (2, 11, 2, 2), (2, 4, 1, 1),
-- Marketing
(3, 11, 3, 3), (3, 9, 3, 2), (3, 6, 2, 1), (3, 4, 1, 1),
-- Fullstack Engineer
(4, 1, 3, 3), (4, 6, 4, 3), (4, 3, 3, 2), (4, 8, 2, 1), (4, 15, 3, 2),
-- Data Analyst
(5, 1, 3, 3), (5, 3, 4, 3), (5, 11, 4, 3), (5, 12, 3, 2), (5, 4, 2, 1),
-- DevOps Engineer
(6, 8, 4, 3), (6, 13, 4, 3), (6, 15, 3, 2), (6, 7, 2, 1), (6, 4, 2, 1);

-- ========== 7. Seed data: employee skills (15 employees) ==========
-- Use DO block for dynamic employee ID lookup
DO $$
DECLARE
    eid BIGINT;
BEGIN
    -- Chen Chen (E2026001) - senior backend
    SELECT employee_id INTO eid FROM employee WHERE employee_no = 'E2026001';
    UPDATE employee SET tenure=5, engagement_score=92, last_promotion_months=3, manager_changes=0, overtime_count=2 WHERE employee_id=eid;
    INSERT INTO employee_skill (employee_id,skill_id,proficiency_level,acquired_from,is_core,confirmed_by) VALUES
    (eid,1,5,'project',true,1),(eid,3,4,'project',true,1),(eid,4,4,'project',true,1),
    (eid,7,3,'self',false,1),(eid,15,3,'project',false,1),(eid,8,2,'training',false,1),(eid,13,3,'self',false,1);

    -- Lin Yu (E2026002) - HR
    SELECT employee_id INTO eid FROM employee WHERE employee_no = 'E2026002';
    UPDATE employee SET tenure=4, engagement_score=88, last_promotion_months=8, manager_changes=0, overtime_count=1 WHERE employee_id=eid;
    INSERT INTO employee_skill (employee_id,skill_id,proficiency_level,acquired_from,is_core,confirmed_by) VALUES
    (eid,9,4,'project',true,1),(eid,10,4,'project',true,1),(eid,11,2,'training',false,1),(eid,4,1,'training',false,1);

    -- Xiao Congming (E2026889) - marketing
    SELECT employee_id INTO eid FROM employee WHERE employee_no = 'E2026889';
    UPDATE employee SET tenure=2, engagement_score=65, last_promotion_months=24, manager_changes=2, overtime_count=5 WHERE employee_id=eid;
    INSERT INTO employee_skill (employee_id,skill_id,proficiency_level,acquired_from,is_core,confirmed_by) VALUES
    (eid,11,3,'project',true,1),(eid,9,3,'project',false,1),(eid,6,2,'self',false,1),(eid,1,2,'training',false,1),(eid,3,2,'project',false,1);

    -- Zhang Wei - fullstack
    SELECT employee_id INTO eid FROM employee WHERE employee_no = 'E2026004';
    UPDATE employee SET tenure=3, engagement_score=85, last_promotion_months=6, manager_changes=0, overtime_count=3 WHERE employee_id=eid;
    IF FOUND THEN
        INSERT INTO employee_skill (employee_id,skill_id,proficiency_level,acquired_from,is_core) VALUES
        (eid,1,4,'project',true),(eid,6,4,'project',true),(eid,3,3,'project',false),
        (eid,7,3,'project',false),(eid,15,3,'project',false),(eid,14,2,'self',false);
    END IF;

    -- More employees...
    FOR i IN 10..30 LOOP
        INSERT INTO employee (employee_no, full_name, gender, phone, email, hire_date, employment_status, department_id, position_id, tenure, engagement_score, last_promotion_months, manager_changes, overtime_count)
        VALUES (
            'E2026' || LPAD((40+i)::text, 4, '0'),
            CASE i%10 WHEN 0 THEN 'Wang Lei' WHEN 1 THEN 'Liu Fang' WHEN 2 THEN 'Huang Tao' WHEN 3 THEN 'Zhou Jie' WHEN 4 THEN 'Wu Xin' WHEN 5 THEN 'Sun Li' WHEN 6 THEN 'Ma Chao' WHEN 7 THEN 'Hu Bin' WHEN 8 THEN 'Zheng Hui' ELSE 'He Feng' END || ' ' || i,
            CASE WHEN i%2=0 THEN 'M' ELSE 'F' END,
            '1380000' || LPAD(i::text,4,'0'),
            'emp' || i || '@example.com',
            DATE '2025-01-01' + (i * 15),
            CASE WHEN i%5=0 THEN 'resigned' ELSE 'active' END,
            (i%3)+1,
            (i%6)+1,
            (i%2)+1,
            60 + (i*2),
            CASE WHEN i%3=0 THEN 12 ELSE 3 END,
            CASE WHEN i%4=0 THEN 2 ELSE 0 END,
            CASE WHEN i%5=0 THEN 8 ELSE 2 END
        );

        -- Add random skills
        INSERT INTO employee_skill (employee_id, skill_id, proficiency_level, acquired_from, is_core)
        SELECT currval('employee_employee_id_seq'), s.skill_id, 1+(i%5), 'project', false
        FROM skill s WHERE s.skill_id IN (
            SELECT skill_id FROM skill ORDER BY random() LIMIT 1+(i%4)
        );
    END LOOP;
END $$;

-- Mark some as attrition examples
UPDATE employee SET attrition_flag = 1 WHERE employment_status = 'resigned';
