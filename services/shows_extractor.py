import json
import math
from datetime import datetime
from typing import Literal
from urllib.parse import urljoin

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
from playwright_stealth import stealth_sync
from w3lib.url import safe_url_string

from utils import db

GLZ_DATA_ROOT = 1051
GLGLZ_DATA_ROOT = 1920
SECONDS_PER_DAY = 24 * 3600


def extract_programmes(source: Literal["GLZ", "GLGLZ"], from_date: datetime, to_date: datetime):
    data_root = GLZ_DATA_ROOT if source == "GLZ" else GLGLZ_DATA_ROOT
    now = datetime.now()
    from_weeks_ago = int(math.ceil((now - from_date).total_seconds() / (SECONDS_PER_DAY * 7)))
    to_weeks_ago = int((now - to_date).total_seconds() / (SECONDS_PER_DAY * 7))
    programmes_dict = {}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        stealth_sync(page)
        for i in range(-from_weeks_ago, -to_weeks_ago):
            print("getting programmes for " + str(i) + " weeks ago")
            try:
                url = f'''https://glz.co.il/umbraco/api/timetable/getTimetable?rootId={data_root}&slideindex={i}'''
                page.goto(url)
                res = page.content()
                res_soup = BeautifulSoup(res, features="lxml")
                res_content = res_soup.find("body").text
                res_json = json.loads(res_content)
                glz_time_table = res_json["glzTimeTable"]
                for day in glz_time_table:
                    programmes = day["programmes"]
                    for pr in programmes:
                        slug = pr["url"]
                        full_url = urljoin("https://glz.co.il/", slug)
                        pr["url"] = safe_url_string(full_url)
                        programmes_dict[pr["url"]] = pr
            except Exception as e:
                print(e)
        browser.close()
    return list(programmes_dict.values())


def store_shows(shows):
    save_count = 0
    for s in shows:
        try:
            db.execute_query(
                '''INSERT INTO programme (`title`, `url`, `glz_id`, `data`) 
                VALUES (%(title)s, %(url)s, null, %(data)s) 
                ON DUPLICATE KEY UPDATE `data`=%(data)s, `title`=%(title)s''',
                {'title': s["topText"], 'url': s["url"], 'data': json.dumps(s)}, "id"
            )
            save_count += 1
        except Exception as e:
            print(e)
    return save_count


def get_id_less_shows():
    return db.execute_query(
        '''SELECT * FROM programme WHERE `glz_id` IS NULL''',
        {}, "rows"
    )


def add_glz_ids(id_less_shows: list):
    successful_id_extraction = 0
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        stealth_sync(page)
        for s in id_less_shows:
            print("getting id for " + s["title"])
            try:
                url = safe_url_string(s["url"])
                page.goto(url)
                res = page.content()
                res_soup = BeautifulSoup(res, features="lxml")
                glz_id = res_soup.find("body").attrs["data-current-page-id"]
                db.execute_query(
                    '''UPDATE programme SET `glz_id` = %(glz_id)s WHERE `id` = %(id)s''',
                    {'glz_id': glz_id, 'id': s["id"]}, "id"
                )
                successful_id_extraction += 1
            except Exception as e:
                print(e)
        browser.close()
        return successful_id_extraction


def update_shows_archive(source: Literal["GLZ", "GLGLZ"], from_date: datetime, to_date: datetime):
    shows = extract_programmes(source, from_date, to_date)
    saved_count = store_shows(shows)
    print("saved " + str(saved_count) + " shows out of " + str(len(shows)) + " shows")
    id_less_shows = get_id_less_shows()
    successful_id_extraction = add_glz_ids(id_less_shows)
    print("found ids for " + str(successful_id_extraction) + " shows out of " + str(len(id_less_shows)) + " shows")
    return True
