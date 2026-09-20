from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import buttons, institutions, news, users


app = FastAPI(title="UniMate API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(buttons.router)
app.include_router(institutions.router)
app.include_router(users.router)
app.include_router(news.router)


@app.get("/health")
def health():
    return {"status": "ok"}