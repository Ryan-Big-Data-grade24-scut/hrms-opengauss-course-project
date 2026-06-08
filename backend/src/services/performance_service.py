"""绩效评估服务：绩效 CRUD、汇总统计、趋势分析。

数据表：performance_review（V8 创建，V9 增强）
  - V9 新增字段：score_technical, score_communication, score_leadership,
    score_collaboration, reviewer_comment, employee_comment

约束（V9）：
  - UNIQUE (employee_id, review_period) —— 每人每周期一次
  - reviewer_id != employee_id —— 不能自评
  - score BETWEEN 0 AND 100
  - status IN ('draft', 'submitted', 'acknowledged')

权限范围：
  - performance.view（查看）+ performance.manage（创建/更新）
  - 管理员/HR：所有部门
  - 经理：本部门
  - 员工：仅自己的绩效
"""

from src.common.db import execute, json_array_query, json_object_query, query_scalar, sql_literal
from src.common.permission import _require_permission_scope
from src.services.audit_service import write_audit


# ===================================================================
# 绩效 CRUD
# ===================================================================

def create_review(payload, actor):
    """创建绩效评估。

    参数：
        payload: {
            "employee_id": int,           # (必填) 被评估人
            "reviewer_id": int,           # (可选, 默认同 employee_id)
            "review_period": "2026-Q1",   # (必填) 评估周期
            "rating": 4,                  # (可选) 1-5 分
            "score": 85.5,                # (可选) 0-100
            "score_technical": 88.0,      # (可选, V9) 技术分
            "score_communication": 82.0,  # (可选, V9) 沟通分
            "score_leadership": 75.0,     # (可选, V9) 领导力分
            "score_collaboration": 90.0,  # (可选, V9) 协作分
            "strengths": "...",           # (可选) 优点
            "improvements": "...",        # (可选) 待改进
            "goals": "...",               # (可选) 目标
            "reviewer_comment": "...",    # (可选, V9) 评审者私密备注
            "employee_comment": "...",    # (可选, V9) 员工自评回应
            "status": "draft"             # (可选, 默认 draft)
        }

    约束：
        - rating 必须为 1-5（若提供）
        - score 必须为 0-100（若提供）
        - reviewer_id != employee_id
    """
    employee_id = int(payload["employee_id"])
    reviewer_id = int(payload.get("reviewer_id", employee_id))
    review_period = payload["review_period"]

    if reviewer_id == employee_id:
        raise ValueError("reviewer_id cannot be the same as employee_id (self-review not allowed)")

    rating = int(payload["rating"]) if payload.get("rating") is not None else None
    score = float(payload["score"]) if payload.get("score") is not None else None
    score_technical = float(payload["score_technical"]) if payload.get("score_technical") is not None else None
    score_communication = float(payload["score_communication"]) if payload.get("score_communication") is not None else None
    score_leadership = float(payload["score_leadership"]) if payload.get("score_leadership") is not None else None
    score_collaboration = float(payload["score_collaboration"]) if payload.get("score_collaboration") is not None else None

    if rating is not None and (rating < 1 or rating > 5):
        raise ValueError("rating must be between 1 and 5")
    if score is not None and (score < 0 or score > 100):
        raise ValueError("score must be between 0 and 100")

    strengths = payload.get("strengths")
    improvements = payload.get("improvements")
    goals = payload.get("goals")
    reviewer_comment = payload.get("reviewer_comment")
    employee_comment = payload.get("employee_comment")
    status = payload.get("status", "draft")

    sql = f"""
        INSERT INTO performance_review
            (employee_id, reviewer_id, review_period,
             rating, score,
             score_technical, score_communication,
             score_leadership, score_collaboration,
             strengths, improvements, goals,
             reviewer_comment, employee_comment,
             status)
        VALUES
            ({int(employee_id)}, {int(reviewer_id)},
             {sql_literal(review_period)},
             {sql_literal(rating)}, {sql_literal(score)},
             {sql_literal(score_technical)}, {sql_literal(score_communication)},
             {sql_literal(score_leadership)}, {sql_literal(score_collaboration)},
             {sql_literal(strengths)}, {sql_literal(improvements)},
             {sql_literal(goals)},
             {sql_literal(reviewer_comment)}, {sql_literal(employee_comment)},
             {sql_literal(status)})
        RETURNING review_id
    """
    review_id = int(query_scalar(sql))
    write_audit(actor, "create", "performance_review", str(review_id),
                f"created review for employee {employee_id} period {review_period}")
    return get_review(review_id)


def get_review(review_id):
    """获取单条绩效评估（含员工/评审者信息）。"""
    return json_object_query(f"""
        SELECT pr.*, e.employee_no, e.full_name AS employee_name,
               rv.employee_no AS reviewer_no, rv.full_name AS reviewer_name,
               d.department_name
        FROM performance_review pr
        JOIN employee e ON e.employee_id = pr.employee_id
        JOIN employee rv ON rv.employee_id = pr.reviewer_id
        JOIN department d ON d.department_id = e.department_id
        WHERE pr.review_id = {int(review_id)}
    """)


def update_review(review_id, payload, actor):
    """更新绩效评估。

    支持部分更新，只修改提供的字段。
    V9 字段：score_technical, score_communication, score_leadership,
    score_collaboration, reviewer_comment, employee_comment

    状态流转：
      draft -> submitted -> acknowledged
      状态为 submitted 时自动记录 submitted_at
      状态为 acknowledged 时自动记录 acknowledged_at
    """
    fields = []
    for field in ("rating", "score",
                  "score_technical", "score_communication",
                  "score_leadership", "score_collaboration",
                  "strengths", "improvements", "goals",
                  "reviewer_comment", "employee_comment",
                  "status"):
        if field in payload:
            val = payload[field]

            if field == "rating" and val is not None:
                val = int(val)
                if val < 1 or val > 5:
                    raise ValueError("rating must be between 1 and 5")

            if field == "score" and val is not None:
                val = float(val)
                if val < 0 or val > 100:
                    raise ValueError("score must be between 0 and 100")

            if field in ("score_technical", "score_communication",
                         "score_leadership", "score_collaboration") and val is not None:
                val = float(val)
                if val < 0 or val > 100:
                    raise ValueError(f"{field} must be between 0 and 100")

            if field == "status":
                if val == "submitted":
                    fields.append("submitted_at = CURRENT_TIMESTAMP")
                elif val == "acknowledged":
                    fields.append("acknowledged_at = CURRENT_TIMESTAMP")

            fields.append(f"{field} = {sql_literal(val)}")

    if fields:
        execute(f"""
            UPDATE performance_review
            SET {', '.join(fields)}
            WHERE review_id = {int(review_id)}
        """)
        write_audit(actor, "update", "performance_review", str(review_id),
                    "updated review")

    return get_review(review_id)


def delete_review(review_id, actor):
    """删除绩效评估。"""
    execute(f"DELETE FROM performance_review WHERE review_id = {int(review_id)}")
    write_audit(actor, "delete", "performance_review", str(review_id),
                "deleted review")
    return {"status": "deleted"}


# ===================================================================
# 绩效查询与列表
# ===================================================================

def list_reviews(page_no=1, page_size=20,
                 employee_id=None, department_id=None,
                 review_period=None, status=None,
                 manager_employee_id=None,
                 subtree_ids=None):
    """分页列出绩效评估（含筛选）。

    参数：
        page_no:             页码
        page_size:           每页条数
        employee_id:         被评估人 ID
        department_id:       部门 ID
        review_period:       评估周期（如 "2026-Q1"）
        status:              状态（draft / submitted / acknowledged）
        manager_employee_id: 上级 ID（团队视图）
        subtree_ids:         组织树节点 ID 列表（用于权限过滤）
    """
    where_parts = ["1=1"]

    if employee_id:
        where_parts.append(f"pr.employee_id = {int(employee_id)}")
    if department_id:
        where_parts.append(f"e.department_id = {int(department_id)}")
    if review_period:
        where_parts.append(f"pr.review_period = {sql_literal(review_period)}")
    if status:
        where_parts.append(f"pr.status = {sql_literal(status)}")
    if manager_employee_id:
        where_parts.append(f"e.manager_employee_id = {int(manager_employee_id)}")
    if subtree_ids:
        ids_str = ",".join(str(i) for i in subtree_ids)
        where_parts.append(f"pr.employee_id IN ({ids_str})")

    where_clause = " AND ".join(where_parts)
    offset = (page_no - 1) * page_size

    count_sql = f"""
        SELECT COUNT(*)
        FROM performance_review pr
        JOIN employee e ON e.employee_id = pr.employee_id
        WHERE {where_clause}
    """
    list_sql = f"""
        SELECT pr.review_id, pr.employee_id, pr.reviewer_id, pr.review_period,
               pr.rating, pr.score,
               pr.score_technical, pr.score_communication,
               pr.score_leadership, pr.score_collaboration,
               pr.strengths, pr.improvements, pr.goals,
               pr.reviewer_comment, pr.employee_comment,
               pr.status, pr.submitted_at, pr.acknowledged_at, pr.created_at,
               e.employee_no, e.full_name AS employee_name,
               rv.full_name AS reviewer_name,
               d.department_name
        FROM performance_review pr
        JOIN employee e ON e.employee_id = pr.employee_id
        JOIN employee rv ON rv.employee_id = pr.reviewer_id
        JOIN department d ON d.department_id = e.department_id
        WHERE {where_clause}
        ORDER BY pr.created_at DESC
        LIMIT {page_size} OFFSET {offset}
    """

    total = int(query_scalar(count_sql) or "0")
    rows = json_array_query(list_sql)
    return rows, total


def get_my_reviews(employee_id, limit=10):
    """获取当前员工的绩效（作为被评估人）。"""
    return json_array_query(f"""
        SELECT pr.review_id, pr.review_period,
               pr.rating, pr.score,
               pr.score_technical, pr.score_communication,
               pr.score_leadership, pr.score_collaboration,
               pr.strengths, pr.improvements, pr.goals,
               pr.employee_comment,
               pr.status, pr.submitted_at, pr.acknowledged_at, pr.created_at,
               rv.full_name AS reviewer_name
        FROM performance_review pr
        JOIN employee rv ON rv.employee_id = pr.reviewer_id
        WHERE pr.employee_id = {int(employee_id)}
        ORDER BY pr.created_at DESC
        LIMIT {int(limit)}
    """)


def get_reviews_by_reviewer(reviewer_id, limit=20):
    """获取某人评审的所有绩效（作为评审人）。"""
    return json_array_query(f"""
        SELECT pr.review_id, pr.review_period,
               pr.rating, pr.score,
               pr.score_technical, pr.score_communication,
               pr.score_leadership, pr.score_collaboration,
               pr.status, pr.submitted_at, pr.created_at,
               e.full_name AS employee_name,
               d.department_name
        FROM performance_review pr
        JOIN employee e ON e.employee_id = pr.employee_id
        JOIN department d ON d.department_id = e.department_id
        WHERE pr.reviewer_id = {int(reviewer_id)}
        ORDER BY pr.created_at DESC
        LIMIT {int(limit)}
    """)


# ===================================================================
# 汇总统计
# ===================================================================

def performance_summary(department_id=None, review_period=None):
    """部门绩效汇总：平均分、评级分布、评估人数。

    用于分析仪表盘，展示各部门绩效概览。
    """
    where_dept = ""
    if department_id:
        where_dept = f"AND e.department_id = {int(department_id)}"

    period_filter = ""
    if review_period:
        period_filter = f"AND pr.review_period = {sql_literal(review_period)}"

    return json_array_query(f"""
        SELECT d.department_id, d.department_name,
               COUNT(DISTINCT pr.review_id) AS review_count,
               COUNT(DISTINCT pr.employee_id) AS employees_reviewed,
               ROUND(AVG(pr.score), 1) AS avg_score,
               ROUND(AVG(pr.rating), 2) AS avg_rating,
               COUNT(*) FILTER (WHERE pr.rating >= 4) AS high_performers,
               COUNT(*) FILTER (WHERE pr.rating = 3) AS mid_performers,
               COUNT(*) FILTER (WHERE pr.rating <= 2) AS low_performers
        FROM department d
        LEFT JOIN employee e ON e.department_id = d.department_id
            AND e.employment_status IN ('active', 'probation') {where_dept}
        LEFT JOIN performance_review pr ON pr.employee_id = e.employee_id {period_filter}
        GROUP BY d.department_id, d.department_name
        ORDER BY d.department_name
    """)


def sync_avg_performance_score():
    """同步员工表的绩效相关字段。

    从 performance_review 表更新以下字段：
      - avg_performance_score
      - last_review_rating
      - last_review_date

    定时任务（每日 cron）或管理员手动调用。
    """
    execute("""
        WITH latest_reviews AS (
            SELECT DISTINCT ON (employee_id)
                employee_id,
                score AS avg_score,
                rating AS last_rating,
                submitted_at::date AS review_date
            FROM performance_review
            WHERE status IN ('submitted', 'acknowledged')
            ORDER BY employee_id, submitted_at DESC
        )
        UPDATE employee e
        SET avg_performance_score = lr.avg_score,
            last_review_rating = lr.last_rating,
            last_review_date = lr.review_date
        FROM latest_reviews lr
        WHERE lr.employee_id = e.employee_id
          AND e.employment_status IN ('active', 'probation')
    """)
    return {"status": "synced",
            "detail": "avg_performance_score, last_review_rating, last_review_date updated"}


def performance_trend(employee_id, limit=12):
    """个人绩效趋势：按时间排序的历史评估。

    用于个人绩效趋势图。
    """
    return json_array_query(f"""
        SELECT review_id, review_period,
               rating, score,
               score_technical, score_communication,
               score_leadership, score_collaboration,
               status, submitted_at
        FROM performance_review
        WHERE employee_id = {int(employee_id)}
          AND status IN ('submitted', 'acknowledged')
        ORDER BY submitted_at DESC
        LIMIT {int(limit)}
    """)
