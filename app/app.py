# app.py
import os
import logging
import uuid # For unique filenames
from datetime import datetime
from flask import (Flask, render_template, request, jsonify, url_for,
                   send_from_directory, abort) # Added abort
from werkzeug.utils import secure_filename
from PIL import Image # Needed for size check, maybe more later

# Assume config.py and watermark_logic.py are in the same directory (app/)
import config
from watermark_logic import add_visible_text_watermark

# Initialize the Flask application
app = Flask(__name__)

# Load configuration from config.py
app.config.from_object(config)

# Set max content length for Flask (total request size) from config
# Ensure it's loaded before routes that handle uploads
try:
    app.config['MAX_CONTENT_LENGTH'] = app.config['MAX_CONTENT_LENGTH']
except KeyError:
    logging.error("MAX_CONTENT_LENGTH not found in config. Please define it in config.py.")
    # Set a default or raise an error if critical
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024 # Default to 16MB if missing

# Ensure upload and output folders exist
# It's good practice to check if keys exist before using them
upload_folder = app.config.get('UPLOAD_FOLDER', 'uploads') # Use default if missing
output_folder = app.config.get('OUTPUT_FOLDER', 'outputs') # Use default if missing
os.makedirs(upload_folder, exist_ok=True)
os.makedirs(output_folder, exist_ok=True)


# Configure template auto-reloading
app.config['TEMPLATES_AUTO_RELOAD'] = True

# Setup basic logging
logging.basicConfig(level=logging.DEBUG)
app.logger.setLevel(logging.DEBUG) # Ensure app logger respects the level

# --- Helper ---
def allowed_file(filename):
    """Checks if the file extension is allowed."""
    allowed_extensions = app.config.get('ALLOWED_EXTENSIONS', set())
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in allowed_extensions

# --- Cleanup Function ---
def cleanup_output_folder(folder_path, max_files_to_keep):
    """Removes oldest files from the folder if count exceeds max_files_to_keep."""
    try:
        app.logger.debug(f"Running cleanup for folder: {folder_path}, max files: {max_files_to_keep}")
        # Get all files matching allowed extensions in the directory
        files_with_path = [
            os.path.join(folder_path, f)
            for f in os.listdir(folder_path)
            if os.path.isfile(os.path.join(folder_path, f)) and allowed_file(f)
        ]

        if len(files_with_path) > max_files_to_keep:
            app.logger.info(f"Found {len(files_with_path)} image files, exceeding limit of {max_files_to_keep}. Cleaning up...")
            # Sort files by modification time (oldest first)
            files_with_path.sort(key=os.path.getmtime)

            # Calculate how many files to delete
            num_to_delete = len(files_with_path) - max_files_to_keep

            # Get the list of oldest files to delete
            files_to_delete = files_with_path[:num_to_delete]

            # Delete the oldest files
            deleted_count = 0
            for file_path in files_to_delete:
                try:
                    os.remove(file_path)
                    app.logger.info(f"Cleanup: Deleted old file {os.path.basename(file_path)}")
                    deleted_count += 1
                except FileNotFoundError:
                     app.logger.warning(f"Cleanup: File not found during deletion (possibly deleted by another process): {file_path}")
                except OSError as e:
                    app.logger.error(f"Cleanup: Error deleting file {file_path}: {e}")
            app.logger.info(f"Cleanup finished. Deleted {deleted_count} files.")
        else:
             app.logger.debug(f"Found {len(files_with_path)} image files. No cleanup needed (Limit: {max_files_to_keep}).")

    except FileNotFoundError:
        app.logger.warning(f"Cleanup: Output folder not found: {folder_path}")
    except Exception as e:
        app.logger.error(f"Error during output folder cleanup: {e}", exc_info=True)


# --- Routes ---

@app.route('/')
def index():
    """Renders the home page (Apply Watermark)."""
    current_year = datetime.now().year
    try:
        # Ensure all required config keys exist before rendering
        required_keys = ['MAX_FILES', 'ALLOWED_EXTENSIONS', 'MAX_VISIBLE_TEXT_LENGTH',
                         'MAX_INVISIBLE_TEXT_LENGTH', 'MAX_CONTENT_LENGTH']
        for key in required_keys:
            if key not in app.config:
                 raise KeyError(f"Missing configuration key: {key}")

        return render_template(
            'index.html',
            active_page='index', # For navbar highlighting
            max_files=app.config['MAX_FILES'],
            allowed_extensions=list(app.config.get('ALLOWED_EXTENSIONS', [])),
            max_visible_text=app.config['MAX_VISIBLE_TEXT_LENGTH'],
            max_invisible_text=app.config['MAX_INVISIBLE_TEXT_LENGTH'],
            # Pass individual file size limit in bytes for JS validation
            max_file_size_bytes=app.config['MAX_CONTENT_LENGTH'],
            current_year=current_year
        )
    except KeyError as e:
        app.logger.error(f"Configuration key error rendering index route: {e}")
        # Provide a more user-friendly error page if possible
        return f"<h1>Server Configuration Error</h1><p>A required configuration value is missing: {e}. Please contact the administrator.</p>", 500


@app.route('/gallery')
def gallery():
    """Renders the gallery page."""
    current_year = datetime.now().year
    image_files = []
    output_folder = app.config['OUTPUT_FOLDER']
    max_gallery_files = app.config.get('MAX_GALLERY_FILES', 50) # Get limit for display message

    if os.path.exists(output_folder):
        try:
            files_with_mtime = []
            for filename in os.listdir(output_folder):
                if allowed_file(filename):
                     filepath = os.path.join(output_folder, filename)
                     if os.path.isfile(filepath):
                         files_with_mtime.append((filename, os.path.getmtime(filepath)))

            # Sort by modification time, newest first
            files_with_mtime.sort(key=lambda x: x[1], reverse=True)
            # Get only the filenames from the sorted list
            image_files = [f[0] for f in files_with_mtime]

        except Exception as e:
            app.logger.error(f"Error reading output folder {output_folder}: {e}")
            # Optionally pass an error flag/message to the template

    return render_template(
        'gallery.html',
        active_page='gallery',
        image_filenames=image_files,
        max_gallery_files=max_gallery_files, # Pass the limit
        current_year=current_year
    )


@app.route('/extract')
def extract():
    """Renders the (empty) data extraction page."""
    current_year = datetime.now().year
    return render_template(
        'extract.html',
        active_page='extract',
        current_year=current_year
    )


@app.route('/process', methods=['POST'])
def process_images():
    """Handles image upload and watermarking process for MULTIPLE files."""
    app.logger.info("Received request on /process")
    # --- Get Parameters ---
    try:
        watermark_text = request.form.get('watermark_text', '')
        max_len = app.config.get('MAX_VISIBLE_TEXT_LENGTH', 50)
        if len(watermark_text) > max_len:
             return jsonify({"success": False, "error": f"Watermark text exceeds maximum length of {max_len}."}), 400
        watermark_type = request.form.get('watermark_type', 'visible')
        position = request.form.get('position', 'bottom-right')
        # Use .get with default for robustness
        font_size_ratio = float(request.form.get('font_size_ratio', 0.05))
        hex_color = request.form.get('color', '#FFFFFF')
        opacity = int(request.form.get('opacity', 128))
        hex_color = hex_color.lstrip('#')
        # Handle potential errors during hex conversion
        if len(hex_color) != 6: raise ValueError("Invalid hex color format")
        rgb_color = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
        rgba_color = rgb_color + (max(0, min(255, opacity)),) # Clamp opacity
        margin_ratio = float(request.form.get('margin_ratio', 0.02))
        repeat = request.form.get('repeat', 'false').lower() == 'true'
        angle = int(request.form.get('angle', 0))
        spacing_ratio = float(request.form.get('spacing_ratio', 0.5))
        font_path = app.config.get('FONT_PATH')

        if watermark_type == 'visible' and (not font_path or not os.path.exists(font_path)):
             app.logger.error(f"Font file not found at configured path: {font_path}")
             return jsonify({"success": False, "error": "Server configuration error: Font file not found."}), 500

    except (ValueError, TypeError) as e: # Catch specific conversion errors
        app.logger.error(f"Error parsing form parameters: {e}")
        return jsonify({"success": False, "error": f"Invalid parameter value: {e}"}), 400
    except Exception as e: # Catch other potential errors
        app.logger.error(f"Unexpected error parsing form parameters: {e}", exc_info=True)
        return jsonify({"success": False, "error": "Invalid parameters received."}), 400


    # --- Get Files ---
    if 'images' not in request.files:
        return jsonify({"success": False, "error": "No image file part in the request."}), 400
    uploaded_file_list = request.files.getlist('images')
    if not uploaded_file_list or all(f.filename == '' for f in uploaded_file_list):
         return jsonify({"success": False, "error": "No image selected for upload."}), 400

    # --- Process Each File ---
    results = []
    processed_count = 0
    error_count = 0
    # Use .get for config values with defaults where appropriate
    max_size_bytes = app.config.get('MAX_CONTENT_LENGTH', 16*1024*1024)
    max_size_mb = app.config.get('MAX_FILE_SIZE_MB', 16)
    max_gallery_files = app.config.get('MAX_GALLERY_FILES', 50)
    output_folder = app.config['OUTPUT_FOLDER'] # Assumed required

    for file in uploaded_file_list:
        original_filename = secure_filename(file.filename)
        app.logger.info(f"Processing file: {original_filename}")
        temp_input_path = None

        if not original_filename: continue

        # --- Server-side Size Check ---
        file.seek(0, os.SEEK_END); file_length = file.tell(); file.seek(0)
        if file_length > max_size_bytes:
             app.logger.warning(f"File {original_filename} ({file_length} bytes) exceeds size limit.")
             results.append({"original_filename": original_filename, "status": "error", "message": f"Exceeds {max_size_mb} MB limit."})
             error_count += 1; continue

        # --- Check Allowed Extension ---
        if allowed_file(original_filename):
            try:
                # --- Save Temp ---
                temp_name = f"temp_{uuid.uuid4().hex}_{original_filename}"
                temp_input_path = os.path.join(app.config['UPLOAD_FOLDER'], temp_name)
                file.save(temp_input_path)

                # --- Prepare Output Path ---
                basename, ext = os.path.splitext(original_filename)
                unique_suffix = uuid.uuid4().hex[:8]
                output_filename = f"{basename}_{unique_suffix}_watermarked{ext}"
                output_path = os.path.join(output_folder, output_filename)

                # --- Apply Watermark ---
                if watermark_type == 'visible':
                    add_visible_text_watermark(
                        image_input=temp_input_path, text=watermark_text, output_path=output_path,
                        font_path=font_path, font_size_ratio=font_size_ratio, color=rgba_color,
                        position=position, margin_ratio=margin_ratio, repeat=repeat, angle=angle,
                        spacing_ratio=spacing_ratio
                    )
                elif watermark_type == 'invisible':
                    app.logger.warning(f"Invisible watermarking skipped for {original_filename}")
                    results.append({"original_filename": original_filename, "status": "skipped", "message": "Invisible watermarking not implemented."})
                    error_count += 1; continue # Go to finally block for cleanup

                # --- Success: Add result ---
                download_url = url_for('download_file', filename=output_filename, _external=True)
                results.append({"original_filename": original_filename, "output_filename": output_filename, "download_url": download_url, "status": "success"})
                processed_count += 1
                app.logger.info(f"Successfully processed {original_filename} -> {output_filename}")

                # --- CALL CLEANUP AFTER SUCCESSFUL SAVE ---
                cleanup_output_folder(output_folder, max_gallery_files)

            except FileNotFoundError as e: # Specific errors
                 app.logger.error(f"File not found error processing {original_filename}: {e}")
                 results.append({"original_filename": original_filename, "status": "error", "message": f"Error: {e}"})
                 error_count += 1
            except ValueError as e: # Specific errors
                 app.logger.error(f"Value error processing {original_filename}: {e}")
                 results.append({"original_filename": original_filename, "status": "error", "message": f"Invalid value: {e}"})
                 error_count += 1
            except Exception as e: # General errors
                app.logger.error(f"Unexpected error processing file {original_filename}: {e}", exc_info=True)
                results.append({"original_filename": original_filename, "status": "error", "message": "Internal server error during processing."}) # Generic message to user
                error_count += 1
            finally:
                # --- Clean up temporary input file ---
                if temp_input_path and os.path.exists(temp_input_path):
                    try: os.remove(temp_input_path)
                    except Exception as clean_e: app.logger.error(f"Error removing temp file {temp_input_path}: {clean_e}")
        else:
             # File type not allowed
             app.logger.warning(f"File type not allowed for {original_filename}")
             results.append({"original_filename": original_filename, "status": "error", "message": "Invalid file type."})
             error_count += 1

    # --- Return Final Response ---
    final_success = error_count == 0 and processed_count > 0
    message = f"Processing complete. {processed_count} succeeded, {error_count} failed/skipped."
    return jsonify({"success": final_success, "message": message, "results": results})


# Route to download processed files
@app.route('/outputs/<path:filename>') # Use path converter for safety
def download_file(filename):
    """Serves files from the output folder."""
    app.logger.debug(f"Request to download file: {filename}")
    # Use send_from_directory for security (handles path validation)
    try:
        return send_from_directory(app.config['OUTPUT_FOLDER'], filename, as_attachment=False)
    except FileNotFoundError:
         app.logger.warning(f"Download request for non-existent file: {filename}")
         abort(404) # Not Found

# --- Error Handler for 413 Request Entity Too Large ---
@app.errorhandler(413)
def request_entity_too_large(error):
     max_mb = app.config.get('MAX_FILE_SIZE_MB', '?') # Get MB limit for message
     return jsonify(success=False, error=f"Upload failed: Total request size exceeds the server limit ({max_mb} MB). Please upload smaller files or fewer files at once."), 413


# --- Entry point ---
if __name__ == '__main__':
    # Consider setting host='0.0.0.0' if running in Docker or need external access
    app.run(debug=True)