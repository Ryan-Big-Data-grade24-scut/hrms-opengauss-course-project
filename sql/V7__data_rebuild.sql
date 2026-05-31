-- ====================================================================
-- V7: COMPLETE DATA REBUILD
-- Layer 0: Raw Data Construction
--
-- DESTRUCTIVE: Truncates all seed data and re-inserts from scratch.
-- Runs AFTER all V1-V8 schema migrations have created the tables.
--
-- Sequence of operations:
--   1. Truncate all data-bearing tables (FK-safe order)
--   2. Reset all BIGSERIAL sequences to 1
--   3. Insert reference data (role, permission, location, leave_type, job)
--   4. Insert org data (department, position)
--   5. Insert skill system (skill_category, skill)
--   6. Insert employees with explicit FK references
--   7. Insert employee profiles and job history
--   8. Insert position skill requirements and employee skills
--   9. Insert sys_user accounts and role-permission mappings
--  10. Insert attendance_record (May 2026)
--  11. Insert performance_review (2026-Q1)
--  12. Insert attrition_history trend data (6 months)
--  13. Advance all sequences past max used IDs
-- ====================================================================

BEGIN;

-- ====================================================================
-- 1. TRUNCATE ALL DATA TABLES (leaf-to-root, CASCADE for safety)
-- ====================================================================

-- Truncate leaf tables first (no dependents)
TRUNCATE TABLE attrition_history CASCADE;
TRUNCATE TABLE attendance_record CASCADE;
TRUNCATE TABLE performance_review CASCADE;
TRUNCATE TABLE project_tech_stack CASCADE;
TRUNCATE TABLE employee_project CASCADE;
TRUNCATE TABLE employee_skill CASCADE;
TRUNCATE TABLE position_required_skill CASCADE;
TRUNCATE TABLE employee_job_history CASCADE;
TRUNCATE TABLE employee_profile CASCADE;

-- Truncate employee after its children
TRUNCATE TABLE employee CASCADE;

-- Truncate mid-level reference tables
TRUNCATE TABLE leave_request CASCADE;
TRUNCATE TABLE position CASCADE;
TRUNCATE TABLE skill CASCADE;
TRUNCATE TABLE skill_category CASCADE;
TRUNCATE TABLE job CASCADE;
TRUNCATE TABLE location CASCADE;
TRUNCATE TABLE department CASCADE;
TRUNCATE TABLE leave_type CASCADE;

-- Truncate auth tables
TRUNCATE TABLE sys_role_permission CASCADE;
TRUNCATE TABLE sys_user_role CASCADE;
TRUNCATE TABLE audit_log CASCADE;
TRUNCATE TABLE sys_user CASCADE;
TRUNCATE TABLE sys_permission CASCADE;
TRUNCATE TABLE sys_role CASCADE;

-- ====================================================================
-- 2. RESET ALL SEQUENCES TO 1
-- ====================================================================

-- Employee and profile
ALTER SEQUENCE employee_employee_id_seq RESTART WITH 1;
ALTER SEQUENCE employee_profile_employee_id_seq RESTART WITH 1;
ALTER SEQUENCE employee_job_history_history_id_seq RESTART WITH 1;

-- Org
ALTER SEQUENCE department_department_id_seq RESTART WITH 1;
ALTER SEQUENCE position_position_id_seq RESTART WITH 1;
ALTER SEQUENCE location_location_id_seq RESTART WITH 1;
ALTER SEQUENCE job_job_id_seq RESTART WITH 1;

-- Leave
ALTER SEQUENCE leave_request_leave_id_seq RESTART WITH 1;
ALTER SEQUENCE leave_type_leave_type_id_seq RESTART WITH 1;

-- Auth
ALTER SEQUENCE sys_user_user_id_seq RESTART WITH 1;
ALTER SEQUENCE sys_role_role_id_seq RESTART WITH 1;
ALTER SEQUENCE sys_permission_permission_id_seq RESTART WITH 1;

-- Skill
ALTER SEQUENCE skill_category_category_id_seq RESTART WITH 1;
ALTER SEQUENCE skill_skill_id_seq RESTART WITH 1;
ALTER SEQUENCE employee_skill_employee_skill_id_seq RESTART WITH 1;
ALTER SEQUENCE position_required_skill_position_skill_id_seq RESTART WITH 1;
ALTER SEQUENCE employee_project_project_id_seq RESTART WITH 1;
ALTER SEQUENCE project_tech_stack_pts_id_seq RESTART WITH 1;

-- Analytics
ALTER SEQUENCE attrition_history_history_id_seq RESTART WITH 1;
ALTER SEQUENCE attendance_record_attendance_id_seq RESTART WITH 1;
ALTER SEQUENCE performance_review_review_id_seq RESTART WITH 1;

-- Audit
ALTER SEQUENCE audit_log_audit_id_seq RESTART WITH 1;

-- ====================================================================
-- 3. REFERENCE DATA
-- ====================================================================

-- 3a. Sys Roles
INSERT INTO sys_role (role_id, role_code, role_name, description) VALUES
(1, 'ADMIN',    '系统管理员', '管理用户、角色、全量数据'),
(2, 'HR',       'HR管理员',   '管理员工、部门、岗位、请假'),
(3, 'EMPLOYEE', '普通员工',   '查看个人信息与提交请假'),
(4, 'MANAGER',  '部门经理',   '审批人 + 团队管理'),
(5, 'CEO',      'CEO/管理员', '系统所有者——所有权限');

-- 3b. Sys Permissions
INSERT INTO sys_permission (permission_id, permission_code, permission_name, description) VALUES
(1,  'user.manage',       '用户管理',   '增删改查用户'),
(2,  'employee.manage',   '员工管理',   '增删改查员工'),
(3,  'department.manage', '部门管理',   '增删改查部门'),
(4,  'leave.manage',      '请假管理',   '审批和管理请假'),
(5,  'audit.view',        '审计查看',   '查看审计日志'),
(6,  'skill.view',        '技能查看',   '查看技能信息'),
(7,  'skill.manage',      '技能管理',   '管理技能、类别、AI推断'),
(8,  'analytics.view',    '分析查看',   '查看技能差距、离职预测、绩效趋势'),
(9,  'attendance.view',   '考勤查看',   '查看考勤记录（部门级）'),
(10, 'performance.view',  '绩效查看',   '查看绩效评估（部门级）'),
(11, 'performance.manage','绩效管理',   '创建和更新绩效评估'),
(12, 'team.view',         '团队查看',   '查看直属团队成员资料'),
(13, 'predict.view',      '预测查看',   '查看离职预测数据');

-- 3c. Locations (2 offices)
INSERT INTO location (location_id, location_code, location_name, country_code, city, address_line, status) VALUES
(1, 'CN-SH-HQ', 'Shanghai Headquarters', 'CN', 'Shanghai', 'Pudong New Area', 1),
(2, 'CN-SZ-BR', 'Shenzhen Branch',       'CN', 'Shenzhen', 'Nanshan District', 1);

-- 3d. Leave Types
INSERT INTO leave_type (leave_type_id, leave_code, leave_name, requires_approval, status) VALUES
(1, 'annual',   'Annual Leave',   1, 1),
(2, 'sick',     'Sick Leave',      1, 1),
(3, 'personal', 'Personal Leave',  1, 1);

-- 3e. Job Families
INSERT INTO job (job_id, job_code, job_title, job_grade, min_salary, max_salary, description) VALUES
(1,  'JOB-CEO',     'Chief Executive Officer',     'E5', 80000,  150000, 'Executive leadership'),
(2,  'JOB-VP',      'Vice President',              'E4', 50000,  90000,  'VP-level leadership'),
(3,  'JOB-ENG-MGR', 'Engineering Manager',          'M3', 35000,  55000,  'Engineering management'),
(4,  'JOB-BE',      'Backend Engineer',             'P2', 15000,  28000,  'Backend engineering'),
(5,  'JOB-FE',      'Frontend Engineer',            'P2', 14000,  26000,  'Frontend engineering'),
(6,  'JOB-DEVOPS',  'DevOps Engineer',              'P2', 16000,  30000,  'DevOps and infrastructure'),
(7,  'JOB-QA',      'QA Engineer',                  'P1', 12000,  22000,  'Quality assurance'),
(8,  'JOB-PM',      'Product Manager',              'M2', 25000,  45000,  'Product management'),
(9,  'JOB-DESIGN',  'UX Designer',                  'P2', 15000,  28000,  'User experience design'),
(10, 'JOB-DA',      'Data Analyst',                 'P2', 14000,  26000,  'Data analysis'),
(11, 'JOB-SALES',   'Sales Representative',         'P1', 10000,  20000,  'Sales'),
(12, 'JOB-MKT',     'Marketing Specialist',         'P1', 10000,  20000,  'Marketing'),
(13, 'JOB-CS',      'Customer Success Manager',     'M1', 15000,  25000,  'Customer success'),
(14, 'JOB-HR',      'HR Specialist',                'P1', 8000,   16000,  'Human resources'),
(15, 'JOB-ACC',     'Accountant',                   'P1', 8000,   16000,  'Accounting');

-- ====================================================================
-- 4. ORG DATA
-- ====================================================================

-- 4a. Departments (status=1 active, all at Shanghai HQ location=1)
INSERT INTO department (department_id, department_name, department_code, parent_department_id, location_id, manager_name, description, status) VALUES
(1, 'Engineering',        'D001', NULL, 1, NULL, 'Core engineering and technology department', 1),
(2, 'Product',            'D002', NULL, 1, NULL, 'Product planning, design, and data analytics', 1),
(3, 'Sales & Marketing',  'D003', NULL, 1, NULL, 'Sales, marketing, and customer success', 1),
(4, 'Operations',         'D004', NULL, 1, NULL, 'HR, finance, and legal operations', 1);

-- 4b. Positions (20 positions, each scoped to a department)
INSERT INTO position (position_id, position_name, position_code, level_name, department_id, job_id, headcount, status, description) VALUES
-- Engineering department (dept 1)
(1,  'CEO',                    'POS-CEO-001',    'E5', 1, 1,  1, 1, 'Chief Executive Officer'),
(2,  'VP Engineering',         'POS-ENG-VP-001', 'E4', 1, 2,  1, 1, 'VP of Engineering'),
(3,  'Engineering Manager',    'POS-ENG-MGR-001','M3', 1, 3,  3, 1, 'Engineering team manager'),
(4,  'Senior Backend Engineer','POS-BE-SR-001',  'P3', 1, 4,  2, 1, 'Senior backend engineer'),
(5,  'Backend Engineer',       'POS-BE-001',     'P2', 1, 4,  4, 1, 'Backend engineer'),
(6,  'Senior Frontend Engineer','POS-FE-SR-001', 'P3', 1, 5,  2, 1, 'Senior frontend engineer'),
(7,  'Frontend Engineer',      'POS-FE-001',     'P2', 1, 5,  3, 1, 'Frontend engineer'),
(8,  'DevOps Engineer',        'POS-DEVOPS-001', 'P2', 1, 6,  3, 1, 'DevOps engineer'),
(9,  'QA Engineer',            'POS-QA-001',     'P1', 1, 7,  3, 1, 'Quality assurance engineer'),
-- Product department (dept 2)
(10, 'VP Product',             'POS-PROD-VP-001','E4', 2, 2,  1, 1, 'VP of Product'),
(11, 'Product Manager',        'POS-PM-001',     'M2', 2, 8,  5, 1, 'Product manager'),
(12, 'UX Designer',            'POS-UX-001',     'P2', 2, 9,  4, 1, 'UX/UI designer'),
(13, 'Data Analyst',           'POS-DA-001',     'P2', 2, 10, 4, 1, 'Data analyst'),
-- Sales & Marketing department (dept 3)
(14, 'VP Sales & Marketing',   'POS-SALES-VP-001','E4',3, 2,  1, 1, 'VP of Sales and Marketing'),
(15, 'Sales Representative',   'POS-SALES-001',  'P1', 3, 11, 6, 1, 'Sales representative'),
(16, 'Marketing Specialist',   'POS-MKT-001',    'P1', 3, 12, 5, 1, 'Marketing specialist'),
(17, 'Customer Success Manager','POS-CS-001',    'M1', 3, 13, 3, 1, 'Customer success manager'),
-- Operations department (dept 4)
(18, 'VP Operations',          'POS-OPS-VP-001', 'E4', 4, 2,  1, 1, 'VP of Operations'),
(19, 'HR Specialist',          'POS-HR-001',     'P1', 4, 14, 3, 1, 'HR specialist'),
(20, 'Accountant',             'POS-ACC-001',    'P1', 4, 15, 3, 1, 'Accountant');

-- ====================================================================
-- 5. SKILL SYSTEM
-- ====================================================================

-- 5a. Skill Categories
INSERT INTO skill_category (category_id, category_name, parent_category_id, description, sort_order) VALUES
(1,  'Programming',   NULL, 'Programming languages and coding',      1),
(2,  'Database',      NULL, 'Database design and management',         2),
(3,  'Framework',     NULL, 'Development frameworks and tools',       3),
(4,  'Management',    NULL, 'Management and leadership skills',       4),
(5,  'DataScience',   NULL, 'Data science and analytics',             5),
(6,  'DevOps',        NULL, 'Infrastructure and deployment',          6),
(7,  'Design',        NULL, 'Design and user experience',             7),
(8,  'Communication', NULL, 'Communication and soft skills',          8);

-- 5b. Skills
INSERT INTO skill (skill_id, skill_name, category_id, description) VALUES
(1,  'Python',           1, 'Python programming language'),
(2,  'Java',             1, 'Java programming language'),
(3,  'JavaScript',       1, 'JavaScript programming language'),
(4,  'TypeScript',       1, 'TypeScript programming language'),
(5,  'Go',               1, 'Golang programming language'),
(6,  'Rust',             1, 'Rust programming language'),
(7,  'SQL',              2, 'SQL queries and database design'),
(8,  'openGauss',        2, 'openGauss database management'),
(9,  'PostgreSQL',       2, 'PostgreSQL database'),
(10, 'MongoDB',          2, 'MongoDB NoSQL database'),
(11, 'Redis',            2, 'Redis caching'),
(12, 'React',            3, 'React frontend framework'),
(13, 'Vue',              3, 'Vue.js frontend framework'),
(14, 'Node.js',          3, 'Node.js runtime'),
(15, 'Django',           3, 'Django Python web framework'),
(16, 'Spring',           3, 'Spring Boot Java framework'),
(17, 'TeamMgmt',         4, 'Team management and leadership'),
(18, 'ProjectMgmt',      4, 'Project management'),
(19, 'StrategicPlanning', 4, 'Strategic planning'),
(20, 'DataAnalysis',     5, 'Data analysis and visualization'),
(21, 'MachineLearning',  5, 'Machine learning and AI'),
(22, 'Statistics',       5, 'Statistics and probability'),
(23, 'Docker',           6, 'Docker containerization'),
(24, 'Kubernetes',       6, 'Kubernetes orchestration'),
(25, 'AWS',              6, 'AWS cloud services'),
(26, 'Linux',            6, 'Linux administration'),
(27, 'CI/CD',            6, 'CI/CD pipelines'),
(28, 'Figma',            7, 'Figma design tool'),
(29, 'UI/UX',            7, 'UI/UX design'),
(30, 'DesignSystem',     7, 'Design systems'),
(31, 'Sales',            8, 'Sales techniques'),
(32, 'CRM',              8, 'CRM management'),
(33, 'PublicSpeaking',   8, 'Public speaking'),
(34, 'TechnicalWriting', 8, 'Technical writing'),
(35, 'Negotiation',      8, 'Negotiation skills');

-- ====================================================================
-- 6. EMPLOYEES (60 total: 52 active/probation + 8 resigned)
-- ====================================================================

-- Insert ALL employees with explicit employee_id.
-- manager_employee_id references known IDs (CEO=1, VP Eng=2, etc.)
-- We use a DO block so RETURNING can capture IDs, but since we provide
-- explicit IDs, we just do a simple bulk insert.

-- ===== 6a. Executive =====
INSERT INTO employee (employee_id, employee_no, full_name, gender, birth_date, hire_date, employment_status, employment_type, department_id, position_id, manager_employee_id, tenure, engagement_score, last_promotion_months, manager_changes, overtime_count, attrition_flag, phone, email) VALUES
(1, 'NT0001', 'Alex Chen',   'M', '1980-03-15', '2021-01-15', 'active',   'full-time', 1, 1,  NULL, 52, 95, 3,  0, 0,  0, '13800000001', 'alex.chen@novatech.com');

-- ===== 6b. Engineering (employees 2-20) =====
INSERT INTO employee (employee_id, employee_no, full_name, gender, birth_date, hire_date, employment_status, employment_type, department_id, position_id, manager_employee_id, tenure, engagement_score, last_promotion_months, manager_changes, overtime_count, attrition_flag, phone, email) VALUES
(2,  'NT0002', 'Sarah Wang',   'F', '1985-07-22', '2021-03-01', 'active',   'full-time', 1, 2,  1, 50, 92, 6,  0, 3,  0, '13800000002', 'sarah.wang@novatech.com'),
(3,  'NT0003', 'Mike Zhang',   'M', '1988-11-10', '2021-06-15', 'active',   'full-time', 1, 3,  2, 47, 88, 4,  1, 5,  0, '13800000003', 'mike.zhang@novatech.com'),
(4,  'NT0004', 'Lisa Liu',     'F', '1990-02-28', '2022-01-10', 'active',   'full-time', 1, 3,  2, 40, 85, 8,  0, 4,  0, '13800000004', 'lisa.liu@novatech.com'),
(5,  'NT0005', 'Tom Li',       'M', '1992-05-14', '2022-03-20', 'active',   'full-time', 1, 4,  3, 38, 78, 12, 1, 6,  0, '13800000005', 'tom.li@novatech.com'),
(6,  'NT0006', 'Emily Wu',     'F', '1993-09-08', '2022-06-01', 'active',   'full-time', 1, 4,  3, 35, 90, 6,  0, 3,  0, '13800000006', 'emily.wu@novatech.com'),
(7,  'NT0007', 'Jack Yang',    'M', '1994-12-25', '2022-09-15', 'active',   'full-time', 1, 5,  5, 32, 72, 18, 2, 8,  0, '13800000007', 'jack.yang@novatech.com'),
(8,  'NT0008', 'Anna Xu',      'F', '1995-04-03', '2023-01-10', 'active',   'full-time', 1, 5,  5, 28, 82, 10, 1, 4,  0, '13800000008', 'anna.xu@novatech.com'),
(9,  'NT0009', 'David Huang',  'M', '1991-08-17', '2023-04-20', 'active',   'full-time', 1, 5,  6, 25, 65, 24, 0, 10, 0, '13800000009', 'david.huang@novatech.com'),
(10, 'NT0010', 'Cathy Zhou',   'F', '1996-01-30', '2023-07-01', 'active',   'full-time', 1, 5,  6, 22, 88, 6,  1, 3,  0, '13800000010', 'cathy.zhou@novatech.com'),
(11, 'NT0011', 'Brian Feng',   'M', '1989-06-12', '2023-10-10', 'active',   'full-time', 1, 6,  4, 18, 75, 12, 0, 7,  0, '13800000011', 'brian.feng@novatech.com'),
(12, 'NT0012', 'Diana Pan',    'F', '1993-03-21', '2023-01-15', 'active',   'full-time', 1, 6,  4, 28, 91, 4,  1, 2,  0, '13800000012', 'diana.pan@novatech.com'),
(13, 'NT0013', 'Frank Liang',  'M', '1997-09-05', '2024-03-01', 'active',   'full-time', 1, 7,  11, 14, 68, 18, 0, 9,  0, '13800000013', 'frank.liang@novatech.com'),
(14, 'NT0014', 'Grace Xiao',   'F', '1998-11-18', '2024-06-15', 'active',   'full-time', 1, 7,  11, 11, 85, 6,  0, 3,  0, '13800000014', 'grace.xiao@novatech.com'),
(15, 'NT0015', 'Henry Zhu',    'M', '1995-07-29', '2024-09-20', 'active',   'full-time', 1, 7,  12, 8,  72, 0,  0, 5,  0, '13800000015', 'henry.zhu@novatech.com'),
(16, 'NT0016', 'Ivy Sun',      'F', '1999-02-14', '2025-01-10', 'active',   'full-time', 1, 8,  3,  4, 80, 0,  0, 2,  0, '13800000016', 'ivy.sun@novatech.com'),
(17, 'NT0017', 'Kevin He',     'M', '1990-10-08', '2022-04-01', 'active',   'full-time', 1, 8,  3, 37, 70, 24, 2, 12, 0, '13800000017', 'kevin.he@novatech.com'),
(18, 'NT0018', 'Leo Yao',      'M', '2000-05-20', '2025-06-01', 'probation','full-time', 1, 8,  3,  0, 60, 0,  0, 0,  0, '13800000018', 'leo.yao@novatech.com'),
(19, 'NT0019', 'Mia Tan',      'F', '1992-12-01', '2024-11-01', 'active',   'full-time', 1, 9,  3,  6, 82, 0,  0, 4,  0, '13800000019', 'mia.tan@novatech.com'),
(20, 'NT0020', 'Nick Peng',    'M', '1996-04-15', '2025-03-15', 'active',   'full-time', 1, 9,  3,  2, 75, 0,  0, 2,  0, '13800000020', 'nick.peng@novatech.com');

-- ===== 6c. Product (employees 21-33) =====
INSERT INTO employee (employee_id, employee_no, full_name, gender, birth_date, hire_date, employment_status, employment_type, department_id, position_id, manager_employee_id, tenure, engagement_score, last_promotion_months, manager_changes, overtime_count, attrition_flag, phone, email) VALUES
(21, 'NT0021', 'Oscar Lin',    'M', '1984-08-05', '2021-04-01', 'active',   'full-time', 2, 10, 1,  50, 93, 3,  0, 2,  0, '13800000021', 'oscar.lin@novatech.com'),
(22, 'NT0022', 'Pearl Song',   'F', '1987-12-19', '2021-08-15', 'active',   'full-time', 2, 11, 21, 45, 87, 9,  1, 5,  0, '13800000022', 'pearl.song@novatech.com'),
(23, 'NT0023', 'Quinn Jiang',  'F', '1990-03-27', '2022-02-20', 'active',   'full-time', 2, 11, 21, 39, 82, 12, 0, 4,  0, '13800000023', 'quinn.jiang@novatech.com'),
(24, 'NT0024', 'Ray Ma',       'M', '1991-07-11', '2022-11-01', 'active',   'full-time', 2, 11, 22, 30, 76, 15, 2, 7,  0, '13800000024', 'ray.ma@novatech.com'),
(25, 'NT0025', 'Sara Guo',     'F', '1993-09-03', '2023-05-15', 'active',   'full-time', 2, 11, 22, 24, 88, 6,  1, 3,  0, '13800000025', 'sara.guo@novatech.com'),
(26, 'NT0026', 'Tommy Ruan',   'M', '1995-01-28', '2024-01-10', 'active',   'full-time', 2, 11, 23, 16, 70, 0,  0, 5,  0, '13800000026', 'tommy.ruan@novatech.com'),
(27, 'NT0027', 'Uma Wei',      'F', '1989-05-16', '2022-07-01', 'active',   'full-time', 2, 12, 21, 34, 84, 10, 1, 4,  0, '13800000027', 'uma.wei@novatech.com'),
(28, 'NT0028', 'Vince Duan',   'M', '1992-10-09', '2023-09-20', 'active',   'full-time', 2, 12, 27, 20, 78, 6,  0, 3,  0, '13800000028', 'vince.duan@novatech.com'),
(29, 'NT0029', 'Wendy Luo',    'F', '1996-06-24', '2024-04-15', 'active',   'full-time', 2, 12, 27, 13, 90, 0,  0, 2,  0, '13800000029', 'wendy.luo@novatech.com'),
(30, 'NT0030', 'Xander Qiu',   'M', '1998-08-30', '2025-02-01', 'active',   'full-time', 2, 12, 28, 3,  72, 0,  0, 0,  0, '13800000030', 'xander.qiu@novatech.com'),
(31, 'NT0031', 'Yvonne Tang',  'F', '1991-04-07', '2023-03-10', 'active',   'full-time', 2, 13, 21, 26, 85, 8,  1, 4,  0, '13800000031', 'yvonne.tang@novatech.com'),
(32, 'NT0032', 'Zack Cheng',   'M', '1994-11-22', '2024-08-01', 'active',   'full-time', 2, 13, 31, 9,  68, 0,  0, 6,  0, '13800000032', 'zack.cheng@novatech.com'),
(33, 'NT0033', 'Amy Fan',      'F', '1999-03-15', '2025-05-01', 'probation','full-time', 2, 13, 31, 0,  55, 0,  0, 0,  0, '13800000033', 'amy.fan@novatech.com');

-- ===== 6d. Sales & Marketing (employees 34-45) =====
INSERT INTO employee (employee_id, employee_no, full_name, gender, birth_date, hire_date, employment_status, employment_type, department_id, position_id, manager_employee_id, tenure, engagement_score, last_promotion_months, manager_changes, overtime_count, attrition_flag, phone, email) VALUES
(34, 'NT0034', 'Benny Cai',    'M', '1983-06-18', '2021-05-01', 'active',   'full-time', 3, 14, 1,  48, 88, 6,  0, 5,  0, '13800000034', 'benny.cai@novatech.com'),
(35, 'NT0035', 'Cindy Dai',    'F', '1988-09-12', '2022-03-15', 'active',   'full-time', 3, 15, 34, 38, 82, 12, 1, 8,  0, '13800000035', 'cindy.dai@novatech.com'),
(36, 'NT0036', 'Derek Fu',     'M', '1990-01-25', '2022-10-01', 'active',   'full-time', 3, 15, 34, 31, 74, 18, 2, 10, 0, '13800000036', 'derek.fu@novatech.com'),
(37, 'NT0037', 'Eva Gao',      'F', '1992-04-30', '2023-04-10', 'active',   'full-time', 3, 15, 35, 25, 65, 24, 1, 12, 0, '13800000037', 'eva.gao@novatech.com'),
(38, 'NT0038', 'Finn Hu',      'M', '1993-08-14', '2023-08-20', 'active',   'full-time', 3, 15, 35, 21, 60, 0,  2, 15, 0, '13800000038', 'finn.hu@novatech.com'),
(39, 'NT0039', 'Gina Jia',     'F', '1995-11-02', '2024-02-01', 'active',   'full-time', 3, 15, 36, 15, 78, 0,  1, 5,  0, '13800000039', 'gina.jia@novatech.com'),
(40, 'NT0040', 'Hank Ke',      'M', '1996-06-19', '2024-07-15', 'active',   'full-time', 3, 15, 36, 10, 70, 0,  0, 7,  0, '13800000040', 'hank.ke@novatech.com'),
(41, 'NT0041', 'Iris Lei',     'F', '1990-12-08', '2023-01-20', 'active',   'full-time', 3, 16, 34, 28, 80, 6,  2, 4,  0, '13800000041', 'iris.lei@novatech.com'),
(42, 'NT0042', 'Jake Mo',      'M', '1992-03-26', '2023-11-01', 'active',   'full-time', 3, 16, 41, 18, 72, 12, 1, 6,  0, '13800000042', 'jake.mo@novatech.com'),
(43, 'NT0043', 'Kyle Niu',     'M', '1995-09-17', '2024-09-10', 'active',   'full-time', 3, 16, 41, 8,  65, 0,  0, 3,  0, '13800000043', 'kyle.niu@novatech.com'),
(44, 'NT0044', 'Luna Ou',      'F', '1997-05-22', '2024-12-01', 'active',   'full-time', 3, 17, 34, 5,  85, 0,  0, 2,  0, '13800000044', 'luna.ou@novatech.com'),
(45, 'NT0045', 'Marco Pi',     'M', '1998-10-10', '2025-04-15', 'resigned', 'full-time', 3, 15, 36, 1,  45, 0,  0, 0,  1, '13800000045', 'marco.pi@novatech.com');

-- ===== 6e. Operations (employees 46-53) =====
INSERT INTO employee (employee_id, employee_no, full_name, gender, birth_date, hire_date, employment_status, employment_type, department_id, position_id, manager_employee_id, tenure, engagement_score, last_promotion_months, manager_changes, overtime_count, attrition_flag, phone, email) VALUES
(46, 'NT0046', 'Nina Qin',     'F', '1985-01-09', '2021-06-01', 'active',   'full-time', 4, 18, 1,  47, 90, 4,  0, 2,  0, '13800000046', 'nina.qin@novatech.com'),
(47, 'NT0047', 'Owen Ren',     'M', '1989-04-23', '2022-04-15', 'active',   'full-time', 4, 19, 46, 37, 85, 10, 0, 3,  0, '13800000047', 'owen.ren@novatech.com'),
(48, 'NT0048', 'Penny She',    'F', '1991-08-11', '2022-12-01', 'active',   'full-time', 4, 19, 46, 29, 78, 15, 1, 5,  0, '13800000048', 'penny.she@novatech.com'),
(49, 'NT0049', 'Quincy Tao',   'M', '1988-02-28', '2023-07-20', 'active',   'full-time', 4, 20, 46, 22, 72, 20, 0, 6,  0, '13800000049', 'quincy.tao@novatech.com'),
(50, 'NT0050', 'Rita Wan',     'F', '1994-10-15', '2024-05-10', 'active',   'full-time', 4, 20, 49, 12, 82, 0,  0, 3,  0, '13800000050', 'rita.wan@novatech.com'),
(51, 'NT0051', 'Sam Xie',      'M', '1996-07-03', '2025-02-15', 'active',   'full-time', 4, 19, 47, 3,  70, 0,  0, 2,  0, '13800000051', 'sam.xie@novatech.com'),
(52, 'NT0052', 'Tina Ye',      'F', '1999-12-20', '2025-06-01', 'probation','full-time', 4, 20, 49, 0,  62, 0,  0, 0,  0, '13800000052', 'tina.ye@novatech.com'),
(53, 'NT0053', 'Uma Zeng',     'F', '1993-05-07', '2024-10-01', 'active',   'full-time', 4, 20, 49, 7,  58, 24, 2, 15, 0, '13800000053', 'uma.zeng@novatech.com');

-- ===== 6f. Resigned Employees (employees 54-60) =====
INSERT INTO employee (employee_id, employee_no, full_name, gender, birth_date, hire_date, employment_status, employment_type, department_id, position_id, manager_employee_id, tenure, engagement_score, last_promotion_months, manager_changes, overtime_count, attrition_flag, phone, email) VALUES
(54, 'NT0054', 'Victor Bao',   'M', '1991-11-30', '2022-08-01', 'resigned', 'full-time', 1, 5,  3,  18, 48, 24, 2, 20, 1, '13800000054', 'victor.bao@novatech.com'),
(55, 'NT0055', 'Willa Chu',    'F', '1993-03-17', '2023-01-15', 'resigned', 'full-time', 2, 11, 22, 14, 52, 12, 1, 15, 1, '13800000055', 'willa.chu@novatech.com'),
(56, 'NT0056', 'Xia Dan',      'M', '1994-07-22', '2023-06-01', 'resigned', 'full-time', 3, 15, 35, 10, 42, 0,  0, 25, 1, '13800000056', 'xia.dan@novatech.com'),
(57, 'NT0057', 'Yuan Er',      'F', '1996-01-09', '2024-03-10', 'resigned', 'full-time', 1, 7,  11, 6,  38, 0,  2, 18, 1, '13800000057', 'yuan.er@novatech.com'),
(58, 'NT0058', 'Zoe Fang',     'F', '1992-09-14', '2022-11-20', 'resigned', 'full-time', 4, 20, 49, 8,  55, 12, 3, 12, 1, '13800000058', 'zoe.fang@novatech.com'),
(59, 'NT0059', 'Bao Gong',     'M', '1995-05-28', '2023-09-01', 'resigned', 'full-time', 3, 16, 42, 4,  40, 0,  1, 22, 1, '13800000059', 'bao.gong@novatech.com'),
(60, 'NT0060', 'Chao Han',     'M', '1997-08-03', '2024-06-15', 'resigned', 'full-time', 1, 9,  19, 3,  35, 0,  0, 20, 1, '13800000060', 'chao.han@novatech.com');

-- ====================================================================
-- 7. EMPLOYEE PROFILES AND JOB HISTORY
-- ====================================================================

-- 7a. Employee Profiles (one per employee)
INSERT INTO employee_profile (employee_id, address, emergency_contact_name, emergency_contact_phone, education_level, marital_status, personal_email, notes)
SELECT
    e.employee_id,
    CASE e.department_id
        WHEN 1 THEN 'Shanghai, Pudong'
        WHEN 2 THEN 'Shanghai, Jingan'
        WHEN 3 THEN 'Shenzhen, Nanshan'
        WHEN 4 THEN 'Shanghai, Xuhui'
    END,
    'Emergency Contact',
    '1390000' || LPAD(e.employee_id::text, 4, '0'),
    CASE
        WHEN e.position_id IN (1,2,10,14,18) THEN 'Master'
        WHEN e.position_id IN (3,4,6,11,12) THEN 'Bachelor'
        ELSE 'Bachelor'
    END,
    CASE WHEN e.employee_id % 3 = 0 THEN 'married' ELSE 'single' END,
    LOWER(e.employee_no) || '@personal.example.com',
    'Employee profile - ' || e.full_name
FROM employee e;

-- 7b. Job History (initial assignment for all employees)
INSERT INTO employee_job_history (employee_id, department_id, position_id, job_id, manager_employee_id, start_date, end_date, change_reason)
SELECT
    e.employee_id,
    e.department_id,
    e.position_id,
    p.job_id,
    e.manager_employee_id,
    e.hire_date,
    NULL,
    'initial_assignment'
FROM employee e
JOIN position p ON p.position_id = e.position_id;

-- ====================================================================
-- 8. POSITION REQUIREMENTS AND EMPLOYEE SKILLS
-- ====================================================================

-- 8a. Position Required Skills
INSERT INTO position_required_skill (position_id, skill_id, required_level, importance_weight) VALUES
-- CEO: management + strategy
(1, 17, 5, 3), (1, 19, 5, 3), (1, 33, 4, 2), (1, 18, 4, 2),
-- VP Engineering: management + architecture
(2, 17, 5, 3), (2, 1,  4, 2), (2, 8,  3, 2), (2, 23, 3, 2),
-- Engineering Manager: management + coding
(3, 17, 4, 3), (3, 18, 4, 3), (3, 1,  3, 2), (3, 3,  3, 2),
-- Senior Backend Engineer: deep backend
(4, 1,  5, 3), (4, 7,  4, 3), (4, 8,  3, 2), (4, 14, 3, 2), (4, 23, 3, 2),
-- Backend Engineer: backend skills
(5, 1,  3, 3), (5, 7,  3, 3), (5, 8,  2, 2), (5, 14, 2, 2),
-- Senior Frontend Engineer
(6, 3,  4, 3), (6, 4,  4, 3), (6, 12, 5, 3), (6, 13, 4, 2),
-- Frontend Engineer
(7, 3,  3, 3), (7, 12, 3, 3), (7, 13, 2, 2),
-- DevOps Engineer
(8, 23, 4, 3), (8, 24, 4, 3), (8, 25, 4, 3), (8, 26, 4, 3), (8, 27, 3, 2), (8, 1,  2, 1),
-- QA Engineer
(9, 1,  2, 2), (9, 3,  2, 2), (9, 7,  2, 2), (9, 27, 2, 2),
-- VP Product
(10, 19, 5, 3), (10, 17, 4, 3), (10, 20, 4, 2), (10, 33, 4, 2),
-- Product Manager
(11, 18, 4, 3), (11, 20, 3, 2), (11, 33, 3, 2), (11, 34, 3, 2),
-- UX Designer
(12, 28, 4, 3), (12, 29, 5, 3), (12, 30, 4, 2), (12, 13, 2, 1),
-- Data Analyst
(13, 20, 4, 3), (13, 22, 4, 3), (13, 7,  4, 3), (13, 1,  3, 2),
-- VP Sales & Marketing
(14, 31, 5, 3), (14, 35, 5, 3), (14, 17, 4, 3), (14, 33, 4, 2),
-- Sales Representative
(15, 31, 4, 3), (15, 32, 3, 3), (15, 35, 3, 2), (15, 33, 2, 2),
-- Marketing Specialist
(16, 20, 3, 3), (16, 33, 3, 2), (16, 34, 3, 2),
-- Customer Success Manager
(17, 31, 3, 3), (17, 32, 3, 2), (17, 33, 3, 2), (17, 18, 3, 2),
-- VP Operations
(18, 17, 5, 3), (18, 19, 4, 3), (18, 35, 4, 2),
-- HR Specialist
(19, 17, 4, 3), (19, 18, 3, 2), (19, 20, 2, 2),
-- Accountant
(20, 20, 3, 3), (20, 18, 3, 2), (20, 35, 2, 2);

-- 8b. Employee Skills (one per employee-position-requirement, plus extras)
-- Determined by the employee's position. Core skills are those with importance_weight=3.
DO $$
DECLARE
    rec RECORD;
    sid INT;
    lvl INT;
    core BOOLEAN;
    rnd INT;
BEGIN
    FOR rec IN SELECT employee_id, position_id FROM employee WHERE employment_status IN ('active', 'probation') LOOP
        -- For each skill required by the employee's position
        FOR sid IN SELECT skill_id FROM position_required_skill WHERE position_id = rec.position_id LOOP
            rnd := 1 + (random() * 4)::int;
            lvl := LEAST(rnd, (SELECT required_level FROM position_required_skill WHERE position_id = rec.position_id AND skill_id = sid));
            core := (SELECT importance_weight = 3 FROM position_required_skill WHERE position_id = rec.position_id AND skill_id = sid);
            INSERT INTO employee_skill (employee_id, skill_id, proficiency_level, acquired_from, is_core, confirmed_by)
            VALUES (rec.employee_id, sid, lvl, 'project', core, NULL);
        END LOOP;
    END LOOP;
END $$;

-- 8c. Employee Projects (sample projects for select employees)
INSERT INTO employee_project (project_id, project_name, employee_id, role, start_date, end_date, description) VALUES
(1, 'HRMS Platform',    1, 'Executive Sponsor',   '2025-01-01', NULL,          'Company-wide HRMS platform development'),
(2, 'HRMS Platform',    2, 'Tech Lead',            '2025-01-01', NULL,          'Technical architecture and engineering oversight'),
(3, 'HRMS Platform',    3, 'Backend Lead',         '2025-01-01', NULL,          'Backend services and API development'),
(4, 'HRMS Platform',   11, 'Frontend Lead',        '2025-01-01', NULL,          'Frontend architecture and development'),
(5, 'Sales Dashboard',  1, 'Executive Sponsor',   '2026-01-15', NULL,          'Real-time sales performance dashboard'),
(6, 'Sales Dashboard', 31, 'Data Analyst',         '2026-01-15', NULL,          'Data modeling and visualization'),
(7, 'Sales Dashboard', 26, 'Product Manager',      '2026-01-15', NULL,          'Product requirements and quality'),
(8, 'Mobile App',       2, 'Tech Advisor',         '2026-03-01', NULL,          'Mobile application project'),
(9, 'Mobile App',      14, 'Frontend Engineer',    '2026-03-01', NULL,          'Mobile UI development'),
(10,'Mobile App',       5, 'Backend Engineer',     '2026-03-01', NULL,          'Mobile API development');

-- 8d. Project Tech Stack
INSERT INTO project_tech_stack (project_id, skill_id) VALUES
(1,  1), (1,  7), (1,  8), (1, 12), (1, 14), (1, 23), (1, 24),
(2,  1), (2,  7), (2,  8), (2, 23),
(3,  1), (3,  7), (3,  8), (3, 14),
(4,  3), (4, 12), (4, 13),
(5,  1), (5,  7), (5, 12), (5, 20),
(6,  1), (6,  7), (6, 20), (6, 22),
(7, 18), (7, 20),
(8,  3), (8, 12),
(9,  3), (9, 12), (9, 13),
(10, 1), (10, 7), (10, 14);

-- ====================================================================
-- 9. AUTH SYSTEM (sys_user, roles, permissions)
-- ====================================================================

-- 9a. Sys Users (9 accounts)
INSERT INTO sys_user (user_id, username, password_hash, full_name, phone, email, status) VALUES
(1, 'admin',    'sha256$8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'System Admin', '13900000000', 'admin@novatech.com', 1),
(2, 'ceo',      'sha256$8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'Alex Chen',    '13800000001', 'alex.chen@novatech.com', 1),
(3, 'vp_eng',   'sha256$8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'Sarah Wang',   '13800000002', 'sarah.wang@novatech.com', 1),
(4, 'vp_product','sha256$8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'Oscar Lin',    '13800000021', 'oscar.lin@novatech.com', 1),
(5, 'vp_sales',  'sha256$8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'Benny Cai',    '13800000034', 'benny.cai@novatech.com', 1),
(6, 'vp_ops',    'sha256$8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'Nina Qin',     '13800000046', 'nina.qin@novatech.com', 1),
(7, 'hr_mgr',    'sha256$8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'Owen Ren',     '13800000047', 'owen.ren@novatech.com', 1),
(8, 'eng_mgr',   'sha256$8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'Mike Zhang',   '13800000003', 'mike.zhang@novatech.com', 1),
(9, 'employee',  'sha256$8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'Jack Yang',    '13800000007', 'jack.yang@novatech.com', 1);

-- Password for all users: '123456' (SHA-256 hash)
-- Note: These are demo/test accounts. In production, use proper password hashing.

-- 9b. User-Role Assignments
INSERT INTO sys_user_role (user_id, role_id) VALUES
(1, 1),  -- admin -> ADMIN
(2, 5),  -- ceo -> CEO
(3, 4),  -- vp_eng -> MANAGER
(4, 4),  -- vp_product -> MANAGER
(5, 4),  -- vp_sales -> MANAGER
(6, 4),  -- vp_ops -> MANAGER
(7, 2),  -- hr_mgr -> HR
(8, 4),  -- eng_mgr -> MANAGER
(9, 3);  -- employee -> EMPLOYEE

-- 9c. Role-Permission Assignments

-- CEO gets ALL permissions (including any future ones)
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT 5, p.permission_id FROM sys_permission p
WHERE NOT EXISTS (SELECT 1 FROM sys_role_permission x WHERE x.role_id = 5 AND x.permission_id = p.permission_id);

-- ADMIN gets all permissions
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT 1, p.permission_id FROM sys_permission p
WHERE NOT EXISTS (SELECT 1 FROM sys_role_permission x WHERE x.role_id = 1 AND x.permission_id = p.permission_id);

-- HR gets HR-scoped permissions
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT 2, p.permission_id FROM sys_permission p
WHERE p.permission_code IN ('employee.manage','department.manage','leave.manage','audit.view','skill.view','predict.view','analytics.view','attendance.view','performance.view')
AND NOT EXISTS (SELECT 1 FROM sys_role_permission x WHERE x.role_id = 2 AND x.permission_id = p.permission_id);

-- MANAGER gets team-scoped permissions
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT 4, p.permission_id FROM sys_permission p
WHERE p.permission_code IN ('skill.manage','analytics.view','attendance.view','performance.view','team.view','leave.manage')
AND NOT EXISTS (SELECT 1 FROM sys_role_permission x WHERE x.role_id = 4 AND x.permission_id = p.permission_id);

-- EMPLOYEE gets basic self-service permissions
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT 3, p.permission_id FROM sys_permission p
WHERE p.permission_code IN ('skill.view')
AND NOT EXISTS (SELECT 1 FROM sys_role_permission x WHERE x.role_id = 3 AND x.permission_id = p.permission_id);

-- ====================================================================
-- 10. ATTENDANCE RECORDS (May 2026, 22 working days)
-- ====================================================================

-- 10a. Helper: Generate attendance for a single employee on one day
-- We insert records for 20 representative employees across all departments
-- Employees: 2-6 (Eng), 8-10 (Eng), 11-14 (Eng), 16-17 (Eng),
--            21-25 (Prod), 27-29 (Prod), 31-33 (Prod),
--            34-40 (Sales), 41-44 (Sales),
--            46-50 (Ops), 51-53 (Ops)

DO $$
DECLARE
    emp_ids INT[] := ARRAY[2,3,4,5,6,8,9,10,11,12,13,14,16,17,19,20,
                           21,22,23,24,25,27,28,29,31,32,33,
                           34,35,36,37,38,39,40,41,42,43,44,
                           46,47,48,49,50,51,52,53];
    eid INT;
    day_offset INT;
    clock_date DATE;
    dow INT;
    base_hour INT;
    base_min INT;
    status_val VARCHAR(20);
    clock_type_val VARCHAR(20);
    clock_in_time TIMESTAMP;
    clock_out_time TIMESTAMP;
    r REAL;
    is_special BOOLEAN;
BEGIN
    -- For each employee
    FOREACH eid IN ARRAY emp_ids LOOP
        -- Check if this employee has a problematic pattern (for ML training)
        is_special := eid IN (9, 17, 7, 53);  -- David, Kevin, Jack, Uma

        -- For each weekday in May 2026 (excluding weekends)
        FOR day_offset IN 0..30 LOOP
            clock_date := DATE '2026-05-01' + day_offset;
            dow := EXTRACT(DOW FROM clock_date)::int;  -- 0=Sun, 6=Sat

            -- Skip weekends
            CONTINUE WHEN dow IN (0, 6);

            -- Determine status (with realistic randomness)
            r := random();

            IF is_special AND eid = 53 AND r < 0.20 THEN
                -- Uma Zeng: 20% absent
                status_val := 'absent';
                clock_type_val := 'normal';
                clock_in_time := NULL;
                clock_out_time := NULL;
            ELSIF is_special AND eid IN (7, 9) AND r < 0.25 THEN
                -- Jack Yang, David Huang: 25% late
                status_val := 'late';
                clock_type_val := 'normal';
                base_hour := 9 + (random() * 2)::int;
                base_min := (random() * 59)::int;
                clock_in_time := clock_date + (base_hour || ':' || LPAD(base_min::text, 2, '0'))::time;
                clock_out_time := clock_date + TIME '18:00:00' + (random() * 30)::int * INTERVAL '1 minute';
            ELSIF is_special AND eid = 17 AND r < 0.30 THEN
                -- Kevin He: 30% overtime
                status_val := 'present';
                clock_type_val := 'overtime';
                clock_in_time := clock_date + TIME '08:45:00' + (random() * 15)::int * INTERVAL '1 minute';
                clock_out_time := clock_date + TIME '19:30:00' + (random() * 60)::int * INTERVAL '1 minute';
            ELSIF r < 0.05 THEN
                -- 5% absent (general)
                status_val := 'absent';
                clock_type_val := 'normal';
                clock_in_time := NULL;
                clock_out_time := NULL;
            ELSIF r < 0.10 THEN
                -- 5% late (general)
                status_val := 'late';
                clock_type_val := 'normal';
                base_hour := 9 + (random() * 2)::int;
                base_min := (random() * 59)::int;
                clock_in_time := clock_date + (base_hour || ':' || LPAD(base_min::text, 2, '0'))::time;
                clock_out_time := clock_date + TIME '18:00:00' + (random() * 30)::int * INTERVAL '1 minute';
            ELSIF r < 0.13 THEN
                -- 3% half-day
                status_val := 'half-day';
                clock_type_val := 'normal';
                clock_in_time := clock_date + TIME '08:30:00' + (random() * 30)::int * INTERVAL '1 minute';
                clock_out_time := clock_date + TIME '12:00:00' + (random() * 60)::int * INTERVAL '1 minute';
            ELSE
                -- ~77% normal present
                status_val := 'present';
                clock_type_val := CASE WHEN random() < 0.10 THEN 'remote' ELSE 'normal' END;
                clock_in_time := clock_date + TIME '08:45:00' + (random() * 30)::int * INTERVAL '1 minute';
                clock_out_time := clock_date + TIME '17:45:00' + (random() * 30)::int * INTERVAL '1 minute';
            END IF;

            -- Insert the attendance record
            INSERT INTO attendance_record (employee_id, clock_in, clock_out, clock_type, status, source)
            VALUES (eid, clock_in_time, clock_out_time, clock_type_val, status_val, 'system');
        END LOOP;
    END LOOP;
END $$;

-- ====================================================================
-- 11. PERFORMANCE REVIEWS (2026-Q1)
-- ====================================================================

-- Generate one Q1 2026 review for each active/probation employee.
-- Reviewer = their manager (manager_employee_id).
-- Rating/score correlated with engagement_score.
DO $$
DECLARE
    rec RECORD;
    rating_val SMALLINT;
    score_val DECIMAL(5,2);
    strengths_text TEXT;
    improvements_text TEXT;
    goals_text TEXT;
    status_val VARCHAR(20);
    submitted_ts TIMESTAMP;
    acknowledged_ts TIMESTAMP;
BEGIN
    FOR rec IN SELECT * FROM employee WHERE employment_status IN ('active', 'probation') LOOP
        -- Skip employees who don't have a manager (CEO has no reviewer... use admin)
        -- Actually, CEO doesn't need a review. We'll assign admin as reviewer.
        IF rec.manager_employee_id IS NULL THEN
            CONTINUE;  -- Skip CEO
        END IF;

        -- Derive rating and score from engagement_score
        IF rec.engagement_score >= 90 THEN
            rating_val := 5;
            score_val := 85 + (random() * 10);
        ELSIF rec.engagement_score >= 80 THEN
            rating_val := 4;
            score_val := 70 + (random() * 12);
        ELSIF rec.engagement_score >= 70 THEN
            rating_val := 3;
            score_val := 55 + (random() * 12);
        ELSIF rec.engagement_score >= 60 THEN
            rating_val := 2;
            score_val := 40 + (random() * 15);
        ELSE
            rating_val := 2;
            score_val := 30 + (random() * 15);
        END IF;

        score_val := GREATEST(0, LEAST(100, ROUND(score_val::decimal, 2)));

        -- Realistic strengths text
        strengths_text := CASE (rec.employee_id % 6)
            WHEN 0 THEN 'Strong technical skills, consistently delivers high-quality code on time. Great team player.'
            WHEN 1 THEN 'Excellent communication and leadership. Proactively identifies and resolves blockers.'
            WHEN 2 THEN 'Deep domain knowledge. Mentors junior team members effectively.'
            WHEN 3 THEN 'Reliable and consistent. Handles complex tasks with minimal supervision.'
            WHEN 4 THEN 'Creative problem-solver. Brings innovative ideas to the team.'
            ELSE 'Strong work ethic and dedication. Always willing to go the extra mile.'
        END;

        -- Realistic improvements text
        improvements_text := CASE (rec.employee_id % 5)
            WHEN 0 THEN 'Could improve documentation practices and knowledge sharing.'
            WHEN 1 THEN 'Should focus on cross-team collaboration and broader business context.'
            WHEN 2 THEN 'Needs to develop stronger time management and priority setting.'
            WHEN 3 THEN 'Would benefit from deeper technical architecture skills.'
            ELSE 'Could communicate more proactively about project status and challenges.'
        END;

        -- Development goals
        goals_text := CASE (rec.employee_id % 4)
            WHEN 0 THEN 'Lead a cross-functional project in the next quarter. Obtain relevant certification.'
            WHEN 1 THEN 'Improve code review participation rate. Mentor one junior team member.'
            WHEN 2 THEN 'Complete advanced training in cloud-native technologies. Reduce incident response time.'
            ELSE 'Present a tech talk to the engineering organization. Contribute to internal knowledge base.'
        END;

        -- Status: most are submitted, some are acknowledged
        IF random() < 0.3 THEN
            status_val := 'acknowledged';
            submitted_ts := DATE '2026-04-01' + (random() * 15)::int * INTERVAL '1 day';
            acknowledged_ts := submitted_ts + (random() * 7 + 1)::int * INTERVAL '1 day';
        ELSE
            status_val := 'submitted';
            submitted_ts := DATE '2026-04-01' + (random() * 20)::int * INTERVAL '1 day';
            acknowledged_ts := NULL;
        END IF;

        -- Insert the review
        INSERT INTO performance_review (
            employee_id, reviewer_id, review_period,
            rating, score,
            strengths, improvements, goals,
            status, submitted_at, acknowledged_at
        ) VALUES (
            rec.employee_id,
            rec.manager_employee_id,
            '2026-Q1',
            rating_val, score_val,
            strengths_text, improvements_text, goals_text,
            status_val, submitted_ts, acknowledged_ts
        );
    END LOOP;
END $$;

-- ====================================================================
-- 12. ATTRITION HISTORY (6 months of trend data)
-- ====================================================================

-- Generate 6 monthly snapshots for each active/probation employee.
-- Each snapshot is the current data with slight variance to simulate trends.
DO $$
DECLARE
    rec RECORD;
    month_offset INT;
    snapshot_date_val TIMESTAMP;
    risk_score_val DECIMAL(6,4);
    risk_level_val VARCHAR(20);
    eng_risk DECIMAL(6,4);
    ten_risk DECIMAL(6,4);
    pro_risk DECIMAL(6,4);
    mgr_risk DECIMAL(6,4);
    ovt_risk DECIMAL(6,4);
    att_risk DECIMAL(6,4);
    perf_risk DECIMAL(6,4);
    variance REAL;
    sim_engagement SMALLINT;
    sim_tenure INT;
    sim_promotion INT;
    sim_mgr_changes INT;
    sim_overtime INT;
    sim_absent INT;
    sim_late INT;
    sim_perf DECIMAL(5,2);
BEGIN
    FOR rec IN SELECT * FROM employee WHERE employment_status IN ('active', 'probation') LOOP
        FOR month_offset IN 0..5 LOOP
            -- Snapshot date: 1st of each month going back 5 months
            snapshot_date_val := DATE '2026-05-01' - (month_offset * 30) * INTERVAL '1 day';

            -- Add variance: simulate how data looked in the past
            variance := 1.0 + (random() - 0.5) * 0.1;  -- +/- 5%

            -- Simulated past values (slightly different from current)
            sim_engagement := GREATEST(1, LEAST(100, ROUND(rec.engagement_score * variance)::int));
            sim_tenure := GREATEST(0, rec.tenure - month_offset);
            sim_promotion := GREATEST(0, rec.last_promotion_months + month_offset);
            sim_mgr_changes := GREATEST(0, rec.manager_changes);
            sim_overtime := GREATEST(0, rec.overtime_count - (month_offset * 2));

            -- Compute risk components (simplified composite formula)
            eng_risk := ROUND(((5.0 - sim_engagement / 20.0) * 0.25)::decimal, 4);
            ten_risk := ROUND((LEAST(sim_tenure::decimal / 60.0, 1.0) * 0.15)::decimal, 4);
            pro_risk := ROUND(((sim_promotion::decimal / 36.0) * 0.20)::decimal, 4);
            mgr_risk := ROUND(((sim_mgr_changes::decimal / 3.0) * 0.15)::decimal, 4);
            ovt_risk := ROUND(((sim_overtime::decimal / 30.0) * 0.05)::decimal, 4);

            -- Attendance and performance data might not have existed in past snapshots
            -- For historical snapshots, estimate from current data with trend
            sim_absent := GREATEST(0, COALESCE(rec.attendance_absent_count, 0) - (month_offset * 2));
            sim_late := GREATEST(0, COALESCE(rec.attendance_late_count, 0) - (month_offset * 3));
            sim_perf := GREATEST(0, COALESCE(rec.avg_performance_score, 75) - (month_offset * 2));

            att_risk := ROUND(((sim_absent::decimal / 10.0) * 0.05)::decimal, 4);
            perf_risk := ROUND(((5.0 - sim_perf / 20.0) * 0.10)::decimal, 4);

            risk_score_val := ROUND((eng_risk + ten_risk + pro_risk + mgr_risk + ovt_risk + att_risk + perf_risk)::decimal, 4);

            -- Determine risk level
            IF risk_score_val >= 0.7 THEN risk_level_val := 'critical';
            ELSIF risk_score_val >= 0.5 THEN risk_level_val := 'high';
            ELSIF risk_score_val >= 0.3 THEN risk_level_val := 'medium';
            ELSE risk_level_val := 'low';
            END IF;

            INSERT INTO attrition_history (
                employee_id, snapshot_date,
                risk_score, risk_level,
                engagement_risk, tenure_risk, promotion_risk,
                manager_change_risk, overtime_risk,
                attendance_risk, performance_risk,
                tenure, engagement_score,
                last_promotion_months, manager_changes, overtime_count
            ) VALUES (
                rec.employee_id, snapshot_date_val,
                risk_score_val, risk_level_val,
                eng_risk, ten_risk, pro_risk,
                mgr_risk, ovt_risk,
                att_risk, perf_risk,
                sim_tenure, sim_engagement,
                sim_promotion, sim_mgr_changes, sim_overtime
            );
        END LOOP;
    END LOOP;
END $$;

-- ====================================================================
-- 13. UPDATE DEPARTMENT MANAGERS (after employees exist)
-- ====================================================================

UPDATE department SET manager_name = 'Alex Chen' WHERE department_id = 1;
UPDATE department SET manager_name = 'Oscar Lin' WHERE department_id = 2;
UPDATE department SET manager_name = 'Benny Cai' WHERE department_id = 3;
UPDATE department SET manager_name = 'Nina Qin'  WHERE department_id = 4;

-- ====================================================================
-- 14. ADVANCE ALL SEQUENCES PAST MAX USED IDS
-- ====================================================================

SELECT setval('sys_role_role_id_seq',              (SELECT MAX(role_id) FROM sys_role));
SELECT setval('sys_permission_permission_id_seq',   (SELECT MAX(permission_id) FROM sys_permission));
SELECT setval('location_location_id_seq',           (SELECT MAX(location_id) FROM location));
SELECT setval('leave_type_leave_type_id_seq',       (SELECT MAX(leave_type_id) FROM leave_type));
SELECT setval('job_job_id_seq',                     (SELECT MAX(job_id) FROM job));
SELECT setval('department_department_id_seq',       (SELECT MAX(department_id) FROM department));
SELECT setval('position_position_id_seq',           (SELECT MAX(position_id) FROM position));
SELECT setval('skill_category_category_id_seq',     (SELECT MAX(category_id) FROM skill_category));
SELECT setval('skill_skill_id_seq',                 (SELECT MAX(skill_id) FROM skill));
SELECT setval('employee_employee_id_seq',           (SELECT MAX(employee_id) FROM employee));
SELECT setval('sys_user_user_id_seq',               (SELECT MAX(user_id) FROM sys_user));
SELECT setval('employee_project_project_id_seq',    (SELECT MAX(project_id) FROM employee_project));

-- ====================================================================
-- 15. UPDATE EMPLOYEE ANALYTICS FIELDS (derived from attendance and performance)
-- ====================================================================

-- Update attendance counts from actual records
UPDATE employee e SET
    attendance_absent_count = (
        SELECT COUNT(*) FROM attendance_record ar
        WHERE ar.employee_id = e.employee_id AND ar.status = 'absent'
    ),
    attendance_late_count = (
        SELECT COUNT(*) FROM attendance_record ar
        WHERE ar.employee_id = e.employee_id AND ar.status = 'late'
    );

-- Update performance fields from actual reviews
UPDATE employee e SET
    avg_performance_score = (
        SELECT ROUND(AVG(pr.score), 2) FROM performance_review pr
        WHERE pr.employee_id = e.employee_id
    ),
    last_review_rating = (
        SELECT pr.rating FROM performance_review pr
        WHERE pr.employee_id = e.employee_id
        ORDER BY pr.created_at DESC LIMIT 1
    ),
    last_review_date = (
        SELECT pr.submitted_at::date FROM performance_review pr
        WHERE pr.employee_id = e.employee_id
        ORDER BY pr.created_at DESC LIMIT 1
    );

-- Update resigned employees: ensure attrition_flag = 1
UPDATE employee SET attrition_flag = 1 WHERE employment_status = 'resigned';

-- ====================================================================
-- COMMIT ALL CHANGES
-- ====================================================================

COMMIT;

-- ====================================================================
-- VERIFICATION QUERIES (run these after commit to validate)
-- ====================================================================

-- SELECT 'employee count' AS check, COUNT(*) AS value FROM employee
-- UNION ALL
-- SELECT 'active+probation', COUNT(*) FROM employee WHERE employment_status IN ('active','probation')
-- UNION ALL
-- SELECT 'resigned', COUNT(*) FROM employee WHERE employment_status = 'resigned'
-- UNION ALL
-- SELECT 'attendance records', COUNT(*) FROM attendance_record
-- UNION ALL
-- SELECT 'performance reviews', COUNT(*) FROM performance_review
-- UNION ALL
-- SELECT 'attrition history', COUNT(*) FROM attrition_history
-- ORDER BY check;
