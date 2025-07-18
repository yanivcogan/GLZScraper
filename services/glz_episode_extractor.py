import json
from datetime import datetime
from time import sleep
from urllib.parse import urljoin
from w3lib.url import safe_url_string
from incapsula import IncapSession
from fake_useragent import UserAgent

from utils import db

ua = UserAgent()
user_agent = ua.chrome


def extract_programme_episodes(programme_id: int, from_date: datetime, to_date: datetime):
    ep_dict = dict()
    session = IncapSession(user_agent=user_agent)
    page = 0
    err_count = 0
    while True:
        try:
            url = "https://glz.co.il/umbraco/api/programme/PostLatest"
            response = session.post(
                url,
                data={"page": page, "ProgrammeId": programme_id},
            )
            res_json = response.json()
            if res_json["totalPages"] < page:
                break
            episode_batch = res_json["results"]
            if len(episode_batch) == 0:
                break
            out_of_date_range = False
            for ep in episode_batch:
                ep_id = ep["id"]
                ep_file_url = ep["fileUrl"]
                ep_url = safe_url_string(urljoin("https://glz.co.il/", ep["url"]))
                ep_date_parts = ep["date"].split(".")
                ep_date = datetime(int("20" + ep_date_parts[2]), int(ep_date_parts[1]), int(ep_date_parts[0]))
                try:
                    ep_runtime = int(ep["totalTime"].split(":")[0])
                except Exception as e:
                    ep_runtime = 0
                ep_obj = {
                    "programme_id": programme_id,
                    "glz_id": ep_id,
                    "file_url": ep_file_url,
                    "page_url": ep_url,
                    "air_date": ep_date,
                    "runtime": ep_runtime,
                    "data": json.dumps(ep)
                }
                if ep_date < from_date:
                    out_of_date_range = True
                elif ep_date <= to_date:
                    ep_dict[ep_id] = ep_obj
            if out_of_date_range:
                break
        except Exception as e:
            err_count += 1
            print(e)
        page += 1
        if err_count > 3:
            break
    episodes = list(ep_dict.values())
    return episodes


def store_episode(episodes: list):
    save_count = 0
    for e in episodes:
        try:
            db.execute_query(
                '''INSERT INTO episode (programme_id_on_channel, episode_id_on_channel, `file_url`, `page_url`, `air_date`, `runtime`, `data`) 
                VALUES (%(programme_id)s, %(glz_id)s, %(file_url)s, %(page_url)s, %(air_date)s, %(runtime)s, %(data)s) 
                ON DUPLICATE KEY UPDATE 
                `data`=%(data)s, 
                `file_url`=%(file_url)s, 
                `air_date`=%(air_date)s,
                `runtime`=%(runtime)s
                ''',
                e, "id"
            )
            save_count += 1
        except Exception as e:
            print(e)
    return save_count


def get_shows():
    return db.execute_query(
        '''SELECT p.* 
        FROM programme AS p
        WHERE p.`glz_id` IS NOT NULL AND p.id > 149
        ''',
        {}, "rows"
    )
    return db.execute_query(
        '''SELECT p.* 
        FROM programme AS p
        LEFT JOIN episode e on p.glz_id = e.programme_id_on_channel
        WHERE p.`glz_id` IS NOT NULL
        GROUP BY p.id
        HAVING COUNT(e.id) = 0
        ''',
        {}, "rows"
    )


def extract_episodes_for_all_shows(from_date: datetime, to_date: datetime):
    shows = get_shows()
    for programme in shows:
        print("searching episodes from " + programme["title"])
        episodes = extract_programme_episodes(programme["glz_id"], from_date, to_date)
        print("found " + str(len(episodes)) + " episodes")
        saved_count = store_episode(episodes)
        print("stored " + str(saved_count) + " episodes")
