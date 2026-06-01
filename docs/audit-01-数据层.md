# 数据层审查报告 (audit-01)

审查日期：2026-06-01
审查范围：employee / employee_skill / attendance_record / performance_review / employee_project

---

## 1. 整体数据量一览

| 表 | 记录数 | 有数据员工数 (active+probation) | 覆盖率 |
|---|---|---|---|
| employee | 60 总 (49 active + 3 probation + 8 resigned) | 52 | — |
| employee_skill | 202 | 52 / 52 | **100%** |
| attendance_record | **5** | 5 / 52 | **9.6%** |
| performance_review | 104 | 52 / 52 | **100%** |
| employee_project | **7** | 5 / 52 | **9.6%** |

技能目录：8 个 skill_category，35 个 skill。

---

## 2. 每列审查

### 2.1 employee (24 列)

```
employee_id             bigint
employee_no             varchar
full_name               varchar
gender                  char
phone                   varchar
email                   varchar
hire_date               timestamp
employment_status       varchar
department_id           bigint
position_id             bigint
created_at              timestamp
birth_date              timestamp
id_card_no              varchar
employment_type         varchar
manager_employee_id     bigint
tenure                  integer          ← ML 特征
engagement_score        smallint         ← ML 特征 (avg=74.25, min=47, max=94)
last_promotion_months   integer          ← ML 特征 (avg=13.4)
manager_changes         integer          ← ML 特征 (avg=0.81)
overtime_count          integer          ← ML 特征 (avg=5.42)
attrition_flag          smallint
attendance_absent_count  integer          ← 物化列，全部为 0
attendance_late_count    integer          ← 物化列，全部为 0
avg_performance_score    numeric          ← 物化列，来自 performance_review (avg=70)
```

### 2.2 employee_skill (13 列)

```
employee_skill_id   bigint (PK)
employee_id         bigint (FK → employee)
skill_id            bigint (FK → skill)
proficiency_level   smallint (1-5)
acquired_from       varchar (self/manager/inferred/...)
is_core             boolean
acquired_date       timestamp
last_used_date      timestamp
is_inferred         boolean
confirmed_by        bigint (FK → employee)
confirmed_at        timestamp
created_at          timestamp
updated_at          timestamp
```

### 2.3 attendance_record (7 列)

```
record_id    bigint (PK)
employee_id  bigint (FK → employee)
record_date  timestamp
clock_in     timestamp
clock_out    timestamp
status       varchar (当前仅有 'late'，占全部 5 条)
created_at   timestamp
```

### 2.4 performance_review (9 列)

```
review_id       bigint (PK)
employee_id     bigint (FK → employee)
reviewer_id     bigint (FK → employee)
review_period   varchar
rating          smallint
score           numeric (range: 65-75, avg=70)
comments        text
status          varchar (全部 'submitted')
created_at      timestamp
```

### 2.5 employee_project (7 列)

```
project_id      bigint (PK)
project_name    varchar
employee_id     bigint (FK → employee)
role            varchar
start_date      timestamp
end_date        timestamp
description     text
```

---

## 3. 关键发现

### 3.1 考勤数据 (attendance_record) —— 严重不足

- **仅 5 条记录**，全部是 `status='late'`，覆盖 5 名员工。
- 另外 47 名 active+probation 员工在 `attendance_record` 中完全没有数据。
- employee 表上的 `attendance_absent_count` / `attendance_late_count` 物化列**全部为 0**。
- 这导致 attrition 模型中的 `absent_count/10 * 0.05` 和 `late_count/15 * 0.05` 两个分量对 90% 的员工毫无区分度。

### 3.2 绩效数据 (performance_review) —— 有数据但乏区分度

- 104 条记录，覆盖全部 52 名员工（100%）。
- 但分数集中在 65-75 狭窄区间（avg=70, min=65, max=75），方差极小。
- 全部 `status='submitted'`，没有 `acknowledged` 状态。
- attrition 模型中的 `(5 - avg_performance/20) * 0.10` 分量在所有员工上结果几乎相同（约 1.5），**几乎没有信号**。

### 3.3 技能数据 (employee_skill) —— 覆盖率好但质量可提升

- 100% 员工有技能记录，平均每人 3.88 个技能。
- **is_inferred = false 的行数为 0**，说明 `infer_skills_from_history()` 从未成功运行，或运行后没有插入任何数据。这合理──因为 position_required_skill 表和 project_tech_stack 表也几乎没有数据。
- 只有 35 个技能 × 8 个类别，目录偏小。员工最高仅有 6 个技能（Leo Yao / Ivy Sun / Kevin He 各 6）。

### 3.4 履历数据 (employee_project) —— 严重匮乏

- **仅 7 条记录**，覆盖 5 人，覆盖率 9.6%。
- project_tech_stack 表也会为空，因此 `infer_skills_from_history()` 几乎无法从该路径推断技能。

### 3.5 ML 模型特征信号分析

| 特征 | 数据源 | 现状 | 是否有信号 |
|---|---|---|---|
| tenure | employee.tenure | 全部有值 (avg=26.08) | 有，但分布集中 |
| engagement_score | employee.engagement_score | 全部有值 (avg=74.25, 47-94) | **有一定信号** |
| last_promotion_months | employee.last_promotion_months | 全部有值 (avg=13.4) | 有 |
| manager_changes | employee.manager_changes | 全部有值 (avg=0.81) | 有 |
| overtime_count | employee.overtime_count | 全部有值 (avg=5.42) | 有 |
| absent_count | attendance_record WHERE status='absent' | **0 条记录** | **无信号** |
| late_count | attendance_record WHERE status='late' | 5 条记录覆盖 5 人 | **极弱** |
| avg_performance | performance_review AVG(score) | 全部有值但 65-75 区间 | **极弱** |

**结论**：ML 模型 8 个特征中，有 3 个（absent_count, late_count, avg_performance）在当前数据量的 52 人样本上**没有或几乎没有区分能力**。即全权重约 20%（= 5% + 5% + 10%）的风险分量事实上是常量。

---

## 4. 风险评估

### 4.1 高优先级问题

1. **attendance_record 无数据** → `_ABSENT_SQ` 子查询对 90% 员工返回 0；absent/late 风险分量失效。同时 employee.attendance_absent_count 和 attendance_late_count 物化列全部为 0，与子查询一致说明从未有写入。
2. **employee_project 无数据** → 履历追溯、技能推断（`infer_skills_from_history` 的项目路径）、项目匹配功能实质上不可用。
3. **绩效分数方差过小** → avg_performance_score 虽然全部填充，但 65-75 的 10 分跨度为模型提供的区分力极低。

### 4.2 中优先级问题

4. **技能目录偏小**（35 个）→ 员工技能匹配和差距分析受限于目录覆盖范围。
5. **performance_review 全部是 submitted，无 acknowledged** → 状态机未使用完整。
6. **无 inferred 技能** → `infer_skills_from_history` 函数存在但从未产生效果。

### 4.3 低优先级问题

7. **考勤只有 'late' 无 'absent'、'present'** → 考勤状态枚举使用不完整。
8. **员工技能平均 3.88** → 考虑到 35 个技能池，仍有较大提升空间。

---

## 5. 建议

### 近期（数据填充）

1. **补充考勤数据**：如果系统已有考勤对接，建议批量导入至少 3-6 个月的历史考勤记录。至少让每位员工有 10+ 条记录，使 absent/late 计数产生分布。
2. **补充项目数据**：为更多员工添加历史项目记录，或从现有系统迁移。project_tech_stack 需同时填充。

### 中期（模型与数据质量）

3. **扩大绩效评分分布**：让绩效评估实际产生区分度（扩大 65-75 的评分区间），或者为 review_period 增加多期数据。
4. **运行 `infer_skills_from_history`**：在 position_required_skill 填充后，对全员运行技能推断，然后由经理确认。
5. **扩展技能目录**：至少扩充到 60-80 个技能，覆盖开发、运维、产品、设计、市场等全领域。

### 远期（架构）

6. **去掉物化冗余列**（attendance_absent_count, attendance_late_count, avg_performance_score）——这些在 employee 表上的物化列与子查询 SQL 形成了双重维护路径。建议只保留子查询方式，或统一用视图/物化视图。
7. **引入更细粒度考勤状态**：present / late / absent / leave / overtime，与绩效评估的 review_period 形成季度级时间序列。
