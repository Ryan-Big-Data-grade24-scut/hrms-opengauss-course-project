-- V12: 补全缺失列 + 种子数据
-- 注意：openGauss 不支持 IF NOT EXISTS，用 DO 块绕过

-- ===================================================================
-- 1. 补全缺失列
-- ===================================================================
DO $$ BEGIN
  ALTER TABLE employee ADD COLUMN tenure INTEGER DEFAULT 0;
  EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE employee ADD COLUMN engagement_score INTEGER DEFAULT 75;
  EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE employee ADD COLUMN last_promotion_months INTEGER DEFAULT 0;
  EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE employee ADD COLUMN manager_changes INTEGER DEFAULT 0;
  EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE employee ADD COLUMN overtime_count INTEGER DEFAULT 0;
  EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE employee ADD COLUMN attendance_absent_count INTEGER DEFAULT 0;
  EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE employee ADD COLUMN attendance_late_count INTEGER DEFAULT 0;
  EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE employee ADD COLUMN avg_performance_score DECIMAL DEFAULT 0;
  EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE employee ADD COLUMN attrition_flag INTEGER DEFAULT 0;
  EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE attendance_record ADD COLUMN clock_type VARCHAR(20) DEFAULT 'normal';
  EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE attendance_record ADD COLUMN source VARCHAR(20) DEFAULT 'manual';
  EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ===================================================================
-- 2. 种子数据（无条件重建）
-- ===================================================================
-- 先清理再插入（避免 DO 块内单条失败全部回滚）
DELETE FROM approval_request; DELETE FROM approval_step;
DELETE FROM employee_skill; DELETE FROM employee_project;
DELETE FROM performance_review; DELETE FROM leave_request;
DELETE FROM attendance_record;
DELETE FROM employee;
DELETE FROM position; DELETE FROM department;
DELETE FROM skill; DELETE FROM skill_category;

INSERT INTO department (department_id, department_name, status) VALUES
(1,'Engineering',1),(2,'Product',1),(3,'Sales & Marketing',1),(4,'Operations',1);

INSERT INTO position (position_id, position_name) VALUES
(1,'CEO'),(2,'VP Engineering'),(3,'Engineering Manager'),(4,'Senior Backend Engineer'),
(5,'Backend Engineer'),(6,'Senior Frontend Engineer'),(7,'Frontend Engineer'),
(8,'DevOps Engineer'),(9,'QA Engineer'),(10,'VP Product'),(11,'Product Manager'),
(12,'UX Designer'),(13,'Data Analyst'),(14,'VP Sales & Marketing'),(15,'Sales Rep'),
(16,'Marketing'),(17,'CS Manager'),(18,'VP Operations'),(19,'HR'),(20,'Accountant');

    INSERT INTO employee (employee_id,employee_no,full_name,gender,hire_date,employment_status,department_id,position_id,tenure,engagement_score,last_promotion_months,manager_changes,overtime_count,manager_employee_id) VALUES
    (503,'NT0001','Alex Chen','M','2021-01-15','active',1,1,52,95,3,0,0,NULL),
    (504,'NT0002','Sarah Wang','F','2021-03-01','active',1,2,50,92,6,0,3,503),
    (505,'NT0003','Mike Zhang','M','2021-06-15','active',1,3,47,88,4,1,5,504),
    (506,'NT0004','Lisa Liu','F','2022-01-10','active',1,3,40,85,8,0,4,504),
    (507,'NT0005','Tom Li','M','2022-03-20','active',1,4,38,78,12,1,6,505),
    (508,'NT0006','Emily Wu','F','2022-06-01','active',1,4,35,90,6,0,3,505),
    (509,'NT0007','Jack Yang','M','2022-09-15','active',1,5,32,72,18,2,8,507),
    (510,'NT0008','Anna Xu','F','2023-01-10','active',1,5,28,65,24,0,10,507),
    (511,'NT0009','David Huang','M','2023-04-20','active',1,5,25,88,6,1,3,508),
    (512,'NT0010','Cathy Zhou','F','2023-07-01','active',1,5,22,75,12,0,7,508),
    (513,'NT0011','Brian Feng','M','2023-10-10','active',1,6,18,91,4,1,2,506),
    (514,'NT0012','Diana Pan','F','2023-01-15','active',1,6,28,68,18,0,9,506),
    (515,'NT0013','Frank Liang','M','2024-03-01','active',1,7,14,85,6,0,3,513),
    (516,'NT0014','Grace Xiao','F','2024-06-15','active',1,7,11,72,0,0,5,513),
    (517,'NT0015','Henry Zhu','M','2024-09-20','active',1,7,8,80,0,0,2,514),
    (518,'NT0016','Ivy Sun','F','2025-01-10','active',1,8,4,70,24,2,12,505),
    (519,'NT0017','Kevin He','M','2022-04-01','active',1,8,37,60,0,0,2,505),
    (520,'NT0018','Leo Yao','M','2025-06-01','probation',1,8,0,82,0,0,4,505),
    (521,'NT0019','Mia Tan','F','2024-11-01','active',1,9,6,75,0,0,2,505),
    (522,'NT0020','Nick Peng','M','2025-03-15','active',1,9,2,93,3,0,2,503),
    (523,'NT0021','Oscar Lin','M','2021-04-01','active',2,10,50,87,9,1,5,503),
    (524,'NT0022','Pearl Song','F','2021-08-15','active',2,11,45,82,12,0,4,523),
    (525,'NT0023','Quinn Jiang','F','2022-02-20','active',2,11,39,78,15,1,6,523),
    (526,'NT0024','Tommy Ruan','M','2022-07-01','active',2,11,34,85,6,0,3,524),
    (527,'NT0025','Sara Guo','F','2023-01-15','active',2,11,28,70,18,0,8,524),
    (528,'NT0026','Ray Ma','M','2023-06-01','active',2,11,23,88,3,0,2,525),
    (529,'NT0027','Uma Wei','F','2021-11-01','active',2,12,43,76,10,1,7,523),
    (530,'NT0028','Vince Duan','M','2022-04-15','active',2,12,38,53,24,2,12,523),
    (531,'NT0029','Xander Qiu','M','2023-02-20','active',2,12,27,80,6,0,4,529),
    (532,'NT0030','Wendy Luo','F','2024-07-01','active',2,12,10,72,0,0,2,529),
    (533,'NT0031','Yvonne Tang','F','2022-09-01','active',2,13,32,85,6,0,3,523),
    (534,'NT0032','Zack Cheng','M','2023-05-15','active',2,13,24,78,12,1,5,523),
    (535,'NT0033','Amy Fan','F','2024-02-01','active',2,13,15,90,0,0,1,533),
    (536,'NT0034','Benny Cai','M','2021-05-01','active',3,14,49,88,6,0,2,503),
    (537,'NT0035','Cindy Dai','F','2022-03-15','active',3,15,38,65,24,2,10,536),
    (538,'NT0036','Derek Fu','M','2022-08-01','active',3,15,33,72,18,1,8,536),
    (539,'NT0037','Eva Gao','F','2023-01-20','active',3,15,28,80,12,0,5,537),
    (540,'NT0038','Finn Hu','M','2023-06-15','active',3,15,23,45,30,2,15,537),
    (541,'NT0039','Gina Jia','F','2024-01-10','active',3,15,16,70,6,1,6,538),
    (542,'NT0040','Hank Ke','M','2024-06-01','active',3,15,11,82,0,0,3,538),
    (543,'NT0041','Iris Lei','F','2022-05-01','active',3,16,36,75,12,1,5,536),
    (544,'NT0042','Jake Mo','M','2023-03-15','active',3,16,26,85,6,0,3,536),
    (545,'NT0043','Kyle Niu','M','2024-08-01','active',3,16,9,78,0,0,2,543),
    (546,'NT0044','Luna Ou','F','2023-10-01','active',3,17,19,70,12,0,7,536),
    (547,'NT0045','Marco Pi','M','2024-04-15','active',3,17,13,82,0,0,2,536),
    (548,'NT0046','Nina Qin','F','2021-04-01','active',4,18,50,90,6,0,2,503),
    (549,'NT0047','Owen Ren','M','2021-07-15','active',4,19,46,65,24,2,10,548),
    (550,'NT0048','Penny She','F','2022-05-01','active',4,19,36,80,6,0,3,548),
    (551,'NT0049','Quincy Tao','M','2022-11-15','active',4,20,30,72,12,1,5,548),
    (552,'NT0050','Rita Wan','F','2023-05-01','active',4,20,24,85,6,0,3,551),
    (553,'NT0051','Sam Xie','M','2024-01-20','active',4,20,16,58,18,2,12,551),
    (554,'NT0052','Tina Ye','F','2024-07-01','active',4,19,10,78,0,0,2,549);

    -- 联系方式
    UPDATE employee SET phone = '13' || LPAD(CAST(70000000 + employee_id * 7 % 10000000 AS TEXT), 8, '0'), email = LOWER(REPLACE(full_name, ' ', '.')) || '@hrms.com';
    UPDATE employee SET phone = '13800138001', email = 'alex.chen@hrms.com' WHERE employee_id = 503;
    UPDATE employee SET phone = '13800138002', email = 'sarah.wang@hrms.com' WHERE employee_id = 504;

    -- 技能类别 + 技能
    INSERT INTO skill_category (category_id, category_name) VALUES
    (1,'Programming'),(2,'Database'),(3,'Framework'),(4,'DevOps'),
    (5,'Management'),(6,'Design'),(7,'DataScience'),(8,'DataAnalysis');
    INSERT INTO skill (skill_id,skill_name,category_id) VALUES
    (1,'Python',1),(2,'Java',1),(3,'JavaScript',1),(4,'Go',1),(5,'SQL',1),
    (6,'React',3),(7,'Vue',3),(8,'Angular',3),
    (9,'PostgreSQL',2),(10,'MySQL',2),(11,'Redis',2),(12,'MongoDB',2),
    (13,'Docker',4),(14,'Kubernetes',4),(15,'AWS',4),(16,'CI/CD',4),
    (17,'TeamMgmt',5),(18,'Agile',5),(19,'Communication',5),(20,'Leadership',5),
    (21,'Figma',6),(22,'Sketch',6),(23,'Photoshop',6),(24,'UI/UX',6),
    (25,'PyTorch',7),(26,'TensorFlow',7),(27,'Scikit-learn',7),(28,'NLP',7),(29,'CV',7),
    (30,'NumPy',8),(31,'Pandas',8),(32,'Tableau',8),(33,'PowerBI',8),(34,'Excel',8),(35,'Spark',8);

    -- 绩效数据（2期）
    INSERT INTO performance_review (employee_id, reviewer_id, review_period, rating, score, status)
    SELECT e.employee_id, 504, p.period, 3, 72.0, 'submitted'
    FROM employee e, (VALUES ('2025-Q4'), ('2026-Q1')) AS p(period)
    WHERE e.employment_status IN ('active','probation') AND e.employee_id <= 554
    AND e.employee_id != 504

    -- 考勤和绩效数据由 start 脚本的 Python 修复步骤补充

    -- 项目数据
    INSERT INTO employee_project (employee_id, project_name, role, start_date, end_date, description)
    SELECT e.employee_id, '团队项目-' || e.employee_id, '成员', '2025-07-01', '2025-12-31', 'Python, SQL'
    FROM employee e WHERE e.employment_status IN ('active','probation') AND e.employee_id <= 554;

SELECT 'V12: complete fix applied' AS result;
