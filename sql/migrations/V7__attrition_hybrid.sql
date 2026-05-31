-- V7: Attrition risk hybrid engine
-- Adds attrition_history table for risk trend tracking.
-- Depends on V5 (employee attrition columns) and V6 (company seed data).

CREATE TABLE IF NOT EXISTS attrition_history (
    history_id          BIGSERIAL PRIMARY KEY,
    employee_id         BIGINT NOT NULL REFERENCES employee(employee_id) ON DELETE CASCADE,
    snapshot_date       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    risk_score          DECIMAL(6,4) NOT NULL,       -- composite 0-1
    risk_level          VARCHAR(20) NOT NULL,         -- low | medium | high | critical

    -- Component breakdown (for trend drilling)
    engagement_risk     DECIMAL(6,4) DEFAULT 0,
    tenure_risk         DECIMAL(6,4) DEFAULT 0,
    promotion_risk      DECIMAL(6,4) DEFAULT 0,
    manager_change_risk DECIMAL(6,4) DEFAULT 0,
    overtime_risk       DECIMAL(6,4) DEFAULT 0,

    -- Snapshot of raw inputs at capture time
    tenure              INTEGER DEFAULT 0,
    engagement_score    SMALLINT DEFAULT 75,
    last_promotion_months INTEGER DEFAULT 12,
    manager_changes     INTEGER DEFAULT 0,
    overtime_count      INTEGER DEFAULT 0,

    -- Computed convenience
    risk_score_pct      DECIMAL(5,1) GENERATED ALWAYS AS (risk_score * 100) STORED
);

CREATE INDEX IF NOT EXISTS idx_attrition_history_employee   ON attrition_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_attrition_history_snapshot    ON attrition_history(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_attrition_history_risk_level  ON attrition_history(risk_level);
CREATE INDEX IF NOT EXISTS idx_attrition_history_emp_date    ON attrition_history(employee_id, snapshot_date);
