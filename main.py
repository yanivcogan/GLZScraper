# Press the green button in the gutter to run the script.

from episode_transcriber import transcribe_batch_gcs_input_inline_output_v2
from google_cloud_storage_manager import upload_blob, delete_blob
from services.episode_downloader import download_remaining_episodes
from services.file_hash_generator import gen_hash, find_duplicates

if __name__ == '__main__':
    # update_shows_archive("GLGLZ", datetime(2023, 10, 1), datetime.now())
    # extract_episodes_for_all_shows(datetime(2023, 10, 1), datetime.now())
    download_remaining_episodes()
    # transcribe_batch_gcs_input_inline_output_v2("2023-10-23_0000002102_p1.mp3")
    # upload_blob("dir/2023-11-22_0000002071_p1.mp3", "abc.mp3")
    # find_duplicates()

