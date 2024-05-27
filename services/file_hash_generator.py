import hashlib

# BUF_SIZE is totally arbitrary, change for your app!
import json

from utils import db

BUF_SIZE = 65536  # lets read stuff in 64kb chunks!


def gen_hash(path: str):
    md5 = hashlib.md5()

    with open(path, 'rb') as f:
        while True:
            data = f.read(BUF_SIZE)
            if not data:
                break
            md5.update(data)
    return md5.hexdigest()


def find_duplicates():
    while True:
        episode_to_download = db.execute_query(
            '''SELECT e.* 
            FROM episode AS e
            WHERE e.local_storage IS NOT NULL AND
             e.duplicate_of IS NULL AND
             e.content_hash IS NULL
            ORDER BY e.air_date 
            LIMIT 1
            ''',
            {}, "single_row"
        )
        if episode_to_download is None:
            return
        episode_id = episode_to_download["id"]
        episode_filename = json.loads(episode_to_download["local_storage"])[0]
        episode_hash = gen_hash("./dir/" + episode_filename)
        previous_airings = db.execute_query(
            '''SELECT * FROM episode
            WHERE content_hash = %(content_hash)s
            ''',
            {"content_hash": episode_hash},
            return_type="single_row"
        )
        if previous_airings:
            print("episode is duplicate of episode " + str(previous_airings["id"]))
            db.execute_query(
                '''UPDATE episode SET duplicate_of = %(duplicate_of)s
                WHERE id = %(id)s
                ''',
                {"id": episode_id, "duplicate_of": previous_airings["id"]}, "id"
            )
        else:
            print("storing episode hash")
            db.execute_query(
                '''UPDATE episode SET content_hash = %(content_hash)s
                WHERE id = %(id)s
                ''',
                {"id": episode_id, "content_hash": episode_hash}, "id"
            )