import hashlib
import uuid


def news_viewer_hash(news_id: int, user_id: uuid.UUID) -> str:
    value = f"{news_id}:{user_id}".encode()
    return hashlib.sha256(value).hexdigest()
