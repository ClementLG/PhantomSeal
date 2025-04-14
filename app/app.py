# app.py
import os
import logging
from datetime import datetime
from flask import Flask, render_template, request, jsonify, url_for, send_from_directory
from werkzeug.utils import secure_filename
import config
from watermark_logic import add_visible_text_watermark # Assuming calculate_degradation is not used directly here

# ... (Initialisation de Flask, chargement config, création dossiers, logging) ...
app = Flask(__name__)
app.config.from_object(config)
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['OUTPUT_FOLDER'], exist_ok=True)
app.config['TEMPLATES_AUTO_RELOAD'] = True
logging.basicConfig(level=logging.DEBUG)


# --- Routes ---

@app.route('/')
def index():
    # ... (Code inchangé) ...
    current_year = datetime.now().year
    try:
        return render_template(
            'index.html',
            max_files=app.config['MAX_FILES'],
            allowed_extensions=list(app.config.get('ALLOWED_EXTENSIONS', [])),
            max_visible_text=app.config['MAX_VISIBLE_TEXT_LENGTH'],
            max_invisible_text=app.config['MAX_INVISIBLE_TEXT_LENGTH'],
            current_year=current_year
        )
    except KeyError as e:
        app.logger.error(f"Configuration key error in index route: {e}")
        return f"<h1>Configuration Error</h1><p>Missing key: {e}</p>", 500

def allowed_file(filename):
    """Checks if the file extension is allowed."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

@app.route('/process', methods=['POST'])
def process_images():
    """Handles image upload and watermarking process for MULTIPLE files."""
    app.logger.info("Received request on /process")

    # --- Get Parameters (once for all files) ---
    try:
        # ... (Code existant pour récupérer watermark_text, type, position, color, etc.) ...
        watermark_text = request.form.get('watermark_text', '')
        max_len = app.config.get('MAX_VISIBLE_TEXT_LENGTH', 50)
        if len(watermark_text) > max_len:
             return jsonify({"success": False, "error": f"Watermark text exceeds maximum length of {max_len}."}), 400
        watermark_type = request.form.get('watermark_type', 'visible')
        position = request.form.get('position', 'bottom-right')
        font_size_ratio = float(request.form.get('font_size_ratio', 0.05))
        hex_color = request.form.get('color', '#FFFFFF')
        opacity = int(request.form.get('opacity', 128))
        hex_color = hex_color.lstrip('#')
        rgb_color = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
        rgba_color = rgb_color + (max(0, min(255, opacity)),)
        margin_ratio = float(request.form.get('margin_ratio', 0.02))
        repeat = request.form.get('repeat', 'false').lower() == 'true'
        angle = int(request.form.get('angle', 0))
        spacing_ratio = float(request.form.get('spacing_ratio', 0.5))
        font_path = app.config.get('FONT_PATH')

        # Validate font path once
        if watermark_type == 'visible' and (not font_path or not os.path.exists(font_path)):
             app.logger.error(f"Font file not found at configured path: {font_path}")
             return jsonify({"success": False, "error": "Server configuration error: Font file not found."}), 500

    except Exception as e:
        app.logger.error(f"Error parsing form parameters: {e}")
        return jsonify({"success": False, "error": "Invalid parameters received."}), 400

    # --- Get Files (as a list) ---
    if 'images' not in request.files:
        return jsonify({"success": False, "error": "No image file part in the request."}), 400

    uploaded_file_list = request.files.getlist('images') # Get list of files

    if not uploaded_file_list or all(f.filename == '' for f in uploaded_file_list):
         return jsonify({"success": False, "error": "No image selected for upload."}), 400

    # --- Process Each File ---
    results = [] # Store results for each file
    processed_count = 0
    error_count = 0

    for file in uploaded_file_list:
        original_filename = secure_filename(file.filename) # Secure early
        app.logger.info(f"Processing file: {original_filename}")
        temp_input_path = None # Define before try block for cleanup

        # Skip empty filename submissions that might sneak through
        if not original_filename:
             app.logger.warning("Skipping file with empty filename.")
             continue

        if allowed_file(original_filename):
            try:
                # --- Save temporary input file ---
                temp_input_path = os.path.join(app.config['UPLOAD_FOLDER'], f"temp_{original_filename}")
                file.save(temp_input_path)
                app.logger.debug(f"Temporarily saved {original_filename} to {temp_input_path}")

                # --- Prepare Output Path ---
                basename, ext = os.path.splitext(original_filename)
                # Add timestamp or unique ID to prevent overwrites if same filename is uploaded twice?
                # timestamp = datetime.now().strftime("%Y%m%d%H%M%S%f")
                # output_filename = f"{basename}_{timestamp}_watermarked{ext}"
                output_filename = f"{basename}_watermarked{ext}" # Simpler for now
                output_path = os.path.join(app.config['OUTPUT_FOLDER'], output_filename)

                # --- Apply Watermark ---
                if watermark_type == 'visible':
                    # Call the watermarking function
                    add_visible_text_watermark(
                        image_input=temp_input_path,
                        text=watermark_text,
                        output_path=output_path,
                        font_path=font_path,
                        font_size_ratio=font_size_ratio,
                        color=rgba_color,
                        position=position,
                        margin_ratio=margin_ratio,
                        repeat=repeat,
                        angle=angle,
                        spacing_ratio=spacing_ratio
                    )
                elif watermark_type == 'invisible':
                    # Placeholder for future implementation
                    app.logger.warning(f"Invisible watermarking skipped for {original_filename}")
                    # For now, just record it wasn't processed this way
                    results.append({
                         "original_filename": original_filename,
                         "status": "skipped",
                         "message": "Invisible watermarking not implemented."
                    })
                    error_count += 1
                    continue # Go to next file

                # --- Generate URL and add to results ---
                download_url = url_for('download_file', filename=output_filename, _external=True)
                results.append({
                    "original_filename": original_filename,
                    "output_filename": output_filename,
                    "download_url": download_url,
                    "status": "success"
                })
                processed_count += 1
                app.logger.info(f"Successfully processed {original_filename} -> {output_filename}")

            except Exception as e:
                app.logger.error(f"Error processing file {original_filename}: {e}", exc_info=True)
                results.append({
                    "original_filename": original_filename,
                    "status": "error",
                    "message": str(e) # Send error message back
                })
                error_count += 1
            finally:
                # --- Clean up temporary input file ---
                if temp_input_path and os.path.exists(temp_input_path):
                    try:
                        os.remove(temp_input_path)
                        app.logger.debug(f"Removed temporary file: {temp_input_path}")
                    except Exception as clean_e:
                         app.logger.error(f"Error removing temp file {temp_input_path}: {clean_e}")
        else:
            app.logger.warning(f"File type not allowed for {original_filename}")
            results.append({
                "original_filename": original_filename,
                "status": "error",
                "message": "Invalid file type."
            })
            error_count += 1

    # --- Return Final Response ---
    final_success = error_count == 0 # Overall success only if no errors occurred
    message = f"Processing complete. {processed_count} succeeded, {error_count} failed."

    return jsonify({
        "success": final_success, # Overall status
        "message": message,
        "results": results # List containing status for each file
    })

# Route to download processed files (no changes needed)
@app.route('/outputs/<filename>')
def download_file(filename):
    # ... (Code inchangé) ...
    safe_filename = secure_filename(filename)
    if safe_filename != filename:
         return "Invalid filename", 404
    try:
        return send_from_directory(app.config['OUTPUT_FOLDER'], safe_filename, as_attachment=False)
    except FileNotFoundError:
         return "File not found", 404


# --- Entry point ---
if __name__ == '__main__':
    app.run(debug=True)