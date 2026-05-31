-- V10: 审批工作流（approval_request + approval_step）
-- 依赖 V8 schema（employee，sys_user 表存在）

-- 1. 审批操作类型
CREATE TABLE IF NOT EXISTS approval_action_type (
    action_type_id   SERIAL PRIMARY KEY,
    action_code      VARCHAR(50) NOT NULL UNIQUE,
    action_name      VARCHAR(100) NOT NULL,
    description      TEXT
);

-- 2. 审批链配置
CREATE TABLE IF NOT EXISTS approval_config (
    config_id        SERIAL PRIMARY KEY,
    action_code      VARCHAR(50) NOT NULL REFERENCES approval_action_type(action_code),
    step_order       SMALLINT NOT NULL,
    reviewer_role    VARCHAR(50),
    reviewer_level   SMALLINT DEFAULT 0,  -- 0=直属上级, 1=部门负责人, 2=VP, 3=HR
    max_days         SMALLINT DEFAULT 3,
    UNIQUE (action_code, step_order)
);

-- 3. 审批申请
CREATE TABLE IF NOT EXISTS approval_request (
    request_id       BIGSERIAL PRIMARY KEY,
    applicant_id     BIGINT NOT NULL REFERENCES employee(employee_id),
    action_code      VARCHAR(50) NOT NULL REFERENCES approval_action_type(action_code),
    target_type      VARCHAR(50),       -- 关联业务表名
    target_id        BIGINT,            -- 关联业务 ID
    payload          TEXT,              -- JSON 请求内容
    status           VARCHAR(20) DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','rejected','cancelled')),
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. 审批步骤
CREATE TABLE IF NOT EXISTS approval_step (
    step_id          BIGSERIAL PRIMARY KEY,
    request_id       BIGINT NOT NULL REFERENCES approval_request(request_id),
    step_order       SMALLINT NOT NULL,
    reviewer_id      BIGINT REFERENCES employee(employee_id),
    status           VARCHAR(20) DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','rejected','cancelled')),
    comment          TEXT,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acted_at         TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_approval_request_applicant ON approval_request(applicant_id);
CREATE INDEX IF NOT EXISTS idx_approval_request_status ON approval_request(status);
CREATE INDEX IF NOT EXISTS idx_approval_step_reviewer ON approval_step(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_approval_step_request ON approval_step(request_id);

-- 5. 种子数据：5 种操作类型
INSERT INTO approval_action_type (action_code, action_name, description) VALUES
('SKILL_CHANGE', '技能变更', '添加/删除/修改员工技能'),
('LEAVE_REQUEST', '请假申请', '员工请假审批'),
('ATTENDANCE_CORRECTION', '考勤补卡', '考勤异常补卡申请'),
('PERFORMANCE_REVIEW', '绩效评分', '绩效评价提交与确认'),
('PROFILE_UPDATE', '信息修改', '员工联系方式等信息修改')
ON CONFLICT (action_code) DO NOTHING;

-- 6. 种子数据：默认审批链
INSERT INTO approval_config (action_code, step_order, reviewer_role, reviewer_level) VALUES
('SKILL_CHANGE', 1, NULL, 0),           -- 直属上级
('LEAVE_REQUEST', 1, NULL, 0),          -- 直属上级
('LEAVE_REQUEST', 2, 'HR', 3),          -- HR（所有请假）
('ATTENDANCE_CORRECTION', 1, NULL, 0),  -- 直属上级
('ATTENDANCE_CORRECTION', 2, 'HR', 3),  -- HR
('PERFORMANCE_REVIEW', 1, NULL, 0),     -- 直属上级评分
('PERFORMANCE_REVIEW', 2, 'HR', 3),     -- HR校准
('PERFORMANCE_REVIEW', 3, NULL, -1),    -- 员工确认（-1 = 本人）
('PROFILE_UPDATE', 1, 'HR', 3)          -- HR
ON CONFLICT DO NOTHING;

SELECT 'V10: approval workflow seeded' AS result;
