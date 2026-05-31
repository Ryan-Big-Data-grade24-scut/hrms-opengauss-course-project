-- ============================================================
-- V9: 权限系统扩展（18 个新 scope 权限 + ANALYTICS 兼容权限）
-- ============================================================
-- 依赖: V8 schema（sys_permission 表存在）
-- 前置: 已有 8 个旧权限码（V6 已插入）
-- 执行方式: docker exec -e LD_LIBRARY_PATH=... gsql -d hrms -U omm -f V9__permissions_seed.sql
-- ============================================================

-- 1. 新增 18 个 scope 权限码 + 1 个兼容码
INSERT INTO sys_permission (permission_code, permission_name)
SELECT t.code, t.name FROM (VALUES
    -- Profile
    ('profile.view.self',   '查看个人信息'),
    ('profile.view.team',   '查看部门信息'),
    ('profile.view.all',    '查看全部信息'),
    ('profile.edit.self',   '编辑个人信息'),
    ('profile.edit.team',   '编辑部门信息'),
    ('profile.edit.all',    '编辑全部信息'),
    -- Skill
    ('skill.view.self',     '查看个人技能'),
    ('skill.manage.team',   '管理部门技能'),
    ('skill.manage.all',    '管理全部技能'),
    -- Directory
    ('directory.view',      '查看通讯录'),
    -- Attendance
    ('attendance.view.self','查看个人考勤'),
    ('attendance.view.team','查看部门考勤'),
    ('attendance.view.all', '查看全部考勤'),
    ('attendance.manage',   '管理考勤'),
    -- Performance
    ('performance.view.self','查看个人绩效'),
    ('performance.view.team','查看部门绩效'),
    -- Analytics
    ('analytics.view',      '查看分析（兼容旧路由检查）'),
    ('analytics.view.team', '查看部门分析'),
    ('analytics.view.all',  '查看全部分析'),
    -- Server route permissions (used by server.py _require_permission)
    ('skill.manage',        '管理技能目录'),
    ('attendance.view',     '查看考勤记录'),
    ('performance.view',    '查看绩效评价'),
    ('performance.manage',  '管理绩效评价'),
    ('team.view',           '查看团队信息')
) AS t(code, name)
WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE permission_code = t.code);

-- 2. ADMIN 角色获得所有权限
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.role_id, p.permission_id FROM sys_role r, sys_permission p
WHERE r.role_code = 'ADMIN'
  AND NOT EXISTS (
      SELECT 1 FROM sys_role_permission rp
      WHERE rp.role_id = r.role_id AND rp.permission_id = p.permission_id
  );

-- 3. HR 角色获得扩展权限
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.role_id, p.permission_id FROM sys_role r, sys_permission p
WHERE r.role_code = 'HR'
  AND p.permission_code IN (
      'profile.view.team', 'profile.edit.team',
      'skill.view.self', 'skill.manage.team',
      'directory.view',
      'attendance.view.team', 'attendance.manage',
      'performance.view.team',
      'analytics.view.team'
  )
  AND NOT EXISTS (
      SELECT 1 FROM sys_role_permission rp
      WHERE rp.role_id = r.role_id AND rp.permission_id = p.permission_id
  );

-- 4. EMPLOYEE 角色获得基础权限
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.role_id, p.permission_id FROM sys_role r, sys_permission p
WHERE r.role_code = 'EMPLOYEE'
  AND p.permission_code IN (
      'profile.view.self', 'profile.edit.self',
      'skill.view.self',
      'attendance.view.self',
      'performance.view.self'
  )
  AND NOT EXISTS (
      SELECT 1 FROM sys_role_permission rp
      WHERE rp.role_id = r.role_id AND rp.permission_id = p.permission_id
  );

-- 5. 验证
SELECT 'ADMIN' AS role, COUNT(*) AS permissions
FROM sys_role_permission rp JOIN sys_role r ON r.role_id = rp.role_id
WHERE r.role_code = 'ADMIN'
UNION ALL
SELECT 'HR' AS role, COUNT(*) AS permissions
FROM sys_role_permission rp JOIN sys_role r ON r.role_id = rp.role_id
WHERE r.role_code = 'HR'
UNION ALL
SELECT 'EMPLOYEE' AS role, COUNT(*) AS permissions
FROM sys_role_permission rp JOIN sys_role r ON r.role_id = rp.role_id
WHERE r.role_code = 'EMPLOYEE';

SELECT 'Total sys_permission' AS info, COUNT(*) AS cnt FROM sys_permission;
