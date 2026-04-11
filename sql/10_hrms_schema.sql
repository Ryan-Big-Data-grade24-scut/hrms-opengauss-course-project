CREATE TABLE IF NOT EXISTS sys_user (
    user_id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    status SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sys_role (
    role_id BIGSERIAL PRIMARY KEY,
    role_code VARCHAR(50) NOT NULL UNIQUE,
    role_name VARCHAR(100) NOT NULL,
    description VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS sys_permission (
    permission_id BIGSERIAL PRIMARY KEY,
    permission_code VARCHAR(100) NOT NULL UNIQUE,
    permission_name VARCHAR(100) NOT NULL,
    description VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS sys_user_role (
    user_id BIGINT NOT NULL REFERENCES sys_user(user_id) ON DELETE CASCADE,
    role_id BIGINT NOT NULL REFERENCES sys_role(role_id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS sys_role_permission (
    role_id BIGINT NOT NULL REFERENCES sys_role(role_id) ON DELETE CASCADE,
    permission_id BIGINT NOT NULL REFERENCES sys_permission(permission_id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS department (
    department_id BIGSERIAL PRIMARY KEY,
    department_name VARCHAR(100) NOT NULL UNIQUE,
    parent_department_id BIGINT REFERENCES department(department_id),
    manager_name VARCHAR(100),
    status SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS position (
    position_id BIGSERIAL PRIMARY KEY,
    position_name VARCHAR(100) NOT NULL UNIQUE,
    level_name VARCHAR(50),
    description VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS employee (
    employee_id BIGSERIAL PRIMARY KEY,
    employee_no VARCHAR(30) NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    gender CHAR(1),
    phone VARCHAR(20),
    email VARCHAR(100),
    hire_date DATE NOT NULL,
    employment_status VARCHAR(30) NOT NULL DEFAULT 'active',
    department_id BIGINT REFERENCES department(department_id),
    position_id BIGINT REFERENCES position(position_id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leave_request (
    leave_id BIGSERIAL PRIMARY KEY,
    employee_id BIGINT NOT NULL REFERENCES employee(employee_id) ON DELETE CASCADE,
    leave_type VARCHAR(30) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason VARCHAR(255),
    approval_status VARCHAR(30) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
    audit_id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(50),
    action_detail VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_employee_department ON employee(department_id);
CREATE INDEX IF NOT EXISTS idx_employee_position ON employee(position_id);
CREATE INDEX IF NOT EXISTS idx_employee_hire_date ON employee(hire_date);
CREATE INDEX IF NOT EXISTS idx_employee_status ON employee(employment_status);
CREATE INDEX IF NOT EXISTS idx_leave_employee ON leave_request(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_status ON leave_request(approval_status);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_username ON audit_log(username);

INSERT INTO sys_role (role_code, role_name, description)
SELECT 'ADMIN', '系统管理员', '管理用户、角色、全量数据'
WHERE NOT EXISTS (SELECT 1 FROM sys_role WHERE role_code = 'ADMIN');

INSERT INTO sys_role (role_code, role_name, description)
SELECT 'HR', 'HR管理员', '管理员工、部门、岗位、请假'
WHERE NOT EXISTS (SELECT 1 FROM sys_role WHERE role_code = 'HR');

INSERT INTO sys_role (role_code, role_name, description)
SELECT 'EMPLOYEE', '普通员工', '查看个人信息与提交请假'
WHERE NOT EXISTS (SELECT 1 FROM sys_role WHERE role_code = 'EMPLOYEE');

INSERT INTO sys_permission (permission_code, permission_name, description)
SELECT 'user.manage', '用户管理', '增删改查用户'
WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE permission_code = 'user.manage');

INSERT INTO sys_permission (permission_code, permission_name, description)
SELECT 'employee.manage', '员工管理', '增删改查员工'
WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE permission_code = 'employee.manage');

INSERT INTO sys_permission (permission_code, permission_name, description)
SELECT 'department.manage', '部门管理', '增删改查部门'
WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE permission_code = 'department.manage');

INSERT INTO sys_permission (permission_code, permission_name, description)
SELECT 'leave.manage', '请假管理', '审批和管理请假'
WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE permission_code = 'leave.manage');

INSERT INTO sys_permission (permission_code, permission_name, description)
SELECT 'audit.view', '审计查看', '查看审计日志'
WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE permission_code = 'audit.view');

INSERT INTO department (department_name, manager_name)
SELECT '研发部', '张主管'
WHERE NOT EXISTS (SELECT 1 FROM department WHERE department_name = '研发部');

INSERT INTO department (department_name, manager_name)
SELECT '人事部', '李主管'
WHERE NOT EXISTS (SELECT 1 FROM department WHERE department_name = '人事部');

INSERT INTO department (department_name, manager_name)
SELECT '市场部', '王主管'
WHERE NOT EXISTS (SELECT 1 FROM department WHERE department_name = '市场部');

INSERT INTO position (position_name, level_name, description)
SELECT '后端开发工程师', 'P2', '负责后端开发'
WHERE NOT EXISTS (SELECT 1 FROM position WHERE position_name = '后端开发工程师');

INSERT INTO position (position_name, level_name, description)
SELECT 'HR专员', 'P1', '负责人事相关事务'
WHERE NOT EXISTS (SELECT 1 FROM position WHERE position_name = 'HR专员');

INSERT INTO position (position_name, level_name, description)
SELECT '市场专员', 'P1', '负责市场推广'
WHERE NOT EXISTS (SELECT 1 FROM position WHERE position_name = '市场专员');

INSERT INTO sys_user (username, password_hash, full_name, status)
SELECT 'admin', 'demo_admin_hash', '系统管理员', 1
WHERE NOT EXISTS (SELECT 1 FROM sys_user WHERE username = 'admin');

INSERT INTO sys_user (username, password_hash, full_name, status)
SELECT 'hr01', 'demo_hr_hash', '人事管理员', 1
WHERE NOT EXISTS (SELECT 1 FROM sys_user WHERE username = 'hr01');

INSERT INTO sys_user (username, password_hash, full_name, status)
SELECT 'emp01', 'demo_emp_hash', '普通员工', 1
WHERE NOT EXISTS (SELECT 1 FROM sys_user WHERE username = 'emp01');

INSERT INTO employee (employee_no, full_name, gender, phone, email, hire_date, employment_status, department_id, position_id)
SELECT 'E2026001', '陈晨', 'M', '13800000001', 'chenchen@example.com', DATE '2026-01-10', 'active',
       (SELECT department_id FROM department WHERE department_name = '研发部'),
       (SELECT position_id FROM position WHERE position_name = '后端开发工程师')
WHERE NOT EXISTS (SELECT 1 FROM employee WHERE employee_no = 'E2026001');

INSERT INTO employee (employee_no, full_name, gender, phone, email, hire_date, employment_status, department_id, position_id)
SELECT 'E2026002', '林雨', 'F', '13800000002', 'linyu@example.com', DATE '2026-02-15', 'active',
       (SELECT department_id FROM department WHERE department_name = '人事部'),
       (SELECT position_id FROM position WHERE position_name = 'HR专员')
WHERE NOT EXISTS (SELECT 1 FROM employee WHERE employee_no = 'E2026002');

INSERT INTO leave_request (employee_id, leave_type, start_date, end_date, reason, approval_status)
SELECT (SELECT employee_id FROM employee WHERE employee_no = 'E2026001'), 'annual', DATE '2026-04-15', DATE '2026-04-16', '个人事务', 'pending'
WHERE NOT EXISTS (
    SELECT 1 FROM leave_request
    WHERE employee_id = (SELECT employee_id FROM employee WHERE employee_no = 'E2026001')
      AND start_date = DATE '2026-04-15'
);

INSERT INTO leave_request (employee_id, leave_type, start_date, end_date, reason, approval_status)
SELECT (SELECT employee_id FROM employee WHERE employee_no = 'E2026002'), 'sick', DATE '2026-04-20', DATE '2026-04-21', '身体不适', 'approved'
WHERE NOT EXISTS (
    SELECT 1 FROM leave_request
    WHERE employee_id = (SELECT employee_id FROM employee WHERE employee_no = 'E2026002')
      AND start_date = DATE '2026-04-20'
);
