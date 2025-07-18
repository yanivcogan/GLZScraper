import urllib
import urllib.request

from fake_useragent import UserAgent
from root_anchor import ROOT_DIR
from utils import db

ua = UserAgent()


def download_remaining_glz_episodes():
    return db.execute_query(
        '''SELECT e.*
           FROM episode AS e
           WHERE e.channel_id = 0
             AND e.local_storage IS NULL
             AND e.air_date > '2023-10-06'
             AND e.download_status <> 'error'
             AND e.duplicate_of IS NULL
             AND e.transcripts IS NULL
             AND e.page_url NOT LIKE '%|%D7|%92|%D7|%9C|%D7|%92|%D7|%9C|%D7|%A6%' ESCAPE '|'
           ORDER BY e.air_date
           LIMIT 1
        ''',
        {}, "single_row"
    )


def download_glz_mp3_file(download_url: str, filename: str, file_ext: str = "mp3"):
    print("downloading " + filename)
    print("from: " + download_url)
    response = urllib.request.urlopen(urllib.request.Request(download_url, headers={'User-Agent': ua.chrome}))
    content = response.read()
    with open(ROOT_DIR / "dir" / filename + "." + file_ext, "wb") as file:
        file.write(content)
        print("done_downloading " + filename)