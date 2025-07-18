from google.api_core import client_options
from google.cloud.speech_v2 import SpeechClient, BatchRecognizeResponse
from google.cloud.speech_v2.types import cloud_speech

from google_cloud_storage_manager import gc_project_name, gc_bucket_name


def transcribe_batch_gcs_input_inline_output_v2(
        gcs_object: str,
) -> list[dict]:
    """Transcribes audio from a Google Cloud Storage URI.

    Args:
        gcs_object: The Google Cloud Storage file name.

    Returns:
        The list[dict].
    """
    # Instantiates a client
    client_options_var = client_options.ClientOptions(
        api_endpoint="us-central1-speech.googleapis.com"
    )

    client = SpeechClient(
        client_options=client_options_var
    )

    config = cloud_speech.RecognitionConfig(
        auto_decoding_config=cloud_speech.AutoDetectDecodingConfig(),
        language_codes=["iw-IL"],
        model="chirp_2",
    )

    gcs_uri = f"gs://{gc_bucket_name}/" + gcs_object

    file_metadata = cloud_speech.BatchRecognizeFileMetadata(uri=gcs_uri)

    request = cloud_speech.BatchRecognizeRequest(
        recognizer=f"projects/{gc_project_name}/locations/us-central1/recognizers/_",
        config=config,
        files=[file_metadata],
        recognition_output_config=cloud_speech.RecognitionOutputConfig(
            inline_response_config=cloud_speech.InlineOutputConfig(),
        ),
        processing_strategy=cloud_speech.BatchRecognizeRequest.ProcessingStrategy.DYNAMIC_BATCHING,
    )

    # Transcribes the audio into text
    operation = client.batch_recognize(request=request)

    print("Waiting for transcription to complete...")
    response: BatchRecognizeResponse = operation.result(timeout=12000)

    response_as_json = [{
        "transcript": {
            "results": [{
                "offset": str(r2.result_end_offset),
                "alternatives": [a.transcript for a in r2.alternatives]
            } for r2 in response.results[r].transcript.results],
        }
    } for r in response.results]

    return response_as_json
