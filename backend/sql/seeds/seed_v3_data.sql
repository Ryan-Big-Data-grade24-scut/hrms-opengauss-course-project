-- ============================================================
-- seed_v3_data.sql — V3 Data Rebuild Seed
-- Target: 52 active employees (incl. probation)
-- High-risk IDs: 505 (Mike Zhang), 510 (Anna Xu),
--                520 (Leo Yao),  530 (Vince Duan),
--                540 (Finn Hu)
-- ============================================================

BEGIN;

-- ============================================================
-- 1. ATTENDANCE DATA (1144 records = 52 employees x 22 days)
-- ============================================================
TRUNCATE attendance_record;

DO $$
DECLARE
    emp RECORD;
    work_days DATE[];
    day_count INT;
    idx INT;
    day_offset INT;
    wd DATE;
    statuses TEXT[];
BEGIN
    -- Build sorted workdays from Apr 01 to May 30, 2026
    SELECT array_agg(d ORDER BY d) INTO work_days
    FROM generate_series('2026-04-01'::date, '2026-05-30'::date, '1 day') d
    WHERE EXTRACT(DOW FROM d) NOT IN (0, 6);
    day_count := array_length(work_days, 1);

    FOR emp IN
        SELECT employee_id FROM employee
         WHERE employment_status IN ('active', 'probation')
         ORDER BY employee_id
    LOOP
        IF emp.employee_id IN (505, 510, 520, 530, 540) THEN
            -- High-risk: 12 present + 4 late + 3 absent + 3 half-day
            statuses := ARRAY['present','present','present','present',
                              'present','present','present','present',
                              'present','present','present','present',
                              'late','late','late','late',
                              'absent','absent','absent',
                              'half-day','half-day','half-day'];
        ELSE
            -- Normal: 18 present + 1 late + 1 absent + 2 half-day
            statuses := ARRAY['present','present','present','present',
                              'present','present','present','present',
                              'present','present','present','present',
                              'present','present','present','present',
                              'present','present',
                              'late','absent','half-day','half-day'];
        END IF;

        day_offset := ((emp.employee_id - 503) * 13) % day_count;

        FOR idx IN 1..22 LOOP
            wd := work_days[1 + (day_offset % day_count)];
            day_offset := day_offset + 1;

            INSERT INTO attendance_record (employee_id, record_date, clock_in, clock_out, status)
            SELECT emp.employee_id, wd,
                CASE statuses[idx]
                    WHEN 'present' THEN wd + '08:30'::time + ((random()*30)::int * interval '1 min')
                    WHEN 'late' THEN wd + '09:00'::time + ((15 + random()*45)::int * interval '1 min')
                    WHEN 'half-day' THEN
                        CASE WHEN random() < 0.5 THEN wd + '08:30'::time ELSE wd + '13:30'::time END
                    ELSE NULL
                END,
                CASE statuses[idx]
                    WHEN 'present' THEN wd + '18:00'::time + ((random()*30)::int * interval '1 min')
                    WHEN 'late' THEN wd + '18:00'::time + ((random()*30)::int * interval '1 min')
                    WHEN 'half-day' THEN
                        CASE WHEN random() < 0.5 THEN wd + '12:30'::time ELSE wd + '18:00'::time END
                    ELSE NULL
                END,
                statuses[idx]
            WHERE NOT EXISTS (
                SELECT 1 FROM attendance_record
                WHERE employee_id = emp.employee_id AND record_date = wd
            );
        END LOOP;
    END LOOP;
END $$;

-- ============================================================
-- 2. PERFORMANCE DATA — update existing 104 records
--    52 employees x (2026-Q1 + 2026-Q2)
-- ============================================================
DO $$
DECLARE
    emp RECORD;
    new_score NUMERIC(5,2);
    new_rating INT;
    new_comments TEXT;
BEGIN
    FOR emp IN
        SELECT pr.review_id, pr.employee_id, pr.review_period
          FROM performance_review pr
          JOIN employee e ON e.employee_id = pr.employee_id
    LOOP
        IF emp.employee_id IN (505, 510, 520, 530, 540) THEN
            new_score := 45 + (random() * 20);
        ELSE
            new_score := 55 + (random() * 40);
        END IF;

        new_score := ROUND(new_score::numeric, 2);

        IF new_score >= 85 THEN new_rating := 5;
        ELSIF new_score >= 70 THEN new_rating := 4;
        ELSIF new_score >= 55 THEN new_rating := 3;
        ELSE new_rating := 2;
        END IF;

        IF new_score >= 85 THEN
            new_comments := 'Outstanding performance. Consistently exceeds expectations.';
        ELSIF new_score >= 70 THEN
            new_comments := 'Solid performance. Meets all key objectives.';
        ELSIF new_score >= 55 THEN
            new_comments := 'Adequate performance. Some areas need improvement.';
        ELSE
            new_comments := 'Below expectations. Improvement plan recommended.';
        END IF;

        UPDATE performance_review
           SET score = new_score,
               rating = new_rating,
               comments = new_comments,
               status = CASE WHEN random() < 0.6 THEN 'acknowledged' ELSE 'submitted' END
         WHERE review_id = emp.review_id;
    END LOOP;
END $$;

-- ============================================================
-- 3. PROJECT DATA — add 13 records to reach 20+
--    (current 7 + 13 new = 20)
-- ============================================================
INSERT INTO employee_project
    (project_name, employee_id, role, start_date, end_date, description)
VALUES
    ('Microservices Migration', 507, 'Backend Lead',
     '2025-03-01', '2025-08-31',
     'Monolith to microservices, Python/Go, gRPC, Kafka, Redis'),

    ('Data Warehouse', 508, 'Data Engineer',
     '2025-02-01', '2025-09-30',
     'ETL pipelines, openGauss, Airflow, Star Schema'),

    ('Frontend Refresh', 514, 'Frontend Developer',
     '2025-04-01', '2025-10-31',
     'React+TypeScript migration, DesignSystem, Figma integration'),

    ('DevOps Automation', 518, 'DevOps Engineer',
     '2025-01-15', '2025-07-15',
     'CI/CD pipelines, Docker, Kubernetes, Terraform'),

    ('CRM Integration', 541, 'Developer',
     '2025-05-01', '2025-11-30',
     'Salesforce REST API, Python backend, PostgreSQL'),

    ('BI Dashboard', 533, 'Data Analyst',
     '2025-03-15', '2025-08-15',
     'Metabase dashboards, SQL optimization, Data modeling'),

    ('Mobile App v2', 512, 'Tech Lead',
     '2025-06-01', '2025-12-31',
     'React Native, TypeScript, push notifications, payment'),

    ('Security Audit', 519, 'Security Analyst',
     '2025-04-01', '2025-06-30',
     'Penetration test, OWASP, RBAC redesign, audit logging'),

    ('HR Onboarding Portal', 549, 'Project Manager',
     '2025-07-01', '2025-12-31',
     'Full-stack portal, workflow engine, document management'),

    ('Sales Analytics', 537, 'Data Analyst',
     '2025-02-01', '2025-07-31',
     'Tableau dashboards, sales KPI tracking, forecasting'),

    ('API Gateway', 511, 'Backend Engineer',
     '2025-05-01', '2025-10-31',
     'Kong gateway, rate limiting, OAuth2, API documentation'),

    ('UX Research Platform', 532, 'UX Designer',
     '2025-03-01', '2025-08-31',
     'User testing, Figma prototyping, usability audit, A/B testing'),

    ('Inventory System', 546, 'Full-Stack Developer',
     '2025-04-15', '2025-11-15',
     'Vue.js + Django, real-time tracking, barcode scanning');

-- Link projects to tech stacks
INSERT INTO project_tech_stack (project_id, skill_id)
SELECT p.project_id, s.skill_id
FROM employee_project p, skill s
WHERE p.project_name = 'Microservices Migration' AND p.employee_id = 507
  AND s.skill_name IN ('Python', 'Go', 'Redis', 'SQL')
  AND NOT EXISTS (SELECT 1 FROM project_tech_stack x WHERE x.project_id = p.project_id AND x.skill_id = s.skill_id);

INSERT INTO project_tech_stack (project_id, skill_id)
SELECT p.project_id, s.skill_id
FROM employee_project p, skill s
WHERE p.project_name = 'Data Warehouse' AND p.employee_id = 508
  AND s.skill_name IN ('Python', 'SQL', 'openGauss', 'DataAnalysis')
  AND NOT EXISTS (SELECT 1 FROM project_tech_stack x WHERE x.project_id = p.project_id AND x.skill_id = s.skill_id);

INSERT INTO project_tech_stack (project_id, skill_id)
SELECT p.project_id, s.skill_id
FROM employee_project p, skill s
WHERE p.project_name = 'Frontend Refresh' AND p.employee_id = 514
  AND s.skill_name IN ('JavaScript', 'TypeScript', 'React', 'Figma', 'UI/UX')
  AND NOT EXISTS (SELECT 1 FROM project_tech_stack x WHERE x.project_id = p.project_id AND x.skill_id = s.skill_id);

INSERT INTO project_tech_stack (project_id, skill_id)
SELECT p.project_id, s.skill_id
FROM employee_project p, skill s
WHERE p.project_name = 'DevOps Automation' AND p.employee_id = 518
  AND s.skill_name IN ('Docker', 'Kubernetes', 'AWS', 'Linux', 'CI/CD')
  AND NOT EXISTS (SELECT 1 FROM project_tech_stack x WHERE x.project_id = p.project_id AND x.skill_id = s.skill_id);

INSERT INTO project_tech_stack (project_id, skill_id)
SELECT p.project_id, s.skill_id
FROM employee_project p, skill s
WHERE p.project_name = 'CRM Integration' AND p.employee_id = 541
  AND s.skill_name IN ('Python', 'PostgreSQL', 'Sales', 'CRM')
  AND NOT EXISTS (SELECT 1 FROM project_tech_stack x WHERE x.project_id = p.project_id AND x.skill_id = s.skill_id);

INSERT INTO project_tech_stack (project_id, skill_id)
SELECT p.project_id, s.skill_id
FROM employee_project p, skill s
WHERE p.project_name = 'BI Dashboard' AND p.employee_id = 533
  AND s.skill_name IN ('SQL', 'DataAnalysis', 'Statistics')
  AND NOT EXISTS (SELECT 1 FROM project_tech_stack x WHERE x.project_id = p.project_id AND x.skill_id = s.skill_id);

INSERT INTO project_tech_stack (project_id, skill_id)
SELECT p.project_id, s.skill_id
FROM employee_project p, skill s
WHERE p.project_name = 'Mobile App v2' AND p.employee_id = 512
  AND s.skill_name IN ('JavaScript', 'TypeScript', 'ProjectMgmt', 'React')
  AND NOT EXISTS (SELECT 1 FROM project_tech_stack x WHERE x.project_id = p.project_id AND x.skill_id = s.skill_id);

INSERT INTO project_tech_stack (project_id, skill_id)
SELECT p.project_id, s.skill_id
FROM employee_project p, skill s
WHERE p.project_name = 'Security Audit' AND p.employee_id = 519
  AND s.skill_name IN ('Linux', 'CI/CD')
  AND NOT EXISTS (SELECT 1 FROM project_tech_stack x WHERE x.project_id = p.project_id AND x.skill_id = s.skill_id);

INSERT INTO project_tech_stack (project_id, skill_id)
SELECT p.project_id, s.skill_id
FROM employee_project p, skill s
WHERE p.project_name = 'HR Onboarding Portal' AND p.employee_id = 549
  AND s.skill_name IN ('React', 'ProjectMgmt', 'TeamMgmt')
  AND NOT EXISTS (SELECT 1 FROM project_tech_stack x WHERE x.project_id = p.project_id AND x.skill_id = s.skill_id);

INSERT INTO project_tech_stack (project_id, skill_id)
SELECT p.project_id, s.skill_id
FROM employee_project p, skill s
WHERE p.project_name = 'Sales Analytics' AND p.employee_id = 537
  AND s.skill_name IN ('SQL', 'DataAnalysis', 'Statistics', 'Sales')
  AND NOT EXISTS (SELECT 1 FROM project_tech_stack x WHERE x.project_id = p.project_id AND x.skill_id = s.skill_id);

INSERT INTO project_tech_stack (project_id, skill_id)
SELECT p.project_id, s.skill_id
FROM employee_project p, skill s
WHERE p.project_name = 'API Gateway' AND p.employee_id = 511
  AND s.skill_name IN ('Python', 'Go', 'openGauss', 'Docker')
  AND NOT EXISTS (SELECT 1 FROM project_tech_stack x WHERE x.project_id = p.project_id AND x.skill_id = s.skill_id);

INSERT INTO project_tech_stack (project_id, skill_id)
SELECT p.project_id, s.skill_id
FROM employee_project p, skill s
WHERE p.project_name = 'UX Research Platform' AND p.employee_id = 532
  AND s.skill_name IN ('Vue', 'Figma', 'UI/UX', 'DesignSystem')
  AND NOT EXISTS (SELECT 1 FROM project_tech_stack x WHERE x.project_id = p.project_id AND x.skill_id = s.skill_id);

INSERT INTO project_tech_stack (project_id, skill_id)
SELECT p.project_id, s.skill_id
FROM employee_project p, skill s
WHERE p.project_name = 'Inventory System' AND p.employee_id = 546
  AND s.skill_name IN ('Python', 'SQL', 'MongoDB', 'Vue', 'Django')
  AND NOT EXISTS (SELECT 1 FROM project_tech_stack x WHERE x.project_id = p.project_id AND x.skill_id = s.skill_id);

-- ============================================================
-- 4. SKILL DATA — ensure each active employee has 3-5 skills
--    Employees with < 4 skills get +1 inferred skills
-- ============================================================
DO $$
DECLARE
    emp RECORD;
    chosen INT;
    cnt INT;
    max_attempts INT;
    attempts INT;
BEGIN
    FOR emp IN
        SELECT e.employee_id, COUNT(es.employee_skill_id) AS skill_cnt
          FROM employee e
          LEFT JOIN employee_skill es ON es.employee_id = e.employee_id
         WHERE e.employment_status IN ('active', 'probation')
         GROUP BY e.employee_id
         HAVING COUNT(es.employee_skill_id) < 4
    LOOP
        cnt := 4 - emp.skill_cnt;
        WHILE cnt > 0 LOOP
            chosen := 1 + (random() * 34)::int;
            INSERT INTO employee_skill (employee_id, skill_id, proficiency_level, acquired_from, is_core, is_inferred, confirmed_by)
            SELECT emp.employee_id, chosen, 1 + (random() * 4)::int, 'self', false, true, 1
            WHERE NOT EXISTS (
                SELECT 1 FROM employee_skill x
                WHERE x.employee_id = emp.employee_id
                  AND x.skill_id = chosen
                  AND x.acquired_from = 'self'
            );
            IF FOUND THEN cnt := cnt - 1; END IF;
        END LOOP;
    END LOOP;

    -- Add +1 inferred skill to employees with < 5 skills
    FOR emp IN
        SELECT e.employee_id, COUNT(es.employee_skill_id) AS skill_cnt
          FROM employee e
          LEFT JOIN employee_skill es ON es.employee_id = e.employee_id
         WHERE e.employment_status IN ('active', 'probation')
         GROUP BY e.employee_id
         HAVING COUNT(es.employee_skill_id) < 5
    LOOP
        max_attempts := 50;
        attempts := 0;
        LOOP
            chosen := 1 + (random() * 34)::int;
            INSERT INTO employee_skill (employee_id, skill_id, proficiency_level, acquired_from, is_core, is_inferred, confirmed_by)
            SELECT emp.employee_id, chosen, 1 + (random() * 4)::int, 'self', false, true, 1
            WHERE NOT EXISTS (
                SELECT 1 FROM employee_skill x
                WHERE x.employee_id = emp.employee_id
                  AND x.skill_id = chosen
                  AND x.acquired_from = 'self'
            );
            EXIT WHEN FOUND OR attempts >= max_attempts;
            attempts := attempts + 1;
        END LOOP;
    END LOOP;
END $$;

COMMIT;
