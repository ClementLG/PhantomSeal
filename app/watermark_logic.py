# watermark_logic.py
from PIL import Image, ImageDraw, ImageFont
import math
import os # Needed for font path joining

def add_visible_text_watermark(
    image_input,  # Can be image path (str) or PIL Image object
    text,
    output_path=None, # Path to save, if None returns PIL Image object
    # --- Basic Parameters ---
    font_path=None, # REQUIRED: Path to .ttf or .otf font file
    font_size_ratio=0.05, # Font size as ratio of image's smaller dimension
    color=(255, 255, 255, 128), # RGBA tuple (White, 50% transparent default)
    position='bottom-right', # Options: 'center', 'top-left', 'top-right', ... or (x, y) tuple
    margin_ratio=0.02, # Margin from edges as ratio of image's smaller dimension
    # --- Repetition Parameters ---
    repeat=False,
    angle=0, # Rotation angle in degrees
    spacing_ratio=0.5, # Gap between repetitions as ratio of watermark size (if repeat=True)
    # --- Other Parameters ---
    quality=95, # For saving JPEG
    ):
    """
    Adds a visible text watermark to an image with various options.

    Args:
        image_input: Path to the input image or a PIL Image object.
        text: The watermark text.
        output_path: Path to save the watermarked image. If None, returns the Image object.
        font_path: Path to the TTF/OTF font file. REQUIRED.
        font_size_ratio: Font size relative to the image's smaller dimension.
        color: RGBA tuple for text color and transparency (0-255 for each channel).
        position: String keyword ('center', 'bottom-right', etc.) or (x, y) tuple for top-left corner.
        margin_ratio: Margin from edges for keyword positions.
        repeat: Boolean, whether to tile the watermark.
        angle: Rotation angle for the text (degrees).
        spacing_ratio: Spacing between repeated watermarks relative to watermark size.
        quality: JPEG save quality (if applicable).

    Returns:
        PIL Image object if output_path is None, otherwise None.

    Raises:
        FileNotFoundError: If the image or font file cannot be found.
        ValueError: If required parameters are missing or invalid.
        TypeError: If image_input is not a PIL Image or valid path string.
    """
    if not font_path:
        raise ValueError("font_path is required.")
    if not os.path.exists(font_path):
         # Try a fallback relative to this script? Adapt as needed.
         script_dir = os.path.dirname(__file__)
         fallback_font_path = os.path.join(script_dir, font_path)
         if not os.path.exists(fallback_font_path):
              raise FileNotFoundError(f"Font file not found at '{font_path}' or '{fallback_font_path}'")
         font_path = fallback_font_path # Use fallback if found

    # --- 1. Open Image & Prepare ---
    if isinstance(image_input, str):
        try:
            base_image = Image.open(image_input).convert("RGBA")
        except FileNotFoundError:
            raise FileNotFoundError(f"Input image not found at '{image_input}'")
        except Exception as e:
            raise IOError(f"Error opening image '{image_input}': {e}")
    elif isinstance(image_input, Image.Image):
        base_image = image_input.convert("RGBA")
    else:
        raise TypeError("image_input must be a file path (str) or PIL Image object")

    img_width, img_height = base_image.size
    smaller_dim = min(img_width, img_height)

    # Create a transparent overlay layer
    overlay = Image.new("RGBA", base_image.size, (255, 255, 255, 0))
    draw = ImageDraw.Draw(overlay)

    # --- 2. Prepare Font & Text ---
    try:
        font_size_px = max(10, int(smaller_dim * font_size_ratio)) # Ensure minimum size
        font = ImageFont.truetype(font_path, font_size_px)
    except IOError:
        raise FileNotFoundError(f"Error loading font file at '{font_path}'. Make sure it's a valid TTF/OTF file.")

    # Calculate text bounding box using textbbox for better accuracy
    # We need a starting point (0,0) - the box might have negative coords if font descends below baseline
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    # text_left = bbox[0] # Offset from the drawing point (0,0)
    text_top = bbox[1] # Offset from the drawing point (0,0)

    if text_width <= 0 or text_height <= 0:
        print("Warning: Calculated text width or height is zero or negative.")
        return base_image.convert("RGB") if output_path else base_image # Return original if text is empty

    # --- 3. Calculate Position or Prepare for Tiling ---
    margin_px = int(smaller_dim * margin_ratio)

    if not repeat:
        # --- 3a. Single Watermark Positioning ---
        x, y = 0, 0
        if isinstance(position, (tuple, list)) and len(position) == 2:
            x, y = int(position[0]), int(position[1])
        elif isinstance(position, str):
            pos_str = position.lower()
            # Horizontal alignment
            if 'left' in pos_str:
                x = margin_px
            elif 'center' in pos_str:
                x = (img_width - text_width) // 2
            elif 'right' in pos_str:
                x = img_width - text_width - margin_px
            else: # Default horizontal (e.g., if only 'top' or 'bottom')
                x = margin_px

            # Vertical alignment
            if 'top' in pos_str:
                y = margin_px
            elif 'center' in pos_str:
                y = (img_height - text_height) // 2
            elif 'bottom' in pos_str:
                y = img_height - text_height - margin_px
            else: # Default vertical (e.g., if only 'left' or 'right')
                y = margin_px
        else:
            raise ValueError("Invalid position format. Use string keyword or (x, y) tuple.")

        # Adjust y based on the text's top offset from baseline
        # We calculated position for the top of the visual box, but draw.text uses baseline
        # However, textbbox already accounts for this relative to (0,0)
        # We need to draw at (x - text_left, y - text_top) but simpler:
        # Draw the text within its own box first
        txt_img = Image.new('RGBA', (text_width, text_height), (0,0,0,0))
        txt_draw = ImageDraw.Draw(txt_img)
        # Draw text at (-left, -top) within its own image to align top-left at (0,0)
        txt_draw.text((-bbox[0], -bbox[1]), text, font=font, fill=color)

        if angle != 0:
             # Rotate the text image itself
             txt_img = txt_img.rotate(angle, expand=True, fillcolor=(0,0,0,0))
             # Recalculate position for the center of the rotated text if needed,
             # or adjust x, y based on expanded size if keeping top-left anchor logic.
             # For simplicity with rotation on single text, let's re-center based on original pos logic.
             # This part needs refinement for accurate positioning of rotated single text.
             # A common approach is to place the *center* of the rotated box.
             center_x = x + text_width / 2
             center_y = y + text_height / 2
             new_w, new_h = txt_img.size
             x = int(center_x - new_w / 2)
             y = int(center_y - new_h / 2)


        # Paste the (potentially rotated) text image onto the overlay
        overlay.paste(txt_img, (x, y), txt_img) # Use text image as mask

    else:
        # --- 3b. Tiled Watermark ---
        # Create the base text stamp (unrotated first)
        # Pad slightly to avoid clipping during rotation
        padding = 5
        stamp_w = text_width + 2 * padding
        stamp_h = text_height + 2 * padding
        txt_img = Image.new('RGBA', (stamp_w, stamp_h), (0,0,0,0))
        txt_draw = ImageDraw.Draw(txt_img)
        # Draw text centered within the padded box
        txt_draw.text((padding - bbox[0], padding - bbox[1]), text, font=font, fill=color)

        # Rotate the stamp
        if angle != 0:
            txt_img = txt_img.rotate(angle, expand=True, fillcolor=(0,0,0,0))
            # Get new dimensions after rotation
            stamp_w, stamp_h = txt_img.size

        if stamp_w <= 0 or stamp_h <= 0:
             print("Warning: Rotated text stamp width or height is zero.")
             return base_image.convert("RGB") if output_path else base_image

        # Calculate spacing in pixels
        space_x = int(stamp_w * spacing_ratio)
        space_y = int(stamp_h * spacing_ratio)
        step_x = stamp_w + space_x
        step_y = stamp_h + space_y

        if step_x <= 0 or step_y <= 0:
            print("Warning: Tiling step size is zero or negative. Check spacing.")
            return base_image.convert("RGB") if output_path else base_image


        # Tile the stamp across the overlay
        # Start slightly off-canvas to ensure full coverage if rotated
        start_offset_x = -stamp_w // 4
        start_offset_y = -stamp_h // 4
        for x in range(start_offset_x, img_width, step_x):
            for y in range(start_offset_y, img_height, step_y):
                 # Handle potential floating point precision issues if pasting fails
                try:
                    overlay.paste(txt_img, (x, y), txt_img) # Use stamp as mask
                except ValueError as paste_error:
                     print(f"Warning: Error pasting tile at ({x}, {y}): {paste_error}")
                     # This might happen if coordinates become invalid, try skipping
                     continue


    # --- 4. Composite Overlay onto Base Image ---
    watermarked_image = Image.alpha_composite(base_image, overlay)

    # --- 5. Save or Return ---
    # Convert back to RGB if saving as JPEG or if original had no alpha
    # Keep RGBA if saving as PNG/WEBP and transparency is desired
    file_ext = ""
    if output_path:
        file_ext = os.path.splitext(output_path)[1].lower()

    if file_ext in ['.jpg', '.jpeg']:
        # JPEGs don't support alpha, convert to RGB
        final_image = watermarked_image.convert("RGB")
        try:
            final_image.save(output_path, quality=quality, optimize=True) # Added optimize
            print(f"Watermarked image saved to {output_path}")
        except Exception as e:
            raise IOError(f"Error saving watermarked image to '{output_path}': {e}")
        return None # Indicate success by returning None when saving
    elif output_path:
        # Save formats that support alpha (PNG, WEBP, etc.) as RGBA
        final_image = watermarked_image # Keep as RGBA
        try:
            final_image.save(output_path) # Let Pillow handle format based on extension
            print(f"Watermarked image saved to {output_path}")
        except Exception as e:
             raise IOError(f"Error saving watermarked image to '{output_path}': {e}")
        return None # Indicate success
    else:
        # Return the PIL Image object (as RGBA)
        return watermarked_image

# --- Degradation Calculation ---

def calculate_degradation(
    image_width,
    image_height,
    text,
    font_size_ratio,
    color_rgba,
    repeat=False,
    spacing_ratio=0.5,
    angle=0,
    # Add other relevant params if needed, e.g., position impact?
    ):
    """
    Estimates a 'degradation' percentage based on watermark parameters.
    This is subjective and aims for logical correlation, not precise measurement.
    """
    degradation = 0.0

    # --- Base Degradation ---
    # Any watermark adds some minimal "impact"
    degradation += 5.0

    # --- Text Length ---
    # Longer text is slightly more impactful
    degradation += min(len(text) * 0.1, 5.0) # Cap contribution

    # --- Size Impact ---
    # Larger font size relative to image covers more area
    degradation += font_size_ratio * 150.0 # Scale factor (adjust as needed)

    # --- Opacity Impact ---
    # Less transparency (higher alpha) is more intrusive
    alpha = color_rgba[3] if len(color_rgba) == 4 else 255 # Default to opaque if no alpha
    opacity_factor = alpha / 255.0
    # More opaque means more degradation (inverse relationship with transparency)
    degradation += opacity_factor * 20.0 # Scale factor

    # --- Repetition Impact ---
    if repeat:
        degradation += 40.0 # Significant base increase for tiling

        # Angle: Diagonal tiling might be perceived as more disruptive
        if abs(angle) % 90 != 0: # If not perfectly horizontal/vertical
             degradation += 10.0

        # Spacing: Closer tiles (smaller spacing_ratio) are more impactful
        # Ensure spacing_ratio is capped (e.g., cannot be negative)
        valid_spacing_ratio = max(0, min(1, spacing_ratio))
        # Inverse relationship: as spacing ratio decreases, impact increases
        degradation += (1.0 - valid_spacing_ratio) * 25.0 # Scale factor

    # --- Other Factors (Optional) ---
    # Position: Center position might be considered more disruptive than corners?
    # if position == 'center': degradation += 5.0

    # Cap the degradation at 100%
    final_degradation = min(max(0, degradation), 100)

    return int(round(final_degree)) # Return as integer percentage