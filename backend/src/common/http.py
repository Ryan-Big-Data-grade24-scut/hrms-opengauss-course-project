import json


def ok(data=None, message="ok"):
    return {"code": 0, "message": message, "data": {} if data is None else data}


def page(list_data, total, page_no, page_size):
    return ok(
        {
            "list": list_data,
            "total": total,
            "page": page_no,
            "page_size": page_size,
        }
    )


def error(code, message, http_status=400):
    return http_status, {"code": code, "message": message, "data": {}}


def to_json_bytes(payload):
    return json.dumps(payload, ensure_ascii=False).encode("utf-8")
