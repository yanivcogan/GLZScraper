import json
import urllib
import urllib.request
from os import remove
from typing import Literal

from fake_useragent import UserAgent
import time
from pydub import AudioSegment
from google_drive_manager import upload_file
from utils import db

ua = UserAgent()


def download_remaining_episodes():
    start = time.time()
    download_count = 0
    while True:
        episode_to_download = db.execute_query(
            '''SELECT e.* 
            FROM episode AS e
            WHERE e.drive_url IS NULL AND
             e.air_date > '2023-10-06' AND
             e.download_status = 'not downloaded' AND
             e.page_url NOT LIKE '%|%D7|%92|%D7|%9C|%D7|%92|%D7|%9C|%D7|%A6%' ESCAPE '|'
            ORDER BY e.air_date 
            LIMIT 1
            ''',
            {}, "single_row"
        )
        if episode_to_download is None:
            return
        download_episode(episode_to_download["id"])
        end = time.time()
        download_count += 1
        print("**** INTERIM PROGRESS REPORT: downloaded " + str(download_count) + " episodes, time elapsed: " +
              str(end - start) + " seconds ****")


def set_episode_download_status(episode_id: int, status: Literal["not downloaded", "downloaded", "error", "in progress"]):
    db.execute_query(
        '''UPDATE episode SET download_status = %(status)s
        WHERE id = %(id)s
        ''',
        {"id": episode_id, "status": status}, "id"
    )


def download_episode(episode_id: int):
    start = time.time()
    print("*************")
    print("processing episode " + str(episode_id))
    print("*************")
    episode = db.execute_query(
        '''SELECT e.* 
        FROM episode AS e
        WHERE e.id = %(id)s
        ''',
        {"id": episode_id}, "single_row"
    )
    if not episode:
        print("no such episode")
        return
    set_episode_download_status(episode_id, "in progress")
    try:
        download_url = episode["file_url"]
        episode_filename = str(episode["air_date"]) + "_" + str(episode_id).zfill(10)
        download_file(download_url, episode_filename)
        file_segments = split_file(episode_filename)
        drive_ids = []
        for s in file_segments:
            drive_id = upload_file(s, s)
            drive_ids.append("https://drive.google.com/file/d/" + drive_id)
            print("removing segment")
            remove("./dir/" + s)
        print("linking drive storage to db")
        db.execute_query(
            '''UPDATE episode SET drive_url = %(drive_id)s
            WHERE id = %(id)s
            ''',
            {"id": episode_id, "drive_id": json.dumps(drive_ids)}, "id"
        )
        print("removing file")
        remove("./dir/" + episode_filename + ".mp3")
        print("removed file")
        set_episode_download_status(episode_id, "downloaded")
    except Exception as e:
        print(str(e))
        set_episode_download_status(episode_id, "error")
    finally:
        end = time.time()
        print("done processing episode " + str(episode_id))
        print("time elapsed: " + str(end - start))


def download_file(download_url: str, filename: str, file_ext: str = "mp3"):
    print("downloading " + filename)
    print("from: " + download_url)
    try:
        response = urllib.request.urlopen(urllib.request.Request(download_url, headers={'User-Agent': ua.chrome}))
    except Exception as e:
        print("error")
        print(e)
        return
    content = response.read()
    with open("./dir/" + filename + "." + file_ext, "wb") as file:
        file.write(content)
        print("done_downloading " + filename)


MAX_SEGMENT_LENGTH = 3600


def split_file(file_name: str, file_ext: str = "mp3") -> list[str]:
    file_path = "./dir/" + file_name + "." + file_ext
    print("reading audio file " + file_name)
    audio = AudioSegment.from_file(file_path)
    print("checking audio length for file " + file_name)
    segment_length = audio.duration_seconds
    segment_count = 0
    segments = []
    print("splitting file " + file_name)
    for start in range(0, int(segment_length), MAX_SEGMENT_LENGTH):
        segment_count += 1
        print("creating segment " + str(segment_count))
        segment_audio = audio[start * 1000: int(min(start + MAX_SEGMENT_LENGTH, int(segment_length))) * 1000]
        segment_file_name = file_name + "_p" + str(segment_count) + '.' + file_ext
        segment_audio.export("./dir/" + segment_file_name, format=file_ext, bitrate='32k')
        segments.append(segment_file_name)
        print("exported segment " + str(segment_count))
    return segments
