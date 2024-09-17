import os
from typing import Optional, Literal
from dotenv import load_dotenv

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from utils import db

load_dotenv()


# Press the green button in the gutter to run the script.
app = FastAPI()
# TODO: split API routes definition https://stackoverflow.com/a/76232103

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# app.mount("/dir", StaticFiles(directory="dir"), name="dir")


@app.get("/dir/{file_path:path}")
async def function(file_path: str):
    response = FileResponse(f"dir/{file_path}")
    response.headers["X-Custom-Header"] = "Your custom header value"
    return response


class SearchQuery(BaseModel):
    type: Literal["contains", "regex", "boolean"]
    query: Optional[str] = None
    page: Optional[int] = 0


@app.post('/api/search/')
async def fetch_incident(search: SearchQuery):
    if search.type == "contains":
        return db.execute_query(
            '''
            SELECT e.*, p.title
            FROM episode AS e 
            JOIN programme p ON e.programme_id = p.glz_id
            WHERE transcripts LIKE %(search)s
            AND e.duplicate_of IS NULL
            ORDER BY e.air_date
            LIMIT 20 OFFSET %(offset)s
            ''',
            {"offset": search.page * 20, "search": "%"+search.query+"%"},
            "rows"
        )
    if search.type == "regex":
        return db.execute_query(
            '''
            SELECT e.*, p.title
            FROM episode AS e 
            JOIN programme p ON e.programme_id = p.glz_id
            WHERE transcripts REGEXP %(search)s
            AND e.duplicate_of IS NULL
            ORDER BY e.air_date
            LIMIT 20 OFFSET %(offset)s
            ''',
            {"offset": search.page * 20, "search": "%"+search.query+"%"},
            "rows"
        )
    if search.type == "boolean":
        return db.execute_query(
            '''
            SELECT e.*, p.title
            FROM episode AS e 
            JOIN programme p ON e.programme_id = p.glz_id
            WHERE MATCH (e.transcripts) AGAINST (%(search)s IN BOOLEAN MODE)
            AND e.duplicate_of IS NULL
            LIMIT 20 OFFSET %(offset)s
            ''',
            {"offset": search.page * 20, "search": "%"+search.query+"%"},
            "rows"
        )


if __name__ == '__main__':
    APP_HOST = os.getenv("APP_HOST")
    APP_PORT = os.getenv("APP_PORT")
    uvicorn.run(app, port=int(APP_PORT), host=APP_HOST)
    exit(0)
