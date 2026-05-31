-- =============================================================
-- V10__approval_workflow.sql
-- 审批工作流核心表 + 种子数据
-- 基于 redesign-v2/01-数据模型设计.md + 05-审批工作流设计.md
-- =============================================================

-- =============================================================
-- 1. approval_action_type — 审批操作类型字典
-- =============================================================
CREATE TABLE approval_action_type (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_code     VARCHAR(50)  NOT NULL UNIQUE,
    action_name     VARCHAR(100) NOT NULL,
    description     TEXT,
    category        VARCHAR(30)  NOT NULL,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    sort_order      SMALLINT     NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_approval_action_type_code     ON approval_action_type(action_code);
CREATE INDEX idx_approval_action_type_category ON approval_action_type(category);

-- =============================================================
-- 2. approval_config — 审批链配置表
-- =============================================================
CREATE TABLE approval_config (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type_id    UUID         NOT NULL REFERENCES approval_action_type(id),
    node_order        SMALLINT     NOT NULL,
    approver_role     VARCHAR(50)  NOT NULL,
    approver_scope    VARCHAR(30)  NOT NULL DEFAULT 'org',
    fallback_strategy VARCHAR(50)  NOT NULL DEFAULT 'escalate_to_hr',
    required          BOOLEAN      NOT NULL DEFAULT TRUE,
    max_timeout_hours INTEGER,
    description       TEXT,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_config_node UNIQUE (action_type_id, node_order)
);

CREATE INDEX idx_config_action_type ON approval_config(action_type_id);

-- =============================================================
-- 3. approval_request — 审批单主表
-- =============================================================
CREATE TABLE approval_request (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type_id      UUID         NOT NULL REFERENCES approval_action_type(id),
    config_id           UUID         NOT NULL REFERENCES approval_config(id),
    applicant_id        UUID         NOT NULL REFERENCES employee(id),
    target_employee_id  UUID         NOT NULL REFERENCES employee(id),
    title               VARCHAR(200) NOT NULL,
    payload             JSONB        NOT NULL,
    form_data           JSONB,
    status              VARCHAR(20)  NOT NULL DEFAULT 'draft',
    current_node_order  SMALLINT     NOT NULL DEFAULT 1,
    is_bypass           BOOLEAN      NOT NULL DEFAULT FALSE,
    version             INTEGER      NOT NULL DEFAULT 1,
    submitted_at        TIMESTAMPTZ,
    resolved_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_request_status CHECK (status IN ('draft','pending','approved','rejected','archived','recalled'))
);

CREATE INDEX idx_request_applicant    ON approval_request(applicant_id);
CREATE INDEX idx_request_target       ON approval_request(target_employee_id);
CREATE INDEX idx_request_status       ON approval_request(status) WHERE status IN ('pending','draft');
CREATE INDEX idx_request_action_type  ON approval_request(action_type_id);
CREATE INDEX idx_request_submitted    ON approval_request(submitted_at DESC) WHERE submitted_at IS NOT NULL;

-- =============================================================
-- 4. approval_step — 审批节点实例表
-- =============================================================
CREATE TABLE approval_step (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id      UUID         NOT NULL REFERENCES approval_request(id) ON DELETE CASCADE,
    node_order      SMALLINT     NOT NULL,
    approver_id     UUID         REFERENCES employee(id),
    status          VARCHAR(20)  NOT NULL DEFAULT 'pending',
    comment         TEXT,
    operated_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_step_status CHECK (status IN ('pending','approved','rejected','skipped')),
    CONSTRAINT uq_step UNIQUE (request_id, node_order)
);

CREATE INDEX idx_step_request  ON approval_step(request_id);
CREATE INDEX idx_step_approver ON approval_step(approver_id) WHERE approver_id IS NOT NULL;

-- =============================================================
-- 5. 种子数据
-- =============================================================

-- 5.1 审批操作类型（基于 01-数据模型设计.md 6.1 节，10 种初始操作类型）
INSERT INTO approval_action_type (action_code, action_name, description, category, sort_order) VALUES
('SKILL_ADD',          '添加技能',          '员工或管理员为某员工添加技能',               'SKILL',       10),
('SKILL_REMOVE',       '移除技能',          '员工或管理员为某员工移除技能',               'SKILL',       20),
('SKILL_UPDATE',       '修改技能熟练度',    '调整技能等级',                               'SKILL',       30),
('LEAVE_CREATE',       '提交请假',          '员工申请年假/病假/事假',                     'LEAVE',       40),
('LEAVE_CANCEL',       '取消请假',          '撤回已审批的请假单',                         'LEAVE',       50),
('PERFORMANCE_SCORE',  '绩效评分',          '上级为下属填写或修改绩效评分',               'PERFORMANCE', 60),
('ATTENDANCE_PUNCH',   '考勤打卡',          '员工正常打卡（自动审批）',                   'ATTENDANCE',  70),
('ATTENDANCE_RETRO',   '考勤补卡',          '员工补卡或修正打卡记录',                     'ATTENDANCE',  80),
('CONTACT_UPDATE',     '修改联系方式',      '员工更新自己的手机/邮箱/地址',               'EMPLOYEE',    90),
('POSITION_CHANGE',    '岗位调动',          '员工转岗/晋升/降级',                         'EMPLOYEE',   100);

-- 5.2 审批链配置（基于 01-数据模型设计.md 6.2 节）
INSERT INTO approval_config (action_type_id, node_order, approver_role, approver_scope, fallback_strategy, required) VALUES
-- SKILL_ADD: Node1=直属上级(必须), Node2=HR专员(知会)
((SELECT id FROM approval_action_type WHERE action_code='SKILL_ADD'), 1, 'direct_manager',  'org', 'escalate_to_hr',           TRUE),
((SELECT id FROM approval_action_type WHERE action_code='SKILL_ADD'), 2, 'hr_specialist',   'hr',  'escalate_to_hr_director', FALSE),

-- SKILL_REMOVE: 同 SKILL_ADD
((SELECT id FROM approval_action_type WHERE action_code='SKILL_REMOVE'), 1, 'direct_manager', 'org', 'escalate_to_hr',           TRUE),
((SELECT id FROM approval_action_type WHERE action_code='SKILL_REMOVE'), 2, 'hr_specialist',  'hr',  'escalate_to_hr_director', FALSE),

-- SKILL_UPDATE: 同 SKILL_ADD
((SELECT id FROM approval_action_type WHERE action_code='SKILL_UPDATE'), 1, 'direct_manager', 'org', 'escalate_to_hr',           TRUE),
((SELECT id FROM approval_action_type WHERE action_code='SKILL_UPDATE'), 2, 'hr_specialist',  'hr',  'escalate_to_hr_director', FALSE),

-- LEAVE_CREATE: Node1=直属上级(必须), Node2=HR专员(知会)
((SELECT id FROM approval_action_type WHERE action_code='LEAVE_CREATE'), 1, 'direct_manager', 'org', 'escalate_to_hr',           TRUE),
((SELECT id FROM approval_action_type WHERE action_code='LEAVE_CREATE'), 2, 'hr_specialist',  'hr',  'escalate_to_hr_director', FALSE),

-- LEAVE_CANCEL: 同 LEAVE_CREATE
((SELECT id FROM approval_action_type WHERE action_code='LEAVE_CANCEL'), 1, 'direct_manager', 'org', 'escalate_to_hr',           TRUE),
((SELECT id FROM approval_action_type WHERE action_code='LEAVE_CANCEL'), 2, 'hr_specialist',  'hr',  'escalate_to_hr_director', FALSE),

-- PERFORMANCE_SCORE: Node1=上级的上级(必须), Node2=HR总监(必须), Node3=HR专员(知会)
((SELECT id FROM approval_action_type WHERE action_code='PERFORMANCE_SCORE'), 1, 'skip_level_manager', 'org', 'escalate_to_hr_director', TRUE),
((SELECT id FROM approval_action_type WHERE action_code='PERFORMANCE_SCORE'), 2, 'hr_director',        'hr',  'escalate_to_hr_director', TRUE),
((SELECT id FROM approval_action_type WHERE action_code='PERFORMANCE_SCORE'), 3, 'hr_specialist',      'hr',  'escalate_to_hr_director', FALSE),

-- ATTENDANCE_PUNCH: 单节点-自动审批
((SELECT id FROM approval_action_type WHERE action_code='ATTENDANCE_PUNCH'), 1, 'system_auto', 'org', 'skip_node', TRUE),

-- ATTENDANCE_RETRO: Node1=直属上级(必须), Node2=HR专员(知会)
((SELECT id FROM approval_action_type WHERE action_code='ATTENDANCE_RETRO'), 1, 'direct_manager', 'org', 'escalate_to_hr',           TRUE),
((SELECT id FROM approval_action_type WHERE action_code='ATTENDANCE_RETRO'), 2, 'hr_specialist',  'hr',  'escalate_to_hr_director', FALSE),

-- CONTACT_UPDATE: Node1=直属上级(必须), Node2=HR专员(知会)
((SELECT id FROM approval_action_type WHERE action_code='CONTACT_UPDATE'), 1, 'direct_manager', 'org', 'escalate_to_hr',           TRUE),
((SELECT id FROM approval_action_type WHERE action_code='CONTACT_UPDATE'), 2, 'hr_specialist',  'hr',  'escalate_to_hr_director', FALSE),

-- POSITION_CHANGE: Node1=直属上级(必须), Node2=HR总监(必须), Node3=HR专员(知会)
((SELECT id FROM approval_action_type WHERE action_code='POSITION_CHANGE'), 1, 'direct_manager',  'org', 'escalate_to_hr_director', TRUE),
((SELECT id FROM approval_action_type WHERE action_code='POSITION_CHANGE'), 2, 'hr_director',     'hr',  'escalate_to_hr_director', TRUE),
((SELECT id FROM approval_action_type WHERE action_code='POSITION_CHANGE'), 3, 'hr_specialist',   'hr',  'escalate_to_hr_director', FALSE);
