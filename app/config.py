# config.py
import os

# Get the base directory of the application
BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# --- Upload Settings ---
MAX_FILES = 10
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'}
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
OUTPUT_FOLDER = os.path.join(BASE_DIR, 'outputs')
# Maximum file size in Megabytes for a single file
MAX_FILE_SIZE_MB = 20
# Calculate max size in bytes for Flask config (applied to total request size)
# and potentially for individual file checks
MAX_CONTENT_LENGTH = MAX_FILE_SIZE_MB * 1024 * 1024


# --- Watermark Settings ---
MAX_VISIBLE_TEXT_LENGTH = 50
MAX_INVISIBLE_TEXT_LENGTH = 50
FONT_PATH = os.path.join(BASE_DIR, 'static', 'fonts', 'DejaVuSans.ttf') # ADJUST AS NEEDED


# --- Gallery Settings ---
MAX_GALLERY_FILES = 3 # Keep the latest 50 watermarked images