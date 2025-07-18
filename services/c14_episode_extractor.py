import json
import traceback
from datetime import datetime
from time import sleep
from urllib.parse import urljoin

import requests
from w3lib.url import safe_url_string
from incapsula import IncapSession
from fake_useragent import UserAgent
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from utils import db

ua = UserAgent()
user_agent = ua.chrome


class Channel14Episode(BaseModel):
    commerceType: Optional[str] = None
    paidType: Optional[Any] = None
    products: Optional[List[Any]] = None
    id: Optional[str] = None
    videoUrl: Optional[str] = None
    title: Optional[str] = None
    image: Optional[str] = None
    optimizedImage: Optional[str] = None
    date: Optional[int] = None
    dateUpdate: Optional[Any] = None
    description: Optional[str] = None
    duration: Optional[str] = None
    poster: Optional[str] = None
    optimizedPoster: Optional[str] = None
    extraPosters: Optional[List[str]] = None
    optimizedExtraPosters: Optional[List[str]] = None
    genre: Optional[Any] = None
    logo: Optional[Any] = None
    type: Optional[str] = None
    commerce: Optional[Any] = None
    customerCode: Optional[str] = None
    season: Optional[Any] = None
    midroll: Optional[Any] = None
    preroll: Optional[str] = None
    vast: Optional[Any] = None
    guid: Optional[str] = None
    serie: Optional[str] = None
    mainCategory: Optional[str] = None
    secondCategory: Optional[Any] = None
    featureCategory: Optional[Any] = None
    listClassification: Optional[str] = None
    keywords: Optional[str] = None
    mainProgram: Optional[str] = None
    rating: Optional[Any] = None
    cast_field: Optional[Any] = None
    onItemSelected: Optional[Dict[str, Any]] = None
    ads: Optional[List[Any]] = None
    entity: Optional[Any] = None
    qrUrl: Optional[str] = None
    airDate: Optional[Any] = None
    authorized: Optional[bool] = None
    purchased: Optional[bool] = None

    class Config:
        extra = "allow"


class Channel14Programme(BaseModel):
    commerceType: Optional[Any] = None
    paidType: Optional[Any] = None
    products: Optional[List[Any]] = None
    id: Optional[str] = None
    title: Optional[str] = None
    seriesType: Optional[str] = None
    image: Optional[str] = None
    optimizedImage: Optional[str] = None
    videoUrl: Optional[str] = None
    date: Optional[int] = None
    dateUpdate: Optional[int] = None
    commerce: Optional[Any] = None
    description: Optional[str] = None
    duration: Optional[Any] = None
    logo: Optional[Any] = None
    genre: Optional[Any] = None
    type: Optional[str] = None
    poster: Optional[str] = None
    optimizedPoster: Optional[str] = None
    extraPosters: Optional[List[str]] = None
    optimizedExtraPosters: Optional[List[str]] = None
    customerCode: Optional[str] = None
    section_id: Optional[Any] = None
    midroll: Optional[Any] = None
    preroll: Optional[str] = None
    vast: Optional[Any] = None
    guid: Optional[str] = None
    amountOfEpisodes: Optional[int] = None
    amountOfSeasons: Optional[Any] = None
    secondCategory: Optional[Any] = None
    featureCategory: Optional[Any] = None
    listClassification: Optional[str] = None
    keywords: Optional[Any] = None
    rating: Optional[Any] = None
    cast_field: Optional[Any] = None
    onItemSelected: Optional[Any] = None
    ads: Optional[List[Dict[str, Any]]] = None
    entity: Optional[str] = None
    qrUrl: Optional[str] = None
    airDate: Optional[int] = None
    unpublishDate: Optional[Any] = None
    trailerUrl: Optional[Any] = None
    subscriptionsCategories: Optional[List[Any]] = None
    count: Optional[int] = None
    authorized: Optional[bool] = None
    purchased: Optional[bool] = None


def extract_c14_episodes(programme_id: str, from_date: datetime, to_date: datetime):
    try:
        url = f"https://insight-api-shared.univtec.com/interface/pages/series/{programme_id}"
        response = requests.get(
            url,
            headers={
                "accept": "*/*",
                "accept-language": "en-US,en;q=0.9,he-IL;q=0.8,he;q=0.7",
                "cache-control": "no-cache",
                "platform": "web",
                "pragma": "no-cache",
                "priority": "u=1, i",
                "sec-ch-ua": "\"Not)A;Brand\";v=\"8\", \"Chromium\";v=\"138\", \"Google Chrome\";v=\"138\"",
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": "\"Windows\"",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "cross-site",
                "x-device-type": "web",
                "x-tenant-id": "channel14"
            },
            allow_redirects=True,
            timeout=10,
        )
        res_json = response.json()
        episodes: list[Channel14Episode] = []
        for s in res_json["seasons"]:
            episodes.extend([Channel14Episode(**e) for e in s["episodes"]])
        episodes_in_data_range = [e for e in episodes if from_date <= datetime.fromtimestamp((e.date or e.airDate or 0) / 1000) <= to_date]
        return episodes_in_data_range
    except Exception as e:
        print(e)
        print(traceback.format_exc())


def store_c14_episodes(episodes: list[Channel14Episode]):
    save_count = 0
    for e in episodes:
        try:
            db.execute_query(
                '''INSERT INTO episode (`channel_id`, `programme_id_on_channel`, `episode_id_on_channel`, `file_url`, `page_url`, `air_date`, `runtime`, `data`)
                   VALUES (1, %(programme_id_on_channel)s, %(episode_id_on_channel)s, %(file_url)s, %(page_url)s, %(air_date)s, %(runtime)s,
                           %(data)s)
                   ON DUPLICATE KEY UPDATE `data`=%(data)s,
                                           `file_url`=%(file_url)s,
                                           `air_date`=%(air_date)s,
                                           `runtime`=%(runtime)s
                ''',
                {
                    "programme_id_on_channel": int(e.serie, 16) % (2**31 - 1),
                    "episode_id_on_channel": int(e.id, 16) % (2**31 - 1),
                    "file_url": e.videoUrl,
                    "page_url": safe_url_string(urljoin("https://vod.c14.co.il/vod/", e.id)),
                    "air_date": datetime.fromtimestamp((e.date or e.airDate or 0) / 1000),
                    "runtime": sum(int(x) * 60 ** i for i, x in enumerate(reversed((e.duration or "0:0:0").split(":")))),
                    "data": json.dumps(e.model_dump(), ensure_ascii=False, default=str)
                },
                "id"
            )
            if id:
                save_count += 1
        except Exception as e:
            print(e)
    print("stored " + str(save_count) + " episodes")
    return save_count


def get_c14_shows():
    session = IncapSession(user_agent=user_agent)
    try:
        url = f"https://vod.c14.co.il/page/66d85aaa6e9a9c00237dec06"
        response = session.get(
            url,
        )
        res_json = response.json()
        shows: list[Channel14Programme] = []
        for s in res_json["sections"]:
            shows.extend([Channel14Programme(**p) for p in s["items"]])
        return shows
    except Exception as e:
        print(e)
        print(traceback.format_exc())


def extract_episodes_for_all_c14_shows(from_date: datetime, to_date: datetime):
    shows = get_c14_shows()
    for programme in shows:
        print("searching episodes from " + programme["title"])
        episodes = extract_c14_episodes(programme["glz_id"], from_date, to_date)
        print("found " + str(len(episodes)) + " episodes")
        saved_count = store_c14_episodes(episodes)
        print("stored " + str(saved_count) + " episodes")


def extract_patriots_episodes_since_oct_7():
    from_date_default = datetime(2023, 10, 7)
    to_date_default = datetime.now()
    patriots_episodes = extract_c14_episodes("63cd2cf4ca5a380012e20fe0", from_date_default, to_date_default)
    store_c14_episodes(patriots_episodes)
