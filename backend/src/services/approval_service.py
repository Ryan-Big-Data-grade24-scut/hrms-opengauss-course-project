"""审批流核心引擎：审批单生命周期管理、状态机驱动、审批链解析。

功能：
  - submit_approval()       提交审批申请
  - approve()               审批通过当前节点
  - reject()                拒绝审批
  - get_pending_approvals() 待我审批的列表
  - get_my_requests()       我发起的审批列表
  - get_request_detail()    审批单详情

状态机：
    pending -> approved（所有节点通过）
    pending -> rejected（任一节点拒绝）

审批链从 approval_chain_config 表动态读取，并在提交时快照到
approval_requests.chain_snapshot 字段，避免审批单创建后配置变更影响进行中的流程。

依赖表（需先通过迁移创建）：
  - approval_chain_config    审批链模板配置
  - approval_requests        审批单实例
  - employee                 员工表（审批人查找）
  - audit_log                审计日志
"""

import json

from src.common.db import (execute, json_array_query, json_object_query,
                            query_scalar, sql_literal)
from src.services.audit_service import write_audit


# ===================================================================
# 公开 API
# ===================================================================

def submit_approval(employee_id, action_type, target_id, payload, actor):
    """提交审批申请。

    创建审批单并立即进入 PENDING 状态。
    从 approval_chain_config 读取该操作类型的审批链模板，
    解析每个节点的审批人，将快照写入 chain_snapshot 字段。

    Args:
        employee_id: 申请人 employee_id（发起审批的员工）
        action_type: 操作类型，如 'SKILL_ADD' / 'LEAVE_CREATE' / 'ATTENDANCE_RETRO'
        target_id:   目标员工 employee_id（该操作涉及的员工）
        payload:     审批内容（dict，JSON 序列化后存入 payload 字段）
        actor:       操作人用户名（用于审计日志）

    Returns:
        dict: 完整审批单详情（同 get_request_detail）

    Raises:
        ValueError: 未找到对应操作类型的审批链配置
    """
    # 1. 读取审批链模板
    config_nodes = json_array_query(f"""
        SELECT node_order, approver_role, approver_resolver,
               fallback_strategy, required, node_label
        FROM approval_chain_config
        WHERE operation_type = {sql_literal(action_type)}
        ORDER BY node_order
    """)
    if not config_nodes:
        raise ValueError(f"未找到操作类型 {action_type} 的审批链配置")

    # 2. 解析每个节点的审批人
    resolved_nodes = []
    for node in config_nodes:
        approver_ids = _resolve_approver_ids(
            approver_role=node["approver_role"],
            target_emp_id=int(target_id)
        )
        resolved_nodes.append({
            "node_order": node["node_order"],
            "approver_role": node["approver_role"],
            "node_label": node.get("node_label", ""),
            "approvers": approver_ids,
            "status": "waiting"
        })

    # 3. 首节点状态设为 pending
    if resolved_nodes:
        resolved_nodes[0]["status"] = "pending"

    chain_snapshot = {"nodes": resolved_nodes}

    # 4. 创建审批单
    request_id = int(query_scalar(f"""
        INSERT INTO approval_requests
            (operation_type, applicant_id, target_emp_id, payload,
             status, current_node, chain_snapshot, version)
        VALUES (
            {sql_literal(action_type)},
            {int(employee_id)},
            {int(target_id)},
            {sql_literal(json.dumps(payload, ensure_ascii=False))},
            'pending', 1,
            {sql_literal(json.dumps(chain_snapshot, ensure_ascii=False))},
            1
        )
        RETURNING id
    """))

    # 5. 审计日志
    write_audit(
        actor, 'submit', 'approval_request', str(request_id),
        f"提交{action_type}审批单，目标员工#{target_id}"
    )

    return get_request_detail(request_id)


def approve(request_id, actor, comment):
    """审批通过当前节点。

    校验：
      - 审批单存在且状态为 PENDING
      - 当前用户是该节点审批人之一
    乐观锁并发控制：通过 version 字段防止重复操作。
    如果当前节点是末节点，状态变为 APPROVED；否则推进到下一节点。

    Args:
        request_id: 审批单 ID
        actor:      操作人用户名
        comment:    审批意见（可选）

    Returns:
        dict: 更新后的审批单详情

    Raises:
        ValueError:     审批单不存在、状态不正确或已处理
        PermissionError: 当前用户不是审批人
        RuntimeError:    乐观锁冲突，审批单已被他人操作
    """
    # 1. 读取审批单
    request = _get_request(int(request_id))
    if not request:
        raise ValueError(f"审批单 #{request_id} 不存在")
    if request["status"] != "pending":
        raise ValueError(f"审批单状态为 {request['status']}，无法审批（仅 pending 可审批）")

    # 2. 校验审批人身份
    chain = _parse_chain_snapshot(request["chain_snapshot"])
    current_idx = request["current_node"] - 1
    if current_idx < 0 or current_idx >= len(chain["nodes"]):
        raise ValueError(f"审批节点序号异常：current_node={request['current_node']}")

    current_node = chain["nodes"][current_idx]
    actor_emp_id = _resolve_actor_to_employee_id(actor)
    if actor_emp_id not in current_node["approvers"]:
        raise PermissionError("您不是当前审批节点的审批人")

    # 3. 确定下一状态
    is_last = (current_idx + 1) >= len(chain["nodes"])
    new_status = "approved" if is_last else "pending"
    new_node = request["current_node"] if is_last else request["current_node"] + 1

    # 更新快照：当前节点标记为 approved，下一节点标记为 pending（如有）
    current_node["status"] = "approved"
    if not is_last:
        chain["nodes"][current_idx + 1]["status"] = "pending"

    # 4. 乐观锁更新
    updated = int(query_scalar(f"""
        UPDATE approval_requests
        SET status = {sql_literal(new_status)},
            current_node = {new_node},
            chain_snapshot = {sql_literal(json.dumps(chain, ensure_ascii=False))},
            version = version + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = {int(request_id)}
          AND version = {request["version"]}
        RETURNING version
    """) or "0")

    if not updated:
        raise RuntimeError("审批单已被他人操作，请刷新后重新尝试")

    # 5. 审计日志
    log_comment = comment or f"节点{request['current_node']}审批通过"
    write_audit(actor, 'approve', 'approval_request', str(request_id), log_comment)

    # 6. 末节点审批通过后执行业务逻辑
    if is_last:
        _execute_payload(request.get("payload", {}), request.get("operation_type", ""))

    return get_request_detail(request_id)


def reject(request_id, actor, comment):
    """拒绝审批。

    拒绝后审批单进入 REJECTED 终态，流程终止。
    comment 为必填项（拒绝原因）。

    Args:
        request_id: 审批单 ID
        actor:      操作人用户名
        comment:    拒绝原因（必填）

    Returns:
        dict: 更新后的审批单详情

    Raises:
        ValueError:     审批单不存在、状态不正确、或 comment 为空
        PermissionError: 当前用户不是审批人
        RuntimeError:    乐观锁冲突
    """
    if not comment or not comment.strip():
        raise ValueError("拒绝审批时必须填写原因")

    # 1. 读取审批单
    request = _get_request(int(request_id))
    if not request:
        raise ValueError(f"审批单 #{request_id} 不存在")
    if request["status"] != "pending":
        raise ValueError(f"审批单状态为 {request['status']}，无法拒绝")

    # 2. 校验审批人身份
    chain = _parse_chain_snapshot(request["chain_snapshot"])
    current_idx = request["current_node"] - 1
    if current_idx < 0 or current_idx >= len(chain["nodes"]):
        raise ValueError(f"审批节点序号异常：current_node={request['current_node']}")

    current_node = chain["nodes"][current_idx]
    actor_emp_id = _resolve_actor_to_employee_id(actor)
    if actor_emp_id not in current_node["approvers"]:
        raise PermissionError("您不是当前审批节点的审批人")

    # 3. 更新快照
    current_node["status"] = "rejected"

    # 4. 乐观锁更新
    updated = int(query_scalar(f"""
        UPDATE approval_requests
        SET status = 'rejected',
            current_node = {request["current_node"]},
            chain_snapshot = {sql_literal(json.dumps(chain, ensure_ascii=False))},
            version = version + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = {int(request_id)}
          AND version = {request["version"]}
        RETURNING version
    """) or "0")

    if not updated:
        raise RuntimeError("审批单已被他人操作，请刷新后重新尝试")

    # 5. 审计日志
    write_audit(actor, 'reject', 'approval_request', str(request_id), comment)

    return get_request_detail(request_id)


def recall(request_id, actor):
    """撤回审批单（仅发起人可撤回）。

    仅当审批单状态为 PENDING 时允许撤回。
    撤回后审批单进入 RECALLED 终态。

    Args:
        request_id: 审批单 ID
        actor:      操作人用户名

    Returns:
        dict: 更新后的审批单详情

    Raises:
        ValueError:     审批单不存在或状态不正确
        PermissionError: 当前用户不是审批单发起人
        RuntimeError:    乐观锁冲突
    """
    request = _get_request(int(request_id))
    if not request:
        raise ValueError(f"审批单 #{request_id} 不存在")
    if request["status"] != "pending":
        raise ValueError(f"审批单状态为 {request['status']}，无法撤回（仅 pending 可撤回）")

    actor_emp_id = _resolve_actor_to_employee_id(actor)
    if actor_emp_id != request.get("applicant_id"):
        raise PermissionError("仅审批单发起人可以撤回")

    chain = _parse_chain_snapshot(request["chain_snapshot"])

    updated = int(query_scalar(f"""
        UPDATE approval_requests
        SET status = 'recalled',
            chain_snapshot = {sql_literal(json.dumps(chain, ensure_ascii=False))},
            version = version + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = {int(request_id)}
          AND version = {request["version"]}
        RETURNING version
    """) or "0")

    if not updated:
        raise RuntimeError("审批单已被他人操作，请刷新后重新尝试")

    write_audit(actor, 'recall', 'approval_request', str(request_id), '撤回审批单')

    return get_request_detail(request_id)


def get_pending_approvals(actor):
    """查询当前用户待审批的审批单列表。

    通过 actor 解析对应的 employee_id，然后查找所有 status=pending
    且当前节点审批人列表包含该 employee_id 的审批单。

    Args:
        actor: 用户名

    Returns:
        list[dict]: 待审批的审批单列表（按创建时间倒序）
    """
    emp_id = _resolve_actor_to_employee_id(actor)
    if emp_id is None:
        return []

    rows = json_array_query(f"""
        SELECT id, operation_type, applicant_id, target_emp_id,
               status, current_node, created_at
        FROM approval_requests
        WHERE status = 'pending'
          AND chain_snapshot -> 'nodes' -> (current_node - 1)
              -> 'approvers' @> {sql_literal(json.dumps([emp_id]))}::jsonb
        ORDER BY created_at DESC
    """)
    return rows


def get_my_requests(employee_id):
    """查询某员工发起的审批单列表。

    Args:
        employee_id: 员工 employee_id

    Returns:
        list[dict]: 该员工发起的审批单列表（按创建时间倒序）
    """
    rows = json_array_query(f"""
        SELECT id, operation_type, target_emp_id,
               status, current_node, created_at
        FROM approval_requests
        WHERE applicant_id = {int(employee_id)}
        ORDER BY created_at DESC
    """)
    return rows


def get_processed_requests(employee_id):
    """查询当前员工已审批过的审批单列表（已通过或已拒绝）。

    Args:
        employee_id: 员工 employee_id

    Returns:
        list[dict]: 该员工审批过的审批单列表（按创建时间倒序）
    """
    emp_id = int(employee_id)
    rows = json_array_query(f"""
        SELECT DISTINCT ar.id, ar.operation_type, ar.target_emp_id,
               ar.status, ar.current_node, ar.created_at
        FROM approval_requests ar
        JOIN audit_log al ON al.target_type = 'approval_request'
            AND al.target_id = CAST(ar.id AS TEXT)
        WHERE al.action_type IN ('approve', 'reject')
          AND ar.status IN ('approved', 'rejected')
          AND EXISTS (
              SELECT 1 FROM sys_user u
              JOIN employee e ON e.full_name = u.full_name
              WHERE u.username = al.username
                AND e.employee_id = {emp_id}
          )
        ORDER BY ar.created_at DESC
    """)
    return rows


def get_request_detail(request_id):
    """获取审批单完整详情（含审批链快照和审计日志）。

    Args:
        request_id: 审批单 ID

    Returns:
        dict: 审批单详情，包含：
            - id, operation_type, applicant_id, target_emp_id
            - payload, status, current_node, chain_snapshot
            - version, created_at, updated_at
            - audit_logs: 相关审计日志列表

    Raises:
        ValueError: 审批单不存在
    """
    request = _get_request(int(request_id))
    if not request:
        raise ValueError(f"审批单 #{request_id} 不存在")

    # 解析 chain_snapshot
    request["chain_snapshot"] = _parse_chain_snapshot(request.get("chain_snapshot"))

    # 查询审计日志
    request["audit_logs"] = json_array_query(f"""
        SELECT audit_id, username, action_type, action_detail, created_at
        FROM audit_log
        WHERE target_type = 'approval_request'
          AND target_id = {sql_literal(str(request_id))}
        ORDER BY created_at
    """)

    return request


# ===================================================================
# 内部辅助函数
# ===================================================================

def _execute_payload(payload, action_type):
    """审批通过后执行业务逻辑。

    根据操作类型执行对应的数据变更：
      - SKILL_CHANGE  → INSERT employee_skill
      - PROFILE_UPDATE → UPDATE employee_profile

    Args:
        payload:     审批内容（dict）
        action_type: 操作类型
    """
    if action_type == "SKILL_CHANGE":
        employee_id = int(payload.get("employee_id", 0))
        skill_id = int(payload.get("skill_id", 0))
        action = payload.get("action", "add")

        if action == "delete":
            execute(f"""
                DELETE FROM employee_skill
                WHERE employee_id = {employee_id} AND skill_id = {skill_id}
            """)
        else:
            level = int(payload.get("proficiency_level", 1))
            source = payload.get("acquired_from", "self")
            is_core = payload.get("is_core", False)
            existing = query_scalar(
                f"SELECT employee_skill_id FROM employee_skill "
                f"WHERE employee_id = {employee_id} AND skill_id = {skill_id}"
            )
            if existing:
                execute(f"""
                    UPDATE employee_skill
                    SET proficiency_level = {level},
                        acquired_from = {sql_literal(source)},
                        is_core = {str(is_core).upper()},
                        updated_at = CURRENT_TIMESTAMP
                    WHERE employee_id = {employee_id} AND skill_id = {skill_id}
                """)
            else:
                execute(f"""
                    INSERT INTO employee_skill
                        (employee_id, skill_id, proficiency_level, acquired_from, is_core)
                    VALUES ({employee_id}, {skill_id}, {level},
                            {sql_literal(source)}, {str(is_core).upper()})
                """)
    elif action_type == "PROFILE_UPDATE":
        fields = payload.get("fields", {})
        set_clauses = [
            f"{k} = {sql_literal(v)}" for k, v in fields.items()
        ]
        if set_clauses:
            execute(f"""
                UPDATE employee_profile
                SET {', '.join(set_clauses)}
                WHERE employee_id = {int(payload.get("employee_id", 0))}
            """)


def resolve_employee_id(actor):
    """公开包装：将 actor 用户名解析为 employee_id。

    返回 int 或 None。
    """
    return _resolve_actor_to_employee_id(actor)


def _get_request(request_id):
    """根据 ID 查询审批单原始记录。"""
    return json_object_query(f"""
        SELECT * FROM approval_requests WHERE id = {int(request_id)}
    """)


def _parse_chain_snapshot(raw):
    """解析 chain_snapshot 字段（兼容字符串和 dict 类型）。"""
    if isinstance(raw, str):
        return json.loads(raw)
    if isinstance(raw, dict):
        return raw
    return {"nodes": []}


def _resolve_actor_to_employee_id(actor):
    """将 actor 用户名解析为 employee_id。

    actor 可以是：
      1. 数字字符串（直接作为 employee_id）
      2. sys_user.username（通过 full_name 匹配 employee）
      3. employee.employee_no（工号）

    如果均无法匹配，返回 None。
    """
    # 数字字符串 → 直接作为 employee_id
    try:
        return int(actor)
    except (ValueError, TypeError):
        pass

    # sys_user.username → JOIN employee.full_name
    row = json_object_query(f"""
        SELECT e.employee_id
        FROM sys_user u
        JOIN employee e ON e.full_name = u.full_name
        WHERE u.username = {sql_literal(actor)}
        LIMIT 1
    """)
    if row and row.get("employee_id"):
        return row["employee_id"]

    # employee.employee_no 匹配
    row = json_object_query(f"""
        SELECT employee_id FROM employee
        WHERE employee_no = {sql_literal(actor)}
        LIMIT 1
    """)
    if row and row.get("employee_id"):
        return row["employee_id"]

    return None


def _resolve_approver_ids(approver_role, target_emp_id):
    """根据审批角色查找审批人 employee_id 列表。

    支持的 approver_role：
      - direct_manager    直属上级（manager_employee_id）
      - skip_level_manager 上级的上级
      - hr_specialist      HR 专员
      - hr_director        HR 总监
      - employee_self      目标员工本人
      - system_auto        系统自动（返回空列表）

    Args:
        approver_role: 审批角色标识
        target_emp_id: 目标员工 employee_id

    Returns:
        list[int]: 审批人 employee_id 列表
    """
    if approver_role == "direct_manager":
        row = json_object_query(f"""
            SELECT manager_employee_id FROM employee
            WHERE employee_id = {int(target_emp_id)}
        """)
        if row and row.get("manager_employee_id"):
            return [int(row["manager_employee_id"])]
        # fallback：manager 为空时向上递归查找
        return _resolve_escalate_up(target_emp_id)

    elif approver_role == "skip_level_manager":
        # 先找直属上级，再找上级的上级
        row = json_object_query(f"""
            SELECT manager_employee_id FROM employee
            WHERE employee_id = {int(target_emp_id)}
        """)
        if row and row.get("manager_employee_id"):
            mgr_id = int(row["manager_employee_id"])
            row2 = json_object_query(f"""
                SELECT manager_employee_id FROM employee
                WHERE employee_id = {mgr_id}
            """)
            if row2 and row2.get("manager_employee_id"):
                return [int(row2["manager_employee_id"])]
        return []

    elif approver_role == "hr_specialist":
        # 查找 HR 部门的在岗员工
        rows = json_array_query(f"""
            SELECT e.employee_id
            FROM employee e
            JOIN department d ON e.department_id = d.department_id
            WHERE (d.department_name LIKE '%HR%'
                OR d.department_name LIKE '%人事%'
                OR d.department_name LIKE '%人力资源%')
              AND e.employment_status = 'active'
            LIMIT 1
        """)
        return [r["employee_id"] for r in rows]

    elif approver_role == "hr_director":
        # 查找 HR 部门的管理者
        row = json_object_query(f"""
            SELECT d.manager_employee_id
            FROM department d
            WHERE (d.department_name LIKE '%HR%'
                OR d.department_name LIKE '%人事%'
                OR d.department_name LIKE '%人力资源%')
              AND d.manager_employee_id IS NOT NULL
            LIMIT 1
        """)
        if row and row.get("manager_employee_id"):
            return [int(row["manager_employee_id"])]
        return []

    elif approver_role == "employee_self":
        return [int(target_emp_id)]

    elif approver_role == "system_auto":
        return []

    # 未知角色：返回空列表
    return []


def _resolve_escalate_up(emp_id):
    """向上递归查找上级审批人。

    当 direct_manager 为空时，沿着部门树或管理链向上查找。
    递归深度限制为 10 层，防止环路死循环。

    Args:
        emp_id: 起始员工 employee_id

    Returns:
        list[int]: 找到的审批人 employee_id 列表（可能为空）
    """
    rows = json_array_query(f"""
        WITH RECURSIVE mgr_chain AS (
            SELECT employee_id, manager_employee_id, 0 AS depth
            FROM employee
            WHERE employee_id = {int(emp_id)}
            UNION ALL
            SELECT e.employee_id, e.manager_employee_id, mc.depth + 1
            FROM employee e
            JOIN mgr_chain mc ON e.employee_id = mc.manager_employee_id
            WHERE mc.manager_employee_id IS NOT NULL
              AND mc.depth < 10
        )
        SELECT employee_id, depth
        FROM mgr_chain
        WHERE manager_employee_id IS NULL
           OR depth = 1
        ORDER BY depth
        LIMIT 1
    """)
    if rows:
        return [rows[0]["employee_id"]]
    return []
