-- 1. 查询所有员工及其部门、岗位
SELECT
    e.employee_no,
    e.full_name,
    d.department_name,
    p.position_name,
    e.employment_status
FROM employee e
LEFT JOIN department d ON e.department_id = d.department_id
LEFT JOIN position p ON e.position_id = p.position_id
ORDER BY e.employee_no;

-- 2. 按关键字模糊查询员工
SELECT
    employee_no,
    full_name,
    phone,
    email
FROM employee
WHERE employee_no LIKE '%E2026%'
   OR full_name LIKE '%陈%';

-- 3. 按部门筛选员工
SELECT
    e.employee_no,
    e.full_name,
    d.department_name
FROM employee e
JOIN department d ON e.department_id = d.department_id
WHERE d.department_name = '研发部';

-- 4. 查询待审批请假
SELECT
    l.leave_id,
    e.full_name,
    l.leave_type,
    l.start_date,
    l.end_date,
    l.approval_status
FROM leave_request l
JOIN employee e ON l.employee_id = e.employee_id
WHERE l.approval_status = 'pending'
ORDER BY l.start_date;

-- 5. 查询当前角色配置
SELECT
    u.username,
    r.role_code,
    r.role_name
FROM sys_user u
JOIN sys_user_role ur ON u.user_id = ur.user_id
JOIN sys_role r ON ur.role_id = r.role_id
ORDER BY u.username;
