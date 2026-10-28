from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import buttons, home_buttons, institutions, news, notifications, socials, users


app = FastAPI(title="UniMate API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8081",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8081",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(buttons.router)
app.include_router(home_buttons.router)
app.include_router(institutions.router)
app.include_router(users.router)
app.include_router(news.router)
app.include_router(notifications.router)
app.include_router(socials.router)


@app.get("/health")
def health():
    return {"status": "ok"}