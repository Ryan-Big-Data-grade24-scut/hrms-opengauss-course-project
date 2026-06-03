-- V11: 修复审批流表结构与服务的 schema 不匹配
-- 为 V10 表添加服务期望的列
-- 注意：openGauss 不支持 IF NOT EXISTS / ON CONFLICT DO NOTHING

-- ===================================================================
-- 1. approval_config：添加服务期望的列
-- ===================================================================
ALTER TABLE approval_config ADD COLUMN operation_type     VARCHAR(50);
ALTER TABLE approval_config ADD COLUMN node_order         SMALLINT;
ALTER TABLE approval_config ADD COLUMN approver_role      VARCHAR(50);
ALTER TABLE approval_config ADD COLUMN approver_resolver  VARCHAR(50);
ALTER TABLE approval_config ADD COLUMN fallback_strategy  VARCHAR(50) DEFAULT 'escalate';
ALTER TABLE approval_config ADD COLUMN required           BOOLEAN DEFAULT TRUE;
ALTER TABLE approval_config ADD COLUMN node_label         VARCHAR(100);

-- 从 V10 已有列迁移数据到新列
UPDATE approval_config SET
    operation_type = action_code,
    node_order     = step_order,
    approver_role  = CASE
        WHEN reviewer_role IS NOT NULL THEN reviewer_role
        WHEN reviewer_level = 0 THEN 'direct_manager'
        WHEN reviewer_level = -1 THEN 'employee_self'
        WHEN reviewer_level = 3 THEN 'hr_specialist'
        ELSE 'direct_manager'
    END;

-- 设置 node_label
UPDATE approval_config SET node_label = '直属上级审批' WHERE approver_role = 'direct_manager' AND node_label IS NULL;
UPDATE approval_config SET node_label = 'HR 审批' WHERE approver_role = 'hr_specialist' AND node_label IS NULL;
UPDATE approval_config SET node_label = '本人确认' WHERE approver_role = 'employee_self' AND node_label IS NULL;
UPDATE approval_config SET node_label = '审批' WHERE node_label IS NULL;

-- ===================================================================
-- 2. approval_request：添加服务期望的列
-- ===================================================================
ALTER TABLE approval_request ADD COLUMN operation_type  VARCHAR(50);
ALTER TABLE approval_request ADD COLUMN target_emp_id   BIGINT;
ALTER TABLE approval_request ADD COLUMN current_node    INT DEFAULT 1;
ALTER TABLE approval_request ADD COLUMN chain_snapshot  TEXT;
ALTER TABLE approval_request ADD COLUMN version         INT DEFAULT 1;

-- 从已有列同步数据
UPDATE approval_request SET
    operation_type = action_code,
    target_emp_id  = target_id;

-- ===================================================================
-- 3. 修正 CHECK 约束：允许 'recalled' 状态
-- ===================================================================
ALTER TABLE approval_request DROP CONSTRAINT IF EXISTS approval_request_status_check;
ALTER TABLE approval_request ADD CONSTRAINT approval_request_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'recalled'));

-- ===================================================================
-- 4. 为 approval_action_type 添加更多操作类型
-- ===================================================================
INSERT INTO approval_action_type (action_code, action_name, description)
SELECT 'SKILL_ADD', '添加技能', '新增员工技能'
WHERE NOT EXISTS (SELECT 1 FROM approval_action_type WHERE action_code = 'SKILL_ADD');

INSERT INTO approval_action_type (action_code, action_name, description)
SELECT 'SKILL_REMOVE', '移除技能', '删除员工技能'
WHERE NOT EXISTS (SELECT 1 FROM approval_action_type WHERE action_code = 'SKILL_REMOVE');

INSERT INTO approval_action_type (action_code, action_name, description)
SELECT 'SKILL_UPDATE', '修改技能等级', '修改员工技能熟练度'
WHERE NOT EXISTS (SELECT 1 FROM approval_action_type WHERE action_code = 'SKILL_UPDATE');

INSERT INTO approval_action_type (action_code, action_name, description)
SELECT 'LEAVE_CREATE', '请假申请', '员工请假'
WHERE NOT EXISTS (SELECT 1 FROM approval_action_type WHERE action_code = 'LEAVE_CREATE');

INSERT INTO approval_action_type (action_code, action_name, description)
SELECT 'ATTENDANCE_RETRO', '考勤补卡', '考勤异常补卡'
WHERE NOT EXISTS (SELECT 1 FROM approval_action_type WHERE action_code = 'ATTENDANCE_RETRO');

INSERT INTO approval_action_type (action_code, action_name, description)
SELECT 'CONTACT_UPDATE', '修改联系方式', '修改员工手机/邮箱'
WHERE NOT EXISTS (SELECT 1 FROM approval_action_type WHERE action_code = 'CONTACT_UPDATE');

-- ===================================================================
-- 5. 为新增操作类型添加默认审批链
-- ===================================================================
INSERT INTO approval_config (action_code, step_order, reviewer_role, reviewer_level,
                             operation_type, node_order, approver_role, node_label)
SELECT 'SKILL_ADD', 1, NULL, 0, 'SKILL_ADD', 1, 'direct_manager', '直属上级审批'
WHERE NOT EXISTS (SELECT 1 FROM approval_config WHERE action_code = 'SKILL_ADD' AND step_order = 1);

INSERT INTO approval_config (action_code, step_order, reviewer_role, reviewer_level,
                             operation_type, node_order, approver_role, node_label)
SELECT 'SKILL_ADD', 2, 'HR', 3, 'SKILL_ADD', 2, 'hr_specialist', 'HR 审批'
WHERE NOT EXISTS (SELECT 1 FROM approval_config WHERE action_code = 'SKILL_ADD' AND step_order = 2);

INSERT INTO approval_config (action_code, step_order, reviewer_role, reviewer_level,
                             operation_type, node_order, approver_role, node_label)
SELECT 'SKILL_REMOVE', 1, NULL, 0, 'SKILL_REMOVE', 1, 'direct_manager', '直属上级审批'
WHERE NOT EXISTS (SELECT 1 FROM approval_config WHERE action_code = 'SKILL_REMOVE' AND step_order = 1);

INSERT INTO approval_config (action_code, step_order, reviewer_role, reviewer_level,
                             operation_type, node_order, approver_role, node_label)
SELECT 'SKILL_REMOVE', 2, 'HR', 3, 'SKILL_REMOVE', 2, 'hr_specialist', 'HR 审批'
WHERE NOT EXISTS (SELECT 1 FROM approval_config WHERE action_code = 'SKILL_REMOVE' AND step_order = 2);

INSERT INTO approval_config (action_code, step_order, reviewer_role, reviewer_level,
                             operation_type, node_order, approver_role, node_label)
SELECT 'SKILL_UPDATE', 1, NULL, 0, 'SKILL_UPDATE', 1, 'direct_manager', '直属上级审批'
WHERE NOT EXISTS (SELECT 1 FROM approval_config WHERE action_code = 'SKILL_UPDATE' AND step_order = 1);

INSERT INTO approval_config (action_code, step_order, reviewer_role, reviewer_level,
                             operation_type, node_order, approver_role, node_label)
SELECT 'LEAVE_CREATE', 1, NULL, 0, 'LEAVE_CREATE', 1, 'direct_manager', '直属上级审批'
WHERE NOT EXISTS (SELECT 1 FROM approval_config WHERE action_code = 'LEAVE_CREATE' AND step_order = 1);

INSERT INTO approval_config (action_code, step_order, reviewer_role, reviewer_level,
                             operation_type, node_order, approver_role, node_label)
SELECT 'LEAVE_CREATE', 2, 'HR', 3, 'LEAVE_CREATE', 2, 'hr_specialist', 'HR 审批'
WHERE NOT EXISTS (SELECT 1 FROM approval_config WHERE action_code = 'LEAVE_CREATE' AND step_order = 2);

INSERT INTO approval_config (action_code, step_order, reviewer_role, reviewer_level,
                             operation_type, node_order, approver_role, node_label)
SELECT 'ATTENDANCE_RETRO', 1, NULL, 0, 'ATTENDANCE_RETRO', 1, 'direct_manager', '直属上级审批'
WHERE NOT EXISTS (SELECT 1 FROM approval_config WHERE action_code = 'ATTENDANCE_RETRO' AND step_order = 1);

INSERT INTO approval_config (action_code, step_order, reviewer_role, reviewer_level,
                             operation_type, node_order, approver_role, node_label)
SELECT 'ATTENDANCE_RETRO', 2, 'HR', 3, 'ATTENDANCE_RETRO', 2, 'hr_specialist', 'HR 审批'
WHERE NOT EXISTS (SELECT 1 FROM approval_config WHERE action_code = 'ATTENDANCE_RETRO' AND step_order = 2);

INSERT INTO approval_config (action_code, step_order, reviewer_role, reviewer_level,
                             operation_type, node_order, approver_role, node_label)
SELECT 'CONTACT_UPDATE', 1, 'HR', 3, 'CONTACT_UPDATE', 1, 'hr_specialist', 'HR 审批'
WHERE NOT EXISTS (SELECT 1 FROM approval_config WHERE action_code = 'CONTACT_UPDATE' AND step_order = 1);

SELECT 'V11: approval schema fixed' AS result;
