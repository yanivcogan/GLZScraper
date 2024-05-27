import os
from typing import Optional, Literal
from dotenv import load_dotenv

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
            JOIN programme p ON e.programme_id = p.id
            WHERE transcripts LIKE %(search)s
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
            JOIN programme p ON e.programme_id = p.id
            WHERE transcripts REGEXP %(search)s
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
            JOIN programme p ON e.programme_id = p.id
            WHERE MATCH (e.transcripts) AGAINST (%(search)s IN BOOLEAN MODE)
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
