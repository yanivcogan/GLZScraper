import json
from os import remove
from typing import Literal, Optional

from fake_useragent import UserAgent
import time
from pydub import AudioSegment

from episode_transcriber import transcribe_batch_gcs_input_inline_output_v2
from google_cloud_storage_manager import upload_blob, delete_blob
from root_anchor import ROOT_DIR
from services.c14_episode_downloader import download_remaining_c14_episodes, download_c14_m3u8_file
from services.file_hash_generator import gen_hash
from services.glz_episode_downloader import download_remaining_glz_episodes, download_glz_mp3_file
from utils import db

ua = UserAgent()

SOURCE_TYPE = Literal["glz", "c14"]


def download_remaining_episodes(source_type: SOURCE_TYPE):
    start = time.time()
    download_count = 0
    while True:
        episode_to_download = None
        if source_type == "glz":
            episode_to_download = download_remaining_glz_episodes()
        elif source_type == "c14":
            episode_to_download = download_remaining_c14_episodes()
        if episode_to_download is None:
            return
        process_episode(episode_to_download["id"], source_type)
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


def process_episode(episode_id: int, source_type: SOURCE_TYPE):
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
    segments = json.loads(episode["local_storage"]) if episode["local_storage"] else None
    if not episode:
        print("no such episode")
        return
    if episode["download_status"] == "not downloaded" or episode["download_status"] == "in progress":
        set_episode_download_status(episode_id, "in progress")
        try:
            set_episode_download_status(episode_id, "downloaded")
            segments = download_episode(episode, source_type)
        except Exception as e:
            print(str(e))
            set_episode_download_status(episode_id, "error", str(e)[0:300])
    try:
        if segments:
            analyze_segments(segments, episode_id)
    except Exception as e:
        print(str(e))
        set_episode_download_status(episode_id, "error", str(e)[0:300])
    end = time.time()
    print("done processing episode " + str(episode_id))
    print("time elapsed: " + str(end - start))


def download_episode(episode: dict, source_type: SOURCE_TYPE) -> Optional[list[str]]:
    episode_id = episode["id"]
    download_url = episode["file_url"]
    episode_filename = str(episode["air_date"]) + "_" + str(episode_id).zfill(10)
    if source_type == "glz":
        download_glz_mp3_file(download_url, episode_filename)
    elif source_type == "c14":
        download_c14_m3u8_file(download_url, episode_filename)
    # check if the episode is a duplicate of an already existing episode
    print("hashing episode")
    episode_hash = gen_hash(ROOT_DIR / "dir" /  episode_filename + ".mp3")
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
        remove(ROOT_DIR / "dir" /  episode_filename + ".mp3")
        print("removed file")
        set_episode_download_status(episode_id, "downloaded")
        return None
    print("storing episode hash")
    db.execute_query(
        '''UPDATE episode SET content_hash = %(content_hash)s
        WHERE id = %(id)s
        ''',
        {"id": episode_id, "content_hash": episode_hash}, "id"
    )
    print("splitting episode for processing (because Google Cloud Speech-to-Text has a 1 hour limit)")
    file_segments = split_file(episode_filename)
    print("storing file links")
    db.execute_query(
        '''UPDATE episode SET local_storage = %(file_segments)s
        WHERE id = %(id)s
        ''',
        {"id": episode_id, "file_segments": json.dumps(file_segments)}, "id"
    )
    print("removing file")
    remove(ROOT_DIR / "dir" /  episode_filename + ".mp3")
    print("removed file")
    return file_segments


MAX_SEGMENT_LENGTH = 3600


def split_file(file_name: str, file_ext: str = "mp3") -> list[str]:
    file_path = ROOT_DIR / "dir" /  file_name + "." + file_ext
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
        segment_audio.export(ROOT_DIR / "dir" /  segment_file_name, format=file_ext, bitrate='32k')
        segments.append(segment_file_name)
        print("exported segment " + str(segment_count))
    return segments


def analyze_segments(file_segments: list[str], episode_id: int):
    transcript_parts = []
    for s in file_segments:
        # uploading segment
        upload_blob(ROOT_DIR / "dir" /  s, s)
        # transcribe segment
        segment_transcript = transcribe_batch_gcs_input_inline_output_v2(s)
        transcript_parts.append(segment_transcript)
        print("removing segment")
        delete_blob(s)
        # remove(ROOT_DIR / "dir" /  s)
    print("storing transcript")
    db.execute_query(
        '''UPDATE episode SET transcripts = %(transcript_parts)s
        WHERE id = %(id)s
        ''',
        {"id": episode_id, "transcript_parts": json.dumps(transcript_parts, ensure_ascii=False).encode('utf8')}, "id"
    )