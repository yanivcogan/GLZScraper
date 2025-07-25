from google.cloud import storage

gc_project_name = "glz-archives"
gc_bucket_name = "glz-content"


def upload_blob(source_file_name, destination_blob_name):
    """Uploads a file to the bucket."""
    # The ID of your GCS bucket
    # bucket_name = "your-bucket-name"
    # The path to your file to upload
    # source_file_name = "local/path/to/file"
    # The ID of your GCS object
    # destination_blob_name = "storage-object-name"

    print(
        f"Uploading file {source_file_name} to {destination_blob_name}."
    )

    storage_client = storage.Client(project=gc_project_name)
    bucket = storage_client.bucket(gc_bucket_name)
    blob = bucket.blob(destination_blob_name)

    blob.upload_from_filename(source_file_name, timeout=120000)

    print(
        f"File {source_file_name} uploaded to {destination_blob_name}."
    )


def delete_blob(blob_name):
    """Deletes a blob from the bucket."""
    # bucket_name = "your-bucket-name"
    # blob_name = "your-object-name"

    print(f"Deleting {blob_name} from Google Cloud Storage.")

    storage_client = storage.Client(project=gc_project_name)

    bucket = storage_client.bucket(gc_bucket_name)
    blob = bucket.blob(blob_name)
    blob.delete()

    print(f"Blob {blob_name} deleted.")
