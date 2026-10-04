"""Upload a folder built by build.py to the Hugging Face dataset repo.

  HF_TOKEN=... python scripts/hf/push.py <out-dir>

Creates the repo on first run. Unchanged files are skipped, and files no longer
built are deleted from the repo.
"""

import sys

from huggingface_hub import HfApi

REPO_ID = "mertguvencli/aifomoindex"

if len(sys.argv) != 2:
    sys.exit(__doc__)

api = HfApi()
api.create_repo(REPO_ID, repo_type="dataset", exist_ok=True)
commit = api.upload_folder(
    repo_id=REPO_ID,
    repo_type="dataset",
    folder_path=sys.argv[1],
    commit_message="Sync from GitHub",
    delete_patterns="*",
)
print(commit.commit_url if commit else "No changes")
