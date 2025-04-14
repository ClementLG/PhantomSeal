// static/js/script.js
document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration Reading ---
    const configData = document.getElementById('config-data');
    // Default values in case configData is missing or attributes are invalid
    let MAX_FILES = 10;
    let ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif']; // Basic default
    let MAX_VISIBLE_TEXT = 50;
    let MAX_INVISIBLE_TEXT = 50;

    console.log("DEBUG: Attempting to read config. Found #config-data element:", configData); // Debug log 1

    if (configData) {
        // Log raw data attribute values
        console.log("DEBUG: Raw data-max-files:", configData.dataset.maxFiles); // Debug log 2
        console.log("DEBUG: Raw data-allowed-extensions:", configData.dataset.allowedExtensions); // Debug log 3
        console.log("DEBUG: Raw data-max-visible-text:", configData.dataset.maxVisibleText); // Debug log 4
        console.log("DEBUG: Raw data-max-invisible-text:", configData.dataset.maxInvisibleText); // Debug log 5

        // Parse values with fallbacks to defaults
        MAX_FILES = parseInt(configData.dataset.maxFiles, 10) || MAX_FILES;
        try {
            const rawExtensions = configData.dataset.allowedExtensions || '[]';
            ALLOWED_EXTENSIONS = JSON.parse(rawExtensions).map(ext => String(ext).toLowerCase()); // Ensure lowercase strings
            console.log("DEBUG: Parsed ALLOWED_EXTENSIONS in JS:", ALLOWED_EXTENSIONS); // Debug log 6
        } catch (e) {
            console.error("Error parsing allowed extensions:", e); // Debug log 7 - Error
            console.error("Raw string causing error:", configData.dataset.allowedExtensions); // Debug log 8 - Context for Error
            // Keep default ALLOWED_EXTENSIONS on error
        }
        MAX_VISIBLE_TEXT = parseInt(configData.dataset.maxVisibleText, 10) || MAX_VISIBLE_TEXT;
        MAX_INVISIBLE_TEXT = parseInt(configData.dataset.maxInvisibleText, 10) || MAX_INVISIBLE_TEXT;

    } else {
        console.error("DEBUG: #config-data element NOT FOUND in the DOM. Using default config values."); // Debug log 9 - Error
    }
    console.log("DEBUG: Final config values being used:", { MAX_FILES, ALLOWED_EXTENSIONS, MAX_VISIBLE_TEXT, MAX_INVISIBLE_TEXT }); // Debug log 10

    // --- DOM Element References ---
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');
    const previewArea = document.getElementById('preview-area');
    const previewPlaceholder = document.getElementById('preview-placeholder');
    const processBtn = document.getElementById('process-btn');
    const watermarkForm = document.getElementById('watermark-form');
    const watermarkText = document.getElementById('watermark-text');
    const degradationPercent = document.getElementById('degradation-percent');
    const uploadErrors = document.getElementById('upload-errors');
    const textErrors = document.getElementById('text-errors'); // Div for Bootstrap invalid-feedback
    const textCharCount = document.getElementById('text-char-count');

    let uploadedFiles = []; // Keep track of VALIDATED and accepted files

    // --- Helper Functions ---
    function displayUploadError(message) {
        if (uploadErrors) {
            uploadErrors.innerHTML = message; // Use innerHTML for potential HTML tags like <br> or <a>
            uploadErrors.classList.remove('d-none');
            // Make sure it's styled as an error unless it's a success message
            if (!message.includes('alert-success')) {
                 uploadErrors.classList.remove('alert-success'); // Ensure previous success is removed
                 uploadErrors.classList.add('alert-danger');
            } else {
                 uploadErrors.classList.remove('alert-danger'); // Ensure previous error is removed
                 // Success class should be added within the message HTML directly
            }
        } else {
            console.error("Upload error display area not found.");
            alert(message); // Fallback
        }
    }

    function clearUploadErrors() {
        if (uploadErrors) {
            uploadErrors.textContent = '';
            uploadErrors.classList.add('d-none');
            // Reset alert type
            uploadErrors.classList.remove('alert-danger', 'alert-success', 'alert-warning'); // Include warning
        }
    }

     function displayTextError(message) {
        if (textErrors) {
            textErrors.textContent = message;
        } else {
            console.error("Text error display area not found.");
        }
        // Ensure Bootstrap class is added to the input for visibility
        if (watermarkText) {
            watermarkText.classList.add('is-invalid');
        }
    }

    function clearTextErrors() {
         if (textErrors) {
            textErrors.textContent = '';
         }
         if(watermarkText){
             watermarkText.classList.remove('is-invalid');
         }
    }

    function updateCharCount() {
        if (!watermarkText || !textCharCount) return; // Check elements exist

        const currentLength = watermarkText.value.length;
        const typeVisibleRadio = document.querySelector('input[name="watermark_type"][value="visible"]');
        // Default to visible if radio button not found or not checked (safer default)
        const typeVisible = typeVisibleRadio ? typeVisibleRadio.checked : true;
        const maxLength = typeVisible ? MAX_VISIBLE_TEXT : MAX_INVISIBLE_TEXT;

        textCharCount.textContent = `${currentLength} / ${maxLength}`; // Update counter

        // Manage validation state
        if (currentLength > maxLength) {
             displayTextError(`Maximum length is ${maxLength} characters.`); // Will also add is-invalid class
        } else {
             clearTextErrors(); // Will also remove is-invalid class
        }
        updateDegradationDisplay(); // Update degradation estimate as text changes
    }


    // --- Event Listeners Setup ---
    if (dropZone && fileInput && browseBtn) {
        dropZone.addEventListener('click', () => fileInput.click());
        browseBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering dropZone's click event
            fileInput.click();
        });
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            handleFiles(e.dataTransfer.files); // Process dropped files
            if (fileInput) fileInput.value = ''; // Clear input value after drop
        });
    } else {
         console.error("Initial setup error: Drop zone, file input, or browse button not found.");
    }


    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            handleFiles(e.target.files); // Process selected files
            // Clear input value after selection to allow re-selecting same file
             e.target.value = '';
        });
    } else {
         console.error("Initial setup error: File input element not found.");
    }

    // ADD EVENT LISTENER FOR DELETE BUTTONS (using event delegation)
    if (previewArea) {
        previewArea.addEventListener('click', (event) => {
            // Check if the clicked element *or its parent* is a delete button
            const deleteButton = event.target.closest('.preview-delete-btn');
            if (deleteButton) {
                const fileId = deleteButton.dataset.fileId; // Get the unique ID from the button
                if (fileId) {
                    console.log(`DEBUG: Delete button clicked for file ID: ${fileId}`); // Debug log
                    removeFile(fileId);
                } else {
                    console.error("Delete button clicked but file ID was missing.");
                }
            }
        });
    } else {
         console.error("Initial setup error: Preview area element not found, cannot add delete listener.");
    }


     if (watermarkForm) {
        // Listen for changes on the whole form for simplicity
        watermarkForm.addEventListener('change', (event) => {
            // Update char count/validation if radio button changed
            if (event.target.type === 'radio' && event.target.name === 'watermark_type') {
                updateCharCount();
            }
            // Also update degradation if any relevant form element changes
             updateDegradationDisplay();
        });
         // Listen for text input changes and other controls affecting degradation
        watermarkForm.addEventListener('input', (event) => {
             if (event.target.id === 'watermark-text' || event.target.type === 'number' || event.target.type === 'range' || event.target.type === 'color' || event.target.type === 'checkbox' || event.target.tagName === 'SELECT') {
                if(event.target.id === 'watermark-text') {
                     updateCharCount(); // Updates text validation/count
                }
                updateDegradationDisplay(); // Updates degradation estimate
             }
        });
    } else {
         console.error("Initial setup error: Watermark form element not found.");
    }


    // --- Core Logic Functions ---

    function handleFiles(files) {
        console.log("DEBUG: handleFiles triggered with", files ? files.length : 0, "files."); // Debug log 11
        clearUploadErrors();
        const fileList = files ? Array.from(files) : [];

        if (fileList.length === 0) return; // Nothing to process

        // 1. Check Max Files
        console.log(`DEBUG: Checking max files: ${fileList.length} vs ${MAX_FILES}`); // Debug log 12
        if (fileList.length > MAX_FILES) {
            console.error("Validation Error: Exceeded max files limit."); // Debug log 13 - Error
            displayUploadError(`You can only upload a maximum of ${MAX_FILES} files at a time.`);
            return;
        }

        // 2. Filter Files
        const validFiles = [];
        const rejectedFilesInfo = [];
        // Assuming each upload operation REPLACES the previous files
        if (previewArea) previewArea.innerHTML = ''; // Clear previous previews
        uploadedFiles = []; // Reset the main list

        fileList.forEach(file => {
            const fileName = file.name || 'Unnamed file';
            const fileExtension = fileName.includes('.') ? fileName.slice(((fileName.lastIndexOf(".") - 1) >>> 0) + 2).toLowerCase() : '';

            console.log(`DEBUG: Processing file: ${fileName}, extracted extension: '${fileExtension}'`); // Debug log 14

            // Core extension check
             console.log(`DEBUG: Checking if [${ALLOWED_EXTENSIONS.join(', ')}] includes '${fileExtension}':`, ALLOWED_EXTENSIONS.includes(fileExtension)); // Debug log 15

            if (fileExtension && ALLOWED_EXTENSIONS.includes(fileExtension)) {
                // Basic MIME check
                if (file.type.startsWith('image/') || (!file.type && fileExtension)) {
                    validFiles.push(file);
                } else {
                     console.warn(`Validation Warning: File '${fileName}' has allowed extension '.${fileExtension}' but unexpected MIME type '${file.type}'. Rejecting.`); // Debug log 16 - Warning
                     rejectedFilesInfo.push(`${fileName} (Not a recognized image type)`);
                }
            } else {
                console.warn(`Validation Error: Extension '.${fileExtension}' not allowed for file '${fileName}'. Rejecting.`); // Debug log 17 - Error
                if (!fileExtension) {
                     rejectedFilesInfo.push(`${fileName} (File has no extension)`);
                } else {
                    rejectedFilesInfo.push(`${fileName} (Invalid extension: .${fileExtension})`);
                }
            }
        });

        // 3. Display Rejections
        if (rejectedFilesInfo.length > 0) {
             let rejectionMessage = `<strong>Some files were rejected:</strong><br> - ${rejectedFilesInfo.join('<br> - ')}`;
             displayUploadError(rejectionMessage);
             console.log("DEBUG: Rejected files details:", rejectedFilesInfo); // Debug log 18
        }

        // 4. Process and Display Valid Files
        if (validFiles.length > 0) {
            if(previewPlaceholder) previewPlaceholder.classList.add('d-none'); // Hide placeholder

            validFiles.forEach(file => {
                // Generate a unique ID for this file instance
                const fileId = `${file.name}-${file.lastModified}`;
                uploadedFiles.push(file); // Add validated file to the main list

                const reader = new FileReader();
                reader.onload = (e) => {
                    // Create container for image and button
                    const previewItem = document.createElement('div');
                    previewItem.classList.add('preview-item');
                    previewItem.dataset.fileId = fileId; // Store ID on container

                    // Create image element
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.classList.add('preview-image', 'img-thumbnail');
                    img.alt = file.name;
                    img.title = file.name; // Hover text

                    // Create delete button
                    const deleteBtn = document.createElement('button');
                    deleteBtn.type = 'button';
                    deleteBtn.classList.add('btn-close', 'preview-delete-btn'); // Bootstrap close button
                    deleteBtn.dataset.fileId = fileId; // Store ID on button too
                    deleteBtn.setAttribute('aria-label', `Remove image ${file.name}`);

                    // Append image and button to container
                    previewItem.appendChild(img);
                    previewItem.appendChild(deleteBtn);

                    // Append container to preview area
                    if(previewArea) previewArea.appendChild(previewItem);
                }
                 reader.onerror = (e) => console.error(`Error reading file ${file.name}:`, e);
                 reader.readAsDataURL(file);
            });
        }

        // Update UI state after processing all files in the batch
        if (uploadedFiles.length === 0) {
             // No valid files were found or added
             if(previewArea) previewArea.innerHTML = ''; // Ensure area is clear
             if(previewPlaceholder && previewArea) {
                 previewPlaceholder.classList.remove('d-none'); // Show placeholder
                 previewArea.appendChild(previewPlaceholder); // Add it back
             }
        }

        console.log("DEBUG: Accepted files for upload:", uploadedFiles.map(f => f.name)); // Debug log 19
        if(processBtn) processBtn.disabled = uploadedFiles.length === 0;
        updateDegradationDisplay();
    }

    // FUNCTION to remove a file
    function removeFile(fileIdToRemove) {
        console.log(`DEBUG: Attempting to remove file with ID: ${fileIdToRemove}`); // Debug log

        // Find index of file in the array
        const indexToRemove = uploadedFiles.findIndex(file => `${file.name}-${file.lastModified}` === fileIdToRemove);

        if (indexToRemove > -1) {
            // Remove file from array
            const removedFileName = uploadedFiles[indexToRemove].name;
            uploadedFiles.splice(indexToRemove, 1);
            console.log(`DEBUG: Removed file '${removedFileName}' from uploadedFiles array.`); // Debug log

            // Find and remove preview item from DOM
            const previewItemToRemove = document.querySelector(`.preview-item[data-file-id="${fileIdToRemove}"]`);
            if (previewItemToRemove && previewArea && previewItemToRemove.parentNode === previewArea) {
                previewArea.removeChild(previewItemToRemove);
                console.log(`DEBUG: Removed preview item for '${removedFileName}' from DOM.`); // Debug log
            } else {
                 console.warn(`Could not find or remove preview item in DOM for file ID: ${fileIdToRemove}`); // Debug log warning
            }

            // Update UI
            if (uploadedFiles.length === 0) {
                if(processBtn) processBtn.disabled = true;
                if(previewPlaceholder && previewArea) { // Show placeholder if no files left
                    previewArea.innerHTML = ''; // Clear area first
                    previewPlaceholder.classList.remove('d-none');
                    previewArea.appendChild(previewPlaceholder);
                }
                 // Clear any success/error messages related to previous uploads
                 clearUploadErrors();
            } else {
                 if(processBtn) processBtn.disabled = false; // Should potentially be enabled
            }
            updateDegradationDisplay(); // Recalculate impact

        } else {
            console.warn(`File with ID ${fileIdToRemove} not found in uploadedFiles array.`); // Debug log warning
        }
        console.log("DEBUG: Current uploadedFiles list after removal:", uploadedFiles.map(f => f.name)); // Log list after removal
    }

    function updateDegradationDisplay() {
         // Get current parameter values directly from the form for calculation
        const currentTextLength = watermarkText ? watermarkText.value.length : 0;
        const typeVisibleRadio = document.querySelector('input[name="watermark_type"][value="visible"]');
        const typeVisible = typeVisibleRadio ? typeVisibleRadio.checked : true;
        const maxLength = typeVisible ? MAX_VISIBLE_TEXT : MAX_INVISIBLE_TEXT;

        const fontSizeInput = document.getElementById('font_size_ratio');
        const fontSizePercent = parseFloat(fontSizeInput?.value || 5);
        const fontSizeRatio = isNaN(fontSizePercent) ? 0.05 : fontSizePercent / 100.0;

        const opacitySlider = document.getElementById('opacity');
        const opacity = parseInt(opacitySlider?.value || 128, 10);
        const alpha = Math.max(0, Math.min(255, opacity)); // Clamp 0-255

        const repeatCheckbox = document.getElementById('repeat');
        const repeat = repeatCheckbox ? repeatCheckbox.checked : false;

        const angleInput = document.getElementById('angle');
        const angle = parseInt(angleInput?.value || 0, 10);

        const spacingInput = document.getElementById('spacing_ratio');
        const spacingPercent = parseFloat(spacingInput?.value || 50);
        const spacingRatio = isNaN(spacingPercent) ? 0.5 : spacingPercent / 100.0;


        // --- Start Calculation ---
        let degradation = 0.0;
        const validImageFilesCount = uploadedFiles.length;

        if(validImageFilesCount > 0) {
             degradation = 5.0; // Base impact if images are loaded
        } else {
             degradation = 0.0; // No impact if no images
        }

        // Add impact only if text is valid length
        if (currentTextLength > 0 && currentTextLength <= maxLength) {
             // Text Length component (minor)
             degradation += Math.min(currentTextLength * 0.1, 5.0);

             // Size Impact
             degradation += fontSizeRatio * 150.0;

             // Opacity Impact (higher alpha = more opaque = more degradation)
            const opacityFactor = alpha / 255.0;
            degradation += opacityFactor * 20.0;

            // Repetition Impact
            if (repeat) {
                degradation += 40.0; // Base increase for tiling
                // Angle impact for non-straight tiling
                if (Math.abs(angle) % 90 != 0) {
                    degradation += 10.0;
                }
                // Spacing impact (closer tiles = more impact)
                const validSpacingRatio = Math.max(0, Math.min(1, spacingRatio));
                degradation += (1.0 - validSpacingRatio) * 25.0;
            }
        } else if (currentTextLength > maxLength) {
            // Handle text too long case - maybe max out degradation or add large penalty?
            degradation += 50; // Example large penalty
        }


        // Cap the degradation at 100%
        const final_degradation = Math.min(Math.max(0, degradation), 100);
        const rounded_degradation = Math.round(final_degradation); // Round to nearest integer

        // Update the percentage text and color
        if(degradationPercent){
             degradationPercent.textContent = `${rounded_degradation}%`;
             degradationPercent.classList.remove('text-success', 'text-warning', 'text-danger', 'text-dark'); // Reset color classes
             if (rounded_degradation === 0 && validImageFilesCount === 0){
                degradationPercent.classList.add('text-dark');
             } else if (rounded_degradation <= 30) {
                 degradationPercent.classList.add('text-success'); // Green
             } else if (rounded_degradation <= 60) {
                 degradationPercent.classList.add('text-warning'); // Orange
             } else {
                 degradationPercent.classList.add('text-danger');  // Red
             }
        }
    }

    // Helper Math functions needed for degradation calc
    // const min = Math.min; // Already globally available
    // const max = Math.max; // Already globally available
    // const abs = Math.abs; // Already globally available
    // const round = Math.round; // Already globally available


    // --- Form Submission Handling (Using Fetch) ---
    if (processBtn && watermarkForm) {
        watermarkForm.addEventListener('submit', (e) => {
            e.preventDefault(); // Always prevent default for JS handling
            console.log("DEBUG: Submit event triggered."); // Debug log 20

            // --- Final Validation ---
            let isValid = true;
            clearTextErrors();
            clearUploadErrors();
            // Validate text length
            const currentLength = watermarkText ? watermarkText.value.length : 0;
            const typeVisibleRadio = document.querySelector('input[name="watermark_type"][value="visible"]');
            const typeVisible = typeVisibleRadio ? typeVisibleRadio.checked : true;
            const maxLength = typeVisible ? MAX_VISIBLE_TEXT : MAX_INVISIBLE_TEXT;
            if (currentLength > maxLength) {
                displayTextError(`Watermark text exceeds the maximum length of ${maxLength}.`);
                if(watermarkText) watermarkText.focus();
                isValid = false;
            }
             // Validate files presence
             if (uploadedFiles.length === 0) {
                 displayUploadError("Please upload at least one valid image file.");
                 isValid = false;
             }
             if (!isValid) {
                 console.log("DEBUG: Submission blocked due to validation errors."); // Debug log 21 - Error
                 return; // Stop here
             }

            // --- Disable button, show processing indicator ---
            processBtn.disabled = true;
            processBtn.innerHTML = `
                <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                Processing...
            `;

            // --- Create FormData ---
            const formData = new FormData();
             // Append ALL files from uploadedFiles array
             if (uploadedFiles.length > 0) {
                 uploadedFiles.forEach((file, index) => {
                     formData.append('images', file, file.name);
                     console.log(`DEBUG: Appending file ${index}: ${file.name}`);
                 });
             } else {
                  console.error("Submit triggered but uploadedFiles array is empty after validation passed? Should not happen.");
                  processBtn.disabled = false;
                  processBtn.innerHTML = 'Apply Watermark';
                  displayUploadError("No files found to process.");
                  return;
             }

            // Append form parameters from inputs
            formData.append('watermark_text', watermarkText ? watermarkText.value : '');
            const selectedType = document.querySelector('input[name="watermark_type"]:checked');
            formData.append('watermark_type', selectedType ? selectedType.value : 'visible');

            if (selectedType && selectedType.value === 'visible') {
                const position = document.getElementById('position')?.value || 'bottom-right';
                const fontSizeInput = document.getElementById('font_size_ratio');
                const fontSizePercent = parseFloat(fontSizeInput?.value || 5);
                const fontSizeRatio = isNaN(fontSizePercent) ? 0.05 : fontSizePercent / 100.0;
                const color = document.getElementById('color')?.value || '#FFFFFF';
                const opacity = document.getElementById('opacity')?.value || '128';
                const repeatCheckbox = document.getElementById('repeat');
                const repeat = repeatCheckbox ? repeatCheckbox.checked.toString() : 'false';
                const angle = document.getElementById('angle')?.value || '0';
                const spacingInput = document.getElementById('spacing_ratio');
                const spacingPercent = parseFloat(spacingInput?.value || 50);
                const spacingRatio = isNaN(spacingPercent) ? 0.5 : spacingPercent / 100.0;

                formData.append('position', position);
                formData.append('font_size_ratio', fontSizeRatio.toString());
                formData.append('color', color); // Send hex color
                formData.append('opacity', opacity); // Send opacity 0-255
                formData.append('repeat', repeat);

                if (repeat === 'true') { // Only send tiling options if repeat is true
                    formData.append('angle', angle);
                    formData.append('spacing_ratio', spacingRatio.toString());
                }
                 // formData.append('margin_ratio', marginRatio.toString()); // Add if margin input exists
            }

            console.log("DEBUG: FormData prepared. Sending fetch request to /process...");

            // --- Send Fetch Request ---
            fetch('/process', {
                method: 'POST',
                body: formData
            })
            .then(response => {
                 const contentType = response.headers.get("content-type");
                if (!response.ok) {
                     if (contentType && contentType.indexOf("application/json") !== -1) {
                        return response.json().then(errData => {
                             throw new Error(errData.error || `Server error: ${response.status}`);
                        });
                     } else {
                         throw new Error(`Server error: ${response.status} ${response.statusText}`);
                     }
                }
                 if (contentType && contentType.indexOf("application/json") !== -1) {
                    return response.json();
                 } else {
                     throw new Error("Received non-JSON response from server.");
                 }
            })
            .then(data => { // Handle the JSON data from Flask
                console.log("DEBUG: Response data from server:", data);

                // Process the list of results
                let messageHtml = '';
                let overallSuccess = data.success; // Use overall status from Flask

                if (data.results && Array.isArray(data.results)) {
                    messageHtml += `<p>${data.message || 'Processing complete.'}</p>`; // Show overall message
                    messageHtml += '<ul class="list-unstyled mb-0">'; // Use unstyled list
                    data.results.forEach(result => {
                        if (result.status === 'success' && result.download_url) {
                            messageHtml += `
                                <li class="mb-1">
                                    <i class="bi bi-check-circle-fill text-success me-1"></i> ${result.original_filename}:
                                    <a href="${result.download_url}" target="_blank" class="alert-link fw-bold">
                                        Download (${result.output_filename})
                                    </a>
                                </li>`;
                        } else {
                             // Use text-warning for skipped, text-danger for error
                            const statusClass = result.status === 'skipped' ? 'text-warning' : 'text-danger';
                            const iconClass = result.status === 'skipped' ? 'bi-exclamation-triangle-fill' : 'bi-x-octagon-fill';
                            messageHtml += `
                                <li class="mb-1 ${statusClass}">
                                    <i class="bi ${iconClass} me-1"></i> ${result.original_filename}: Failed - ${result.message || 'Unknown error'}
                                </li>`;
                        }
                    });
                    messageHtml += '</ul>';
                } else {
                     messageHtml = data.message || (overallSuccess ? "Operation reported success but no details." : "Operation failed, no details provided.");
                }

                // Determine overall alert type
                let alertClass = 'alert-danger'; // Default to danger
                if (overallSuccess) {
                    alertClass = 'alert-success';
                } else if (data.results && data.results.some(r => r.status === 'success')) {
                    alertClass = 'alert-warning'; // Use warning if some succeeded but not all
                }

                // Display the consolidated message
                displayUploadError(
                    `<div class="alert ${alertClass} mb-0">${messageHtml}</div>`
                );

                // Clear previews only if the overall operation had no errors
                if (overallSuccess) {
                    uploadedFiles = [];
                    if(previewArea) previewArea.innerHTML = '';
                    if(previewPlaceholder && previewArea){
                         previewPlaceholder.classList.remove('d-none');
                         previewArea.appendChild(previewPlaceholder);
                    }
                }

            })
            .catch(error => {
                console.error("DEBUG: Fetch error:", error);
                if(uploadErrors) uploadErrors.classList.add('alert-danger'); // Ensure danger class on fetch error
                displayUploadError(`An error occurred: ${error.message}`);
            })
            .finally(() => {
                // Re-enable button, remove spinner
                // Disable button because previews are cleared on success anyway, forcing re-upload
                processBtn.disabled = true;
                processBtn.innerHTML = 'Apply Watermark'; // Restore original text
            });

        });
    } else {
         console.error("Initial setup error: Process button or watermark form element not found.");
    }

    // --- Initial UI State ---
    console.log("DEBUG: Setting initial UI state."); // Debug log 23
    updateCharCount(); // Init char count, validation, and degradation display
    if (previewArea && previewPlaceholder) { // Ensure elements exist
        if (uploadedFiles.length === 0) {
            previewArea.innerHTML = ''; // Clear area
            previewPlaceholder.classList.remove('d-none'); // Show placeholder
            previewArea.appendChild(previewPlaceholder); // Add it back
        } else {
             previewPlaceholder.classList.add('d-none'); // Hide if files somehow loaded initially
        }
    }
     if(processBtn) processBtn.disabled = uploadedFiles.length === 0; // Set initial button state
     console.log("DEBUG: Initial UI state set."); // Debug log 24

}); // End of DOMContentLoaded