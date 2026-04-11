import hashlib
import secrets
import threading
from datetime import datetime, timedelta


def hash_password(password):
    digest = hashlib.sha256(password.encode("utf-8")).hexdigest()
    return f"sha256${digest}"


def verify_password(raw_password, stored_hash):
    if not stored_hash:
        return False
    if stored_hash.startswith("sha256$"):
        return stored_hash == hash_password(raw_password)
    if stored_hash.startswith("demo_"):
        return raw_password == "123456"
    return raw_password == stored_hash


class TokenStore:
    def __init__(self):
        self._tokens = {}
        self._lock = threading.Lock()

    def create(self, profile, ttl_hours=12):
        token = secrets.token_hex(24)
        expires_at = datetime.utcnow() + timedelta(hours=ttl_hours)
        with self._lock:
            self._tokens[token] = {"profile": profile, "expires_at": expires_at}
        return token

    def get(self, token):
        if not token:
            return None
        with self._lock:
            item = self._tokens.get(token)
            if not item:
                return None
            if item["expires_at"] < datetime.utcnow():
                self._tokens.pop(token, None)
                return None
            return item["profile"]

    def delete(self, token):
        with self._lock:
            self._tokens.pop(token, None)


TOKENS = TokenStore()
