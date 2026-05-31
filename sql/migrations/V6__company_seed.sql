INSERT INTO department (department_id, department_name, status) VALUES
(1, 'Engineering', 1), (2, 'Product', 1), (3, 'Sales & Marketing', 1), (4, 'Operations', 1);

-- ===== 2. Positions =====
INSERT INTO position (position_id, position_name, headcount) VALUES
(1, 'CEO', 1),
(2, 'VP Engineering', 1), (3, 'Engineering Manager', 3), (4, 'Senior Backend Engineer', 2),
(5, 'Backend Engineer', 4), (6, 'Senior Frontend Engineer', 2), (7, 'Frontend Engineer', 3),
(8, 'DevOps Engineer', 3), (9, 'QA Engineer', 3),
(10, 'VP Product', 1), (11, 'Product Manager', 5), (12, 'UX Designer', 4),
(13, 'Data Analyst', 4),
(14, 'VP Sales & Marketing', 1), (15, 'Sales Representative', 6), (16, 'Marketing Specialist', 5),
(17, 'Customer Success Manager', 3),
(18, 'VP Operations', 1), (19, 'HR Specialist', 3), (20, 'Accountant', 3);

-- ===== 3. Employees =====
-- Helper: INSERT function
DO $$ DECLARE eid INT; BEGIN

-- Executive
INSERT INTO employee (employee_no,full_name,gender,hire_date,employment_status,department_id,position_id,tenure,engagement_score,last_promotion_months,manager_changes,overtime_count,manager_employee_id) VALUES
('NT0001','Alex Chen','M','2021-01-15','active',1,1,52,95,3,0,0,NULL) RETURNING employee_id INTO eid;

-- Engineering
INSERT INTO employee (employee_no,full_name,gender,hire_date,employment_status,department_id,position_id,tenure,engagement_score,last_promotion_months,manager_changes,overtime_count,manager_employee_id) VALUES
('NT0002','Sarah Wang','F','2021-03-01','active',1,2,50,92,6,0,3,1),
('NT0003','Mike Zhang','M','2021-06-15','active',1,3,47,88,4,1,5,2),
('NT0004','Lisa Liu','F','2022-01-10','active',1,3,40,85,8,0,4,2),
('NT0005','Tom Li','M','2022-03-20','active',1,4,38,78,12,1,6,3),
('NT0006','Emily Wu','F','2022-06-01','active',1,4,35,90,6,0,3,3),
('NT0007','Jack Yang','M','2022-09-15','active',1,5,32,72,18,2,8,5),
('NT0008','Anna Xu','F','2023-01-10','active',1,5,28,82,10,1,4,5),
('NT0009','David Huang','M','2023-04-20','active',1,5,25,65,24,0,10,6),
('NT0010','Cathy Zhou','F','2023-07-01','active',1,5,22,88,6,1,3,6),
('NT0011','Brian Feng','M','2023-10-10','active',1,6,18,75,12,0,7,4),
('NT0012','Diana Pan','F','2023-01-15','active',1,6,28,91,4,1,2,4),
('NT0013','Frank Liang','M','2024-03-01','active',1,7,14,68,18,0,9,11),
('NT0014','Grace Xiao','F','2024-06-15','active',1,7,11,85,6,0,3,11),
('NT0015','Henry Zhu','M','2024-09-20','active',1,7,8,72,0,0,5,12),
('NT0016','Ivy Sun','F','2025-01-10','active',1,8,4,80,0,0,2,3),
('NT0017','Kevin He','M','2022-04-01','active',1,8,37,70,24,2,12,3),
('NT0018','Leo Yao','M','2025-06-01','probation',1,8,0,60,0,0,0,3),
('NT0019','Mia Tan','F','2024-11-01','active',1,9,6,82,0,0,4,3),
('NT0020','Nick Peng','M','2025-03-15','active',1,9,2,75,0,0,2,3);

-- Product
INSERT INTO employee (employee_no,full_name,gender,hire_date,employment_status,department_id,position_id,tenure,engagement_score,last_promotion_months,manager_changes,overtime_count,manager_employee_id) VALUES
('NT0021','Oscar Lin','M','2021-04-01','active',2,10,50,93,3,0,2,1),
('NT0022','Pearl Song','F','2021-08-15','active',2,11,45,87,9,1,5,21),
('NT0023','Quinn Jiang','F','2022-02-20','active',2,11,39,82,12,0,4,21),
('NT0024','Ray Ma','M','2022-11-01','active',2,11,30,76,15,2,7,22),
('NT0025','Sara Guo','F','2023-05-15','active',2,11,24,88,6,1,3,22),
('NT0026','Tommy Ruan','M','2024-01-10','active',2,11,16,70,0,0,5,23),
('NT0027','Uma Wei','F','2022-07-01','active',2,12,34,84,10,1,4,21),
('NT0028','Vince Duan','M','2023-09-20','active',2,12,20,78,6,0,3,27),
('NT0029','Wendy Luo','F','2024-04-15','active',2,12,13,90,0,0,2,27),
('NT0030','Xander Qiu','M','2025-02-01','active',2,12,3,72,0,0,0,28),
('NT0031','Yvonne Tang','F','2023-03-10','active',2,13,26,85,8,1,4,21),
('NT0032','Zack Cheng','M','2024-08-01','active',2,13,9,68,0,0,6,31),
('NT0033','Amy Fan','F','2025-05-01','probation',2,13,0,55,0,0,0,31);

-- Sales & Marketing
INSERT INTO employee (employee_no,full_name,gender,hire_date,employment_status,department_id,position_id,tenure,engagement_score,last_promotion_months,manager_changes,overtime_count,manager_employee_id) VALUES
('NT0034','Benny Cai','M','2021-05-01','active',3,14,48,88,6,0,5,1),
('NT0035','Cindy Dai','F','2022-03-15','active',3,15,38,82,12,1,8,34),
('NT0036','Derek Fu','M','2022-10-01','active',3,15,31,74,18,2,10,34),
('NT0037','Eva Gao','F','2023-04-10','active',3,15,25,65,24,1,12,35),
('NT0038','Finn Hu','M','2023-08-20','active',3,15,21,60,0,2,15,35),
('NT0039','Gina Jia','F','2024-02-01','active',3,15,15,78,0,1,5,36),
('NT0040','Hank Ke','M','2024-07-15','active',3,15,10,70,0,0,7,36),
('NT0041','Iris Lei','F','2023-01-20','active',3,16,28,80,6,2,4,34),
('NT0042','Jake Mo','M','2023-11-01','active',3,16,18,72,12,1,6,41),
('NT0043','Kyle Niu','M','2024-09-10','active',3,16,8,65,0,0,3,41),
('NT0044','Luna Ou','F','2024-12-01','active',3,17,5,85,0,0,2,34),
('NT0045','Marco Pi','M','2025-04-15','resigned',3,15,1,45,0,0,0,35);

-- Operations
INSERT INTO employee (employee_no,full_name,gender,hire_date,employment_status,department_id,position_id,tenure,engagement_score,last_promotion_months,manager_changes,overtime_count,manager_employee_id) VALUES
('NT0046','Nina Qin','F','2021-06-01','active',4,18,47,90,4,0,2,1),
('NT0047','Owen Ren','M','2022-04-15','active',4,19,37,85,10,0,3,46),
('NT0048','Penny She','F','2022-12-01','active',4,19,29,78,15,1,5,46),
('NT0049','Quincy Tao','M','2023-07-20','active',4,20,22,72,20,0,6,46),
('NT0050','Rita Wan','F','2024-05-10','active',4,20,12,82,0,0,3,49),
('NT0051','Sam Xie','M','2025-02-15','active',4,19,3,70,0,0,2,47),
('NT0052','Tina Ye','F','2025-06-01','probation',4,20,0,62,0,0,0,49),
('NT0053','Uma Zeng','F','2024-10-01','active',4,20,7,58,24,2,15,49);

-- Resigned employees (for ML training)
INSERT INTO employee (employee_no,full_name,gender,hire_date,employment_status,department_id,position_id,tenure,engagement_score,last_promotion_months,manager_changes,overtime_count,attrition_flag) VALUES
('NT0054','Victor Bao','M','2022-08-01','resigned',1,5,18,48,24,2,20,1),
('NT0055','Willa Chu','F','2023-01-15','resigned',2,11,14,52,12,1,15,1),
('NT0056','Xia Dan','M','2023-06-01','resigned',3,15,10,42,0,0,25,1),
('NT0057','Yuan Er','F','2024-03-10','resigned',1,7,6,38,0,2,18,1),
('NT0058','Zoe Fang','F','2022-11-20','resigned',4,20,8,55,12,3,12,1),
('NT0059','Bao Gong','M','2023-09-01','resigned',3,16,4,40,0,1,22,1),
('NT0060','Chao Han','M','2024-06-15','resigned',1,9,3,35,0,0,20,1);

-- Mark attrition
UPDATE employee SET attrition_flag = 1 WHERE employment_status = 'resigned';

END $$;

-- ===== 4. Skills =====
INSERT INTO skill_category (category_id, category_name, sort_order) VALUES
(1,'Programming',1),(2,'Database',2),(3,'Framework',3),(4,'Management',4),(5,'DataScience',5),
(6,'DevOps',6),(7,'Design',7),(8,'Communication',8);

INSERT INTO skill (skill_id, skill_name, category_id, description) VALUES
(1,'Python',1,'Python'),(2,'Java',1,'Java'),(3,'JavaScript',1,'JavaScript'),
(4,'TypeScript',1,'TypeScript'),(5,'Go',1,'Golang'),(6,'Rust',1,'Rust'),
(7,'SQL',2,'SQL queries'),(8,'openGauss',2,'openGauss'),(9,'PostgreSQL',2,'PostgreSQL'),
(10,'MongoDB',2,'MongoDB'),(11,'Redis',2,'Redis'),
(12,'React',3,'React'),(13,'Vue',3,'Vue.js'),(14,'Node.js',3,'Node.js'),
(15,'Django',3,'Django'),(16,'Spring',3,'Spring Boot'),
(17,'TeamMgmt',4,'Team management'),(18,'ProjectMgmt',4,'Project management'),
(19,'StrategicPlanning',4,'Strategic planning'),
(20,'DataAnalysis',5,'Data analysis'),(21,'MachineLearning',5,'Machine learning'),
(22,'Statistics',5,'Statistics'),
(23,'Docker',6,'Docker'),(24,'Kubernetes',6,'Kubernetes'),(25,'AWS',6,'AWS cloud'),
(26,'Linux',6,'Linux'),(27,'CI/CD',6,'CI/CD pipelines'),
(28,'Figma',7,'Figma'),(29,'UI/UX',7,'UI/UX design'),(30,'DesignSystem',7,'Design systems'),
(31,'Sales',8,'Sales'),(32,'CRM',8,'CRM management'),(33,'PublicSpeaking',8,'Public speaking'),
(34,'TechnicalWriting',8,'Technical writing'),(35,'Negotiation',8,'Negotiation');

-- ===== 5. Position skill requirements =====
-- CEO: management + strategy
INSERT INTO position_required_skill (position_id, skill_id, required_level, importance_weight) VALUES
(1,17,5,3),(1,19,5,3),(1,33,4,2),(1,18,4,2);
-- VP Eng: management + architecture
INSERT INTO position_required_skill (position_id, skill_id, required_level, importance_weight) VALUES
(2,17,5,3),(2,1,4,2),(2,8,3,2),(2,23,3,2);
-- Eng Manager: management + coding
INSERT INTO position_required_skill (position_id, skill_id, required_level, importance_weight) VALUES
(3,17,4,3),(3,18,4,3),(3,1,3,2),(3,3,3,2);
-- Sr Backend: deep backend
INSERT INTO position_required_skill (position_id, skill_id, required_level, importance_weight) VALUES
(4,1,5,3),(4,7,4,3),(4,8,3,2),(4,14,3,2),(4,23,3,2);
-- Backend Eng: backend skills
INSERT INTO position_required_skill (position_id, skill_id, required_level, importance_weight) VALUES
(5,1,3,3),(5,7,3,3),(5,8,2,2),(5,14,2,2);
-- Sr Frontend
INSERT INTO position_required_skill (position_id, skill_id, required_level, importance_weight) VALUES
(6,3,4,3),(6,4,4,3),(6,12,5,3),(6,13,4,2);
-- Frontend
INSERT INTO position_required_skill (position_id, skill_id, required_level, importance_weight) VALUES
(7,3,3,3),(7,12,3,3),(7,13,2,2);
-- DevOps
INSERT INTO position_required_skill (position_id, skill_id, required_level, importance_weight) VALUES
(8,23,4,3),(8,24,4,3),(8,25,4,3),(8,26,4,3),(8,27,3,2),(8,1,2,1);
-- QA
INSERT INTO position_required_skill (position_id, skill_id, required_level, importance_weight) VALUES
(9,1,2,2),(9,3,2,2),(9,7,2,2),(9,27,2,2);
-- VP Product
INSERT INTO position_required_skill (position_id, skill_id, required_level, importance_weight) VALUES
(10,19,5,3),(10,17,4,3),(10,20,4,2),(10,33,4,2);
-- PM
INSERT INTO position_required_skill (position_id, skill_id, required_level, importance_weight) VALUES
(11,18,4,3),(11,20,3,2),(11,33,3,2),(11,34,3,2);
-- UX Designer
INSERT INTO position_required_skill (position_id, skill_id, required_level, importance_weight) VALUES
(12,28,4,3),(12,29,5,3),(12,30,4,2),(12,13,2,1);
-- Data Analyst
INSERT INTO position_required_skill (position_id, skill_id, required_level, importance_weight) VALUES
(13,20,4,3),(13,22,4,3),(13,7,4,3),(13,1,3,2);
-- VP Sales
INSERT INTO position_required_skill (position_id, skill_id, required_level, importance_weight) VALUES
(14,31,5,3),(14,35,5,3),(14,17,4,3),(14,33,4,2);
-- Sales Rep
INSERT INTO position_required_skill (position_id, skill_id, required_level, importance_weight) VALUES
(15,31,4,3),(15,32,3,3),(15,35,3,2),(15,33,2,2);
-- Marketing
INSERT INTO position_required_skill (position_id, skill_id, required_level, importance_weight) VALUES
(16,20,3,3),(16,33,3,2),(16,34,3,2);
-- Customer Success
INSERT INTO position_required_skill (position_id, skill_id, required_level, importance_weight) VALUES
(17,31,3,3),(17,32,3,2),(17,33,3,2),(17,18,3,2);
-- VP Ops
INSERT INTO position_required_skill (position_id, skill_id, required_level, importance_weight) VALUES
(18,17,5,3),(18,19,4,3),(18,35,4,2);
-- HR
INSERT INTO position_required_skill (position_id, skill_id, required_level, importance_weight) VALUES
(19,17,4,3),(19,18,3,2),(19,20,2,2);
-- Accounting
INSERT INTO position_required_skill (position_id, skill_id, required_level, importance_weight) VALUES
(20,20,3,3),(20,18,3,2),(20,35,2,2);

-- ===== 6. Employee skills (simplified bulk insert) =====
TRUNCATE employee_skill CASCADE;
-- Use sys_user 1 as confirmer for all
DO $$ DECLARE
    rec RECORD;
    sid INT;
    lvl INT;
    core BOOLEAN;
    rnd INT;
BEGIN
    FOR rec IN SELECT employee_id, position_id FROM employee WHERE employment_status IN ('active','probation') LOOP
        -- Each employee gets 4-8 skills based on their position requirements
        FOR sid IN SELECT skill_id FROM position_required_skill WHERE position_id = rec.position_id LOOP
            rnd := 1 + (random() * 4)::int;
            lvl := LEAST(rnd, (SELECT required_level FROM position_required_skill WHERE position_id = rec.position_id AND skill_id = sid));
            core := (SELECT importance_weight = 3 FROM position_required_skill WHERE position_id = rec.position_id AND skill_id = sid);
            INSERT INTO employee_skill (employee_id, skill_id, proficiency_level, acquired_from, is_core, confirmed_by)
            VALUES (rec.employee_id, sid, lvl, 'project', core, NULL);
        END LOOP;
    END LOOP;
END $$;

-- ===== 7. Test accounts =====
TRUNCATE sys_user CASCADE;
INSERT INTO sys_user (user_id, username, password_hash, full_name, status) VALUES
(1,'admin','sha256$8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918','System Admin',1),
(2,'ceo','sha256$f3f1b6e7cb9130bf0c8a4c8b0b7a5f8e9c2d6a4b0c8d2e4f6a8b0c2d4e6f8a0','Alex Chen',1),
(3,'vp_eng','sha256$a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1','Sarah Wang',1),
(4,'vp_product','sha256$b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2','Oscar Lin',1),
(5,'vp_sales','sha256$c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3','Benny Cai',1),
(6,'vp_ops','sha256$d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4','Nina Qin',1),
(7,'hr_mgr','sha256$e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5','Owen Ren',1),
(8,'eng_mgr','sha256$f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6','Mike Zhang',1),
(9,'employee','sha256$a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7','Jack Yang',1);

-- Password: all set to '123456' (matching sha256 hash)
UPDATE sys_user SET password_hash = 'sha256$8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92' WHERE 1=1;

-- ===== 8. Role assignments =====
TRUNCATE sys_user_role CASCADE;
INSERT INTO sys_user_role (user_id, role_id) VALUES
(1,1), (2,1), (3,2), (4,2), (5,2), (6,2), (7,2), (8,2), (9,3);

-- ===== 9. Grant all permissions to roles =====
-- ADMIN gets everything, HR gets hr_perms, EMPLOYEE gets basic
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.role_id, p.permission_id FROM sys_role r, sys_permission p
WHERE r.role_code = 'ADMIN'
AND NOT EXISTS (SELECT 1 FROM sys_role_permission x WHERE x.role_id = r.role_id AND x.permission_id = p.permission_id);

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.role_id, p.permission_id FROM sys_role r, sys_permission p
WHERE r.role_code = 'HR' AND p.permission_code IN ('employee.manage','department.manage','leave.manage','audit.view','skill.view','predict.view')
AND NOT EXISTS (SELECT 1 FROM sys_role_permission x WHERE x.role_id = r.role_id AND x.permission_id = p.permission_id);

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.role_id, p.permission_id FROM sys_role r, sys_permission p
WHERE r.role_code = 'EMPLOYEE' AND p.permission_code = 'skill.view'
AND NOT EXISTS (SELECT 1 FROM sys_role_permission x WHERE x.role_id = r.role_id AND x.permission_id = p.permission_id);

