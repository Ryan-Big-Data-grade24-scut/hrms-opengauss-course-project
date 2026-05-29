"""Attrition prediction using openGauss DB4AI engine."""

from src.common.db import execute, json_array_query, query_scalar


def train_attrition_model():
    """Train logistic regression model inside openGauss."""
    execute("DROP MODEL IF EXISTS attrition_model;")
    result = query_scalar(
        """
        CREATE MODEL attrition_model USING logistic_regression
        FEATURES tenure, engagement_score, last_promotion_months, manager_changes
        TARGET attrition_flag
        FROM employee
        WITH learning_rate=0.01, max_iterations=200
        """
    )
    return {"status": "trained", "detail": result}


def predict_attrition():
    """Predict attrition risk for all active employees."""
    return json_array_query(
        """
        SELECT e.employee_id, e.employee_no, e.full_name,
               d.department_name,
               ROUND((PREDICT BY attrition_model (FEATURES
                 e.tenure, e.engagement_score,
                 e.last_promotion_months, e.manager_changes
               ) * 100)::decimal, 1) AS risk_score,
               e.tenure, e.engagement_score,
               e.last_promotion_months, e.manager_changes
        FROM employee e
        JOIN department d ON d.department_id = e.department_id
        WHERE e.employment_status = 'active'
        ORDER BY risk_score DESC
        """
    )


def get_model_info():
    """Get trained model metadata from gs_model_warehouse."""
    return json_array_query(
        "SELECT modelname, modeltype, hyperparametersnames, "
        "hyperparametersvalues, createtime "
        "FROM gs_model_warehouse WHERE modelname = 'attrition_model'"
    )
