import json
import urllib
import urllib.request
from os import remove
from typing import Literal, Optional

from fake_useragent import UserAgent
import time
from pydub import AudioSegment

from episode_transcriber import transcribe_batch_gcs_input_inline_output_v2
from google_cloud_storage_manager import upload_blob, delete_blob
from google_drive_manager import upload_file
from services.file_hash_generator import gen_hash
from utils import db

ua = UserAgent()


def download_remaining_episodes():
    start = time.time()
    download_count = 0
    while True:
        episode_to_download = db.execute_query(
            '''SELECT e.* 
            FROM episode AS e
            WHERE e.local_storage IS NULL AND
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


def set_episode_download_status(episode_id: int, status: Literal["not downloaded", "downloaded", "error", "in progress"], error: Optional[str] = None):
    db.execute_query(
        '''UPDATE episode SET download_status = %(status)s, err_msg = %(error)s
        WHERE id = %(id)s
        ''',
        {"id": episode_id, "status": status, "error": error}, "id"
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
        # check if the episode is a duplicate of an already existing episode
        print("hashing episode")
        episode_hash = gen_hash("./dir/" + episode_filename + ".mp3")
        print("searching for previous airings of the same content")
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
            print("removing file")
            remove("./dir/" + episode_filename + ".mp3")
            print("removed file")
            set_episode_download_status(episode_id, "downloaded")
            return
        print("storing episode hash")
        db.execute_query(
            '''UPDATE episode SET content_hash = %(content_hash)s
            WHERE id = %(id)s
            ''',
            {"id": episode_id, "content_hash": episode_hash}, "id"
        )
        print("splitting episode for processing")
        file_segments = split_file(episode_filename)
        transcript_parts = []
        print("storing file links")
        db.execute_query(
            '''UPDATE episode SET local_storage = %(file_segments)s
            WHERE id = %(id)s
            ''',
            {"id": episode_id, "file_segments": json.dumps(file_segments)}, "id"
        )
        for s in file_segments:
            # uploading segment
            upload_blob("./dir/" + s, s)
            # transcribe segment
            segment_transcript = transcribe_batch_gcs_input_inline_output_v2(s)
            transcript_parts.append(segment_transcript)
            print("removing segment")
            delete_blob(s)
            # remove("./dir/" + s)
        print("storing transcript")
        db.execute_query(
            '''UPDATE episode SET transcripts = %(transcript_parts)s
            WHERE id = %(id)s
            ''',
            {"id": episode_id, "transcript_parts": json.dumps(transcript_parts, ensure_ascii=False).encode('utf8')}, "id"
        )
        print("removing file")
        remove("./dir/" + episode_filename + ".mp3")
        print("removed file")
        set_episode_download_status(episode_id, "downloaded")
    except Exception as e:
        print(str(e))
        set_episode_download_status(episode_id, "error", str(e))
    finally:
        end = time.time()
        print("done processing episode " + str(episode_id))
        print("time elapsed: " + str(end - start))


def download_file(download_url: str, filename: str, file_ext: str = "mp3"):
    print("downloading " + filename)
    print("from: " + download_url)
    response = urllib.request.urlopen(urllib.request.Request(download_url, headers={'User-Agent': ua.chrome}))
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
