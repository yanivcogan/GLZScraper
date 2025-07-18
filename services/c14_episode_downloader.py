import time
import urllib
import urllib.request
import os
import requests
import subprocess
import m3u8
from fake_useragent import UserAgent

from root_anchor import ROOT_DIR
from utils import db

ua = UserAgent()


def download_remaining_c14_episodes():
    return db.execute_query(
        '''SELECT e.*
           FROM episode AS e
           WHERE e.channel_id = 1
             AND e.local_storage IS NULL
             AND e.download_status <> 'error'
             AND e.duplicate_of IS NULL
             AND e.transcripts IS NULL
           ORDER BY e.air_date
           LIMIT 1
        ''',
        {}, "single_row"
    )


def download_c14_m3u8_file(m3u8_url: str, filename: str, file_ext: str = "mp3"):
    # Step 1: Download and parse master m3u8
    master_m3u8 = m3u8.load(m3u8_url)
    # Step 2: Find lowest bandwidth stream
    lowest_stream = min(master_m3u8.playlists, key=lambda x: x.stream_info.bandwidth)
    stream_url = urllib.parse.urljoin(m3u8_url, lowest_stream.uri)
    # Step 3: Download stream playlist
    stream_m3u8 = m3u8.load(stream_url)
    # Step 4: Download all segments
    segment_files = []
    for i, seg in enumerate(stream_m3u8.segments):
        print("downloading segment " + str(i + 1) + " of " + str(len(stream_m3u8.segments)))
        seg_url = urllib.parse.urljoin(stream_url, seg.uri)
        seg_file = ROOT_DIR / "dir" / f"{filename}_seg{i}.ts"
        with open(seg_file, "wb") as f:
            f.write(requests.get(seg_url).content)
        segment_files.append(seg_file)
    # Step 5: Concatenate segments
    concat_file = ROOT_DIR / "dir" / f"{filename}_concat.ts"
    with open(concat_file, "wb") as outfile:
        print("concatenating segments")
        for seg_file in segment_files:
            with open(seg_file, "rb") as infile:
                outfile.write(infile.read())
            os.remove(seg_file)
    # Step 6: Convert to mp3 using ffmpeg
    mp3_file = ROOT_DIR / "dir" / f"{filename}.{file_ext}"
    subprocess.run([
        "ffmpeg", "-y", "-i", concat_file, "-vn", "-acodec", "libmp3lame", "-ab", "32k", mp3_file
    ], check=True)
    os.remove(concat_file)
    print("done_downloading " + filename)


if __name__ == "__main__":
    start_time = time.time()
    download_c14_m3u8_file(
        "https://channel14.vod.immergo.tv/channel14/transcoded/0d02188a-2d39-4771-8088-ffcea7f90c26/hls/master.m3u8",
        "text", "mp3")
    end_time = time.time()
    print(f"Download completed in {end_time - start_time:.2f} seconds")
