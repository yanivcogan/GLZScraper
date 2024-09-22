import json
import math
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
    page_size: Optional[int] = 20


@app.post('/api/search/')
async def fetch_search_results(search: SearchQuery):
    base_query_template = '''
            SELECT e.*, p.title
            FROM episode AS e 
            JOIN programme p ON e.programme_id = p.glz_id
            WHERE {search_condition}
            AND e.duplicate_of IS NULL
            ORDER BY e.air_date
            '''
    search_term = search.query
    search_condition = "TRUE"
    if search.type == "contains":
        search_term = "%"+search_term+"%"
        search_condition = "transcripts LIKE %(search)s"
    if search.type == "regex":
        search_condition = "transcripts REGEXP %(search)s"
    if search.type == "boolean":
        search_condition = "MATCH (e.transcripts) AGAINST (%(search)s IN BOOLEAN MODE)"
    base_query = base_query_template.replace('{search_condition}', search_condition)
    page_size = search.page_size
    page_results_query = base_query + f" LIMIT {page_size} OFFSET %(offset)s"
    results_count_query = "SELECT COUNT(*) AS res_count FROM (" + base_query + ") AS results"
    results = db.execute_query(
        page_results_query,
        {"offset": search.page * page_size, "search": search_term},
        "rows"
    )
    results_count_query = db.execute_query(
        results_count_query,
        {"search": search_term},
        "single_row"
    )["res_count"] / page_size
    results_count_query = math.ceil(results_count_query)
    return {
        "results": results,
        "count": results_count_query,
    }


@app.get('/api/episode/{episode_id}')
async def fetch_episode(episode_id: int):
    episode = db.execute_query(
        '''
                    SELECT e.*, p.title
                    FROM episode AS e 
                    JOIN programme p ON e.programme_id = p.glz_id
                    WHERE e.id = %(episode_id)s
                    AND e.duplicate_of IS NULL
                    ORDER BY e.air_date
                    ''',
        {"episode_id": episode_id},
        "single_row"
    )
    if episode is None:
        return {"error": "Episode not found"}
    highlights = db.execute_query(
        '''
                    SELECT h.*
                    FROM highlights AS h 
                    WHERE h.episode_id = %(episode_id)s
                    ''',
        {"episode_id": episode_id},
        "rows"
    )
    for h in highlights:
        h["range"] = json.loads(h["range"])
    return {
        "episode": episode,
        "highlights": highlights,
    }


class Highlight(BaseModel):
    id: Optional[int] = None
    episode_id: int
    range: list[dict]
    original_text: str
    fixed_text: Optional[str] = None
    speaker_name: str
    title: str


class HighlightsSave(BaseModel):
    episode_id: int
    highlights: list[Highlight]
    to_delete: list[int]


@app.post('/api/highlights/')
async def save_highlights(save: HighlightsSave):
    highlights = save.highlights
    episode_id = save.episode_id
    to_delete = save.to_delete
    for h in highlights:
        if h.id is None:
            db.execute_query(
                '''INSERT INTO highlights (`episode_id`, `range`, `original_text`, `fixed_text`, `speaker_name`, `title`)
                VALUES (%(episode_id)s, %(range)s, %(original_text)s, %(fixed_text)s, %(speaker_name)s, %(title)s)''',
                {
                    "episode_id": h.episode_id,
                    "range": json.dumps(h.range),
                    "original_text": h.original_text,
                    "fixed_text": h.fixed_text,
                    "speaker_name": h.speaker_name,
                    "title": h.title
                },
                "id"
            )
        else:
            db.execute_query(
                '''UPDATE highlights SET
                 `episode_id` = %(episode_id)s, 
                 `range` = %(range)s,
                 `original_text` = %(original_text)s, 
                 `fixed_text` = %(fixed_text)s, 
                 `speaker_name` = %(speaker_name)s,
                 `title` = %(title)s
                WHERE `id` = %(id)s''',
                {
                    "id": h.id,
                    "episode_id": h.episode_id,
                    "range": json.dumps(h.range),
                    "original_text": h.original_text,
                    "fixed_text": h.fixed_text,
                    "speaker_name": h.speaker_name,
                    "title": h.title
                },
                "id"
            )
    for h in to_delete:
        db.execute_query(
            "DELETE FROM highlights WHERE id = %(id)s",
            {"id": h},
            "none"
        )
    results = db.execute_query(
        "SELECT * FROM highlights WHERE episode_id = %(episode_id)s",
        {"episode_id": episode_id},
        "rows"
    )
    for r in results:
        r["range"] = json.loads(r["range"])
    return {
        "saved_quotes": results,
    }


if __name__ == '__main__':
    APP_HOST = os.getenv("APP_HOST")
    APP_PORT = os.getenv("APP_PORT")
    uvicorn.run(app, port=int(APP_PORT), host=APP_HOST)
    exit(0)
