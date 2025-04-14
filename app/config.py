# config.py
import os

# Get the base directory of the application
BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# --- Upload Settings ---
MAX_FILES = 10
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'}
# Define upload folder (relative to app.py location)
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
# Define output folder for watermarked images
OUTPUT_FOLDER = os.path.join(BASE_DIR, 'outputs')


# --- Watermark Settings ---
MAX_VISIBLE_TEXT_LENGTH = 50
MAX_INVISIBLE_TEXT_LENGTH = 50
# REQUIRED: Path to the font file (relative to app.py location or absolute)
# Place a font like 'DejaVuSans.ttf' in your project (e.g., in static/fonts)
# Or provide an absolute path.
FONT_PATH = os.path.join(BASE_DIR, 'static', 'fonts', 'DejaVuSans.ttf') # EXAMPLE PATH - ADJUST AS NEEDED