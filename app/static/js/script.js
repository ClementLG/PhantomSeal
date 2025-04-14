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
    // References for BOTH message areas
    const uploadErrors = document.getElementById('upload-errors');     // For upload-specific errors
    const resultMessages = document.getElementById('result-messages'); // For processing results/errors
    const textErrors = document.getElementById('text-errors');         // For text input validation feedback
    const textCharCount = document.getElementById('text-char-count');

    let uploadedFiles = []; // Keep track of VALIDATED and accepted files

    // --- Helper Functions ---

    // Function for UPLOAD errors (near upload zone)
    function displayUploadError(message) {
        if (uploadErrors) {
            uploadErrors.innerHTML = message; // Use innerHTML for potential HTML tags
            uploadErrors.classList.remove('d-none');
            // Ensure it's always styled as danger for upload errors
            uploadErrors.classList.remove('alert-success', 'alert-warning');
            uploadErrors.classList.add('alert-danger');
        } else {
            console.error("Upload error display area (#upload-errors) not found.");
            alert(message); // Fallback
        }
    }

    // Function to clear UPLOAD errors
    function clearUploadErrors() {
        if (uploadErrors) {
            uploadErrors.textContent = '';
            uploadErrors.classList.add('d-none');
            uploadErrors.classList.remove('alert-danger', 'alert-success', 'alert-warning');
        }
    }

    // Function for PROCESSING results/errors (below button)
    function displayResultMessage(message, type = 'danger') { // type can be 'success', 'warning', 'danger'
        if (resultMessages) {
            resultMessages.innerHTML = message; // Use innerHTML for links/lists
            resultMessages.classList.remove('d-none', 'alert-danger', 'alert-success', 'alert-warning'); // Clear old classes
            resultMessages.classList.add(`alert-${type}`); // Add the specified type class
        } else {
            console.error("Result message display area (#result-messages) not found.");
            alert(message); // Fallback
        }
    }

    // Function to clear PROCESSING results/errors
    function clearResultMessages() {
        if (resultMessages) {
            resultMessages.textContent = '';
            resultMessages.classList.add('d-none');
            resultMessages.classList.remove('alert-danger', 'alert-success', 'alert-warning');
        }
    }

    // Function for TEXT INPUT errors
     function displayTextError(message) {
        if (textErrors) {
            textErrors.textContent = message;
        } else {
            console.error("Text error display area (#text-errors) not found.");
        }
        // Ensure Bootstrap class is added to the input for visibility
        if (watermarkText) {
            watermarkText.classList.add('is-invalid');
        }
    }

    // Function to clear TEXT INPUT errors
    function clearTextErrors() {
         if (textErrors) {
            textErrors.textContent = '';
         }
         if(watermarkText){
             watermarkText.classList.remove('is-invalid');
         }
    }

    // Function to update character count and trigger text validation
    function updateCharCount() {
        if (!watermarkText || !textCharCount) return; // Check elements exist

        const currentLength = watermarkText.value.length;
        const typeVisibleRadio = document.querySelector('input[name="watermark_type"][value="visible"]');
        const typeVisible = typeVisibleRadio ? typeVisibleRadio.checked : true;
        const maxLength = typeVisible ? MAX_VISIBLE_TEXT : MAX_INVISIBLE_TEXT;

        textCharCount.textContent = `${currentLength} / ${maxLength}`; // Update counter

        // Manage validation state
        if (currentLength > maxLength) {
             displayTextError(`Maximum length is ${maxLength} characters.`);
        } else {
             clearTextErrors();
        }
        // Note: updateDegradationDisplay is called separately in the event listener for broader updates
    }


    // --- Event Listeners Setup ---
    if (dropZone && fileInput && browseBtn) {
        dropZone.addEventListener('click', () => fileInput.click());
        browseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
        });
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('dragover'); });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            handleFiles(e.dataTransfer.files);
            if (fileInput) fileInput.value = '';
        });
    } else {
         console.error("Initial setup error: Drop zone, file input, or browse button not found.");
    }

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            handleFiles(e.target.files);
             e.target.value = '';
        });
    } else {
         console.error("Initial setup error: File input element not found.");
    }

    // Event listener for deleting previews
    if (previewArea) {
        previewArea.addEventListener('click', (event) => {
            const deleteButton = event.target.closest('.preview-delete-btn');
            if (deleteButton) {
                const fileId = deleteButton.dataset.fileId;
                if (fileId) {
                    console.log(`DEBUG: Delete button clicked for file ID: ${fileId}`);
                    removeFile(fileId);
                } else { console.error("Delete button clicked but file ID was missing."); }
            }
        });
    } else {
         console.error("Initial setup error: Preview area element not found.");
    }

    // Event listener for form changes/inputs affecting degradation or validation
     if (watermarkForm) {
        watermarkForm.addEventListener('change', (event) => {
            if (event.target.type === 'radio' && event.target.name === 'watermark_type') {
                updateCharCount(); // Check text length limit based on type
            }
             // Update degradation on any change (select, checkbox, radio)
             updateDegradationDisplay();
        });
        watermarkForm.addEventListener('input', (event) => {
             // Update degradation on input changes (text, range, number, color)
             if (event.target.id === 'watermark-text' || event.target.type === 'number' || event.target.type === 'range' || event.target.type === 'color') {
                if(event.target.id === 'watermark-text') {
                     updateCharCount(); // Validate text length as user types
                }
                updateDegradationDisplay(); // Update degradation estimate
             }
        });
    } else {
         console.error("Initial setup error: Watermark form element not found.");
    }


    // --- Core Logic Functions ---

    function handleFiles(files) {
        console.log("DEBUG: handleFiles triggered with", files ? files.length : 0, "files."); // Debug log 11
        // Clear previous UPLOAD errors AND previous PROCESSING results
        clearUploadErrors();
        clearResultMessages(); // Clear old results when new files are handled

        const fileList = files ? Array.from(files) : [];
        if (fileList.length === 0) return; // Nothing to process

        // 1. Check Max Files
        console.log(`DEBUG: Checking max files: ${fileList.length} vs ${MAX_FILES}`); // Debug log 12
        if (fileList.length > MAX_FILES) {
            console.error("Validation Error: Exceeded max files limit."); // Debug log 13 - Error
            displayUploadError(`You can only upload a maximum of ${MAX_FILES} files at a time.`); // Shows in upload area
            return;
        }

        // 2. Filter Files
        const validFiles = [];
        const rejectedFilesInfo = [];
        if (previewArea) previewArea.innerHTML = ''; // Clear previous previews (assuming replace behavior)
        uploadedFiles = []; // Reset the main list (assuming replace behavior)

        fileList.forEach(file => {
            const fileName = file.name || 'Unnamed file';
            const fileExtension = fileName.includes('.') ? fileName.slice(((fileName.lastIndexOf(".") - 1) >>> 0) + 2).toLowerCase() : '';
            console.log(`DEBUG: Processing file: ${fileName}, extracted extension: '${fileExtension}'`); // Debug log 14
            console.log(`DEBUG: Checking if [${ALLOWED_EXTENSIONS.join(', ')}] includes '${fileExtension}':`, ALLOWED_EXTENSIONS.includes(fileExtension)); // Debug log 15

            if (fileExtension && ALLOWED_EXTENSIONS.includes(fileExtension)) {
                if (file.type.startsWith('image/') || (!file.type && fileExtension)) {
                    validFiles.push(file);
                } else {
                     console.warn(`Validation Warning: File '${fileName}' has allowed extension '.${fileExtension}' but unexpected MIME type '${file.type}'. Rejecting.`); // Debug log 16
                     rejectedFilesInfo.push(`${fileName} (Not a recognized image type)`);
                }
            } else {
                console.warn(`Validation Error: Extension '.${fileExtension}' not allowed for file '${fileName}'. Rejecting.`); // Debug log 17
                if (!fileExtension) { rejectedFilesInfo.push(`${fileName} (File has no extension)`); }
                else { rejectedFilesInfo.push(`${fileName} (Invalid extension: .${fileExtension})`); }
            }
        });

        // 3. Display Rejections (UPLOAD errors)
        if (rejectedFilesInfo.length > 0) {
             let rejectionMessage = `<strong>Some files were rejected during upload:</strong><br> - ${rejectedFilesInfo.join('<br> - ')}`;
             displayUploadError(rejectionMessage); // Shows in upload area
             console.log("DEBUG: Rejected files details:", rejectedFilesInfo); // Debug log 18
        }

        // 4. Process and Display Valid Previews
        if (validFiles.length > 0) {
            if(previewPlaceholder) previewPlaceholder.classList.add('d-none');

            validFiles.forEach(file => {
                const fileId = `${file.name}-${file.lastModified}`;
                uploadedFiles.push(file); // Add to global list
                const reader = new FileReader();
                reader.onload = (e) => {
                    const previewItem = document.createElement('div');
                    previewItem.classList.add('preview-item');
                    previewItem.dataset.fileId = fileId;
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.classList.add('preview-image', 'img-thumbnail');
                    img.alt = file.name;
                    img.title = file.name;
                    const deleteBtn = document.createElement('button');
                    deleteBtn.type = 'button';
                    deleteBtn.classList.add('btn-close', 'preview-delete-btn');
                    deleteBtn.dataset.fileId = fileId;
                    deleteBtn.setAttribute('aria-label', `Remove image ${file.name}`);
                    previewItem.appendChild(img);
                    previewItem.appendChild(deleteBtn);
                    if(previewArea) previewArea.appendChild(previewItem);
                }
                 reader.onerror = (e) => console.error(`Error reading file ${file.name}:`, e);
                 reader.readAsDataURL(file);
            });
        }

        // Update UI state after processing batch
        if (uploadedFiles.length === 0) {
             if(previewArea) previewArea.innerHTML = '';
             if(previewPlaceholder && previewArea) {
                 previewPlaceholder.classList.remove('d-none');
                 previewArea.appendChild(previewPlaceholder);
             }
        }

        console.log("DEBUG: Accepted files for upload:", uploadedFiles.map(f => f.name)); // Debug log 19
        if(processBtn) processBtn.disabled = uploadedFiles.length === 0;
        updateDegradationDisplay();
    }

    // FUNCTION to remove a file
    function removeFile(fileIdToRemove) {
        console.log(`DEBUG: Attempting to remove file with ID: ${fileIdToRemove}`);

        const indexToRemove = uploadedFiles.findIndex(file => `${file.name}-${file.lastModified}` === fileIdToRemove);
        if (indexToRemove > -1) {
            const removedFileName = uploadedFiles[indexToRemove].name;
            uploadedFiles.splice(indexToRemove, 1); // Remove from array
            console.log(`DEBUG: Removed file '${removedFileName}' from uploadedFiles array.`);

            const previewItemToRemove = document.querySelector(`.preview-item[data-file-id="${fileIdToRemove}"]`);
            if (previewItemToRemove && previewArea && previewItemToRemove.parentNode === previewArea) {
                previewArea.removeChild(previewItemToRemove); // Remove from DOM
                console.log(`DEBUG: Removed preview item for '${removedFileName}' from DOM.`);
            } else { console.warn(`Could not find or remove preview item in DOM for file ID: ${fileIdToRemove}`); }

            // Update UI
            if (uploadedFiles.length === 0) {
                if(processBtn) processBtn.disabled = true;
                if(previewPlaceholder && previewArea) {
                    previewArea.innerHTML = '';
                    previewPlaceholder.classList.remove('d-none');
                    previewArea.appendChild(previewPlaceholder);
                }
                // Clear BOTH message areas when last file removed manually
                clearUploadErrors();
                clearResultMessages();
            } else { if(processBtn) processBtn.disabled = false; }
            updateDegradationDisplay(); // Recalculate impact

        } else { console.warn(`File with ID ${fileIdToRemove} not found in uploadedFiles array.`); }
        console.log("DEBUG: Current uploadedFiles list after removal:", uploadedFiles.map(f => f.name));
    }

    // FUNCTION to calculate and display degradation estimate
    function updateDegradationDisplay() {
         // Get current parameter values from the form
        const currentTextLength = watermarkText ? watermarkText.value.length : 0;
        const typeVisibleRadio = document.querySelector('input[name="watermark_type"][value="visible"]');
        const typeVisible = typeVisibleRadio ? typeVisibleRadio.checked : true;
        const maxLength = typeVisible ? MAX_VISIBLE_TEXT : MAX_INVISIBLE_TEXT;
        const fontSizeInput = document.getElementById('font_size_ratio');
        const fontSizePercent = parseFloat(fontSizeInput?.value || 5);
        const fontSizeRatio = isNaN(fontSizePercent) ? 0.05 : fontSizePercent / 100.0;
        const opacitySlider = document.getElementById('opacity');
        const opacity = parseInt(opacitySlider?.value || 128, 10);
        const alpha = Math.max(0, Math.min(255, opacity));
        const repeatCheckbox = document.getElementById('repeat');
        const repeat = repeatCheckbox ? repeatCheckbox.checked : false;
        const angleInput = document.getElementById('angle');
        const angle = parseInt(angleInput?.value || 0, 10);
        const spacingInput = document.getElementById('spacing_ratio');
        const spacingPercent = parseFloat(spacingInput?.value || 50);
        const spacingRatio = isNaN(spacingPercent) ? 0.5 : spacingPercent / 100.0;

        // --- Calculation Logic (same as before) ---
        let degradation = 0.0;
        const validImageFilesCount = uploadedFiles.length;
        if(validImageFilesCount > 0) { degradation = 5.0; }
        else { degradation = 0.0; }
        if (currentTextLength > 0 && currentTextLength <= maxLength) {
             degradation += Math.min(currentTextLength * 0.1, 5.0);
             degradation += fontSizeRatio * 150.0;
             const opacityFactor = alpha / 255.0;
             degradation += opacityFactor * 20.0;
             if (repeat) {
                degradation += 40.0;
                if (Math.abs(angle) % 90 != 0) { degradation += 10.0; }
                const validSpacingRatio = Math.max(0, Math.min(1, spacingRatio));
                degradation += (1.0 - validSpacingRatio) * 25.0;
             }
        } else if (currentTextLength > maxLength) { degradation += 50; }
        const final_degradation = Math.min(Math.max(0, degradation), 100);
        const rounded_degradation = Math.round(final_degradation);

        // Update the display
        if(degradationPercent){
             degradationPercent.textContent = `${rounded_degradation}%`;
             degradationPercent.classList.remove('text-success', 'text-warning', 'text-danger', 'text-dark');
             if (rounded_degradation === 0 && validImageFilesCount === 0){ degradationPercent.classList.add('text-dark'); }
             else if (rounded_degradation <= 30) { degradationPercent.classList.add('text-success'); }
             else if (rounded_degradation <= 60) { degradationPercent.classList.add('text-warning'); }
             else { degradationPercent.classList.add('text-danger'); }
        }
    }


    // --- Form Submission Handling (Using Fetch) ---
    if (processBtn && watermarkForm) {
        watermarkForm.addEventListener('submit', (e) => {
            e.preventDefault();
            console.log("DEBUG: Submit event triggered."); // Debug log 20

            // Clear previous PROCESSING results
            clearResultMessages();

            // --- Final Validation ---
            let isValid = true;
            clearTextErrors(); // Clear only text errors
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
             // Validate files presence (error displayed in RESULT area)
             if (uploadedFiles.length === 0) {
                 displayResultMessage("Please upload at least one valid image file.", 'danger'); // Uses result message area
                 isValid = false;
             }
             if (!isValid) {
                 console.log("DEBUG: Submission blocked due to validation errors."); // Debug log 21
                 return;
             }

            // --- Disable button, show spinner ---
            processBtn.disabled = true;
            processBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Processing...`;

            // --- Create FormData ---
            const formData = new FormData();
             // Append ALL files
             uploadedFiles.forEach((file, index) => {
                 formData.append('images', file, file.name);
                 console.log(`DEBUG: Appending file ${index}: ${file.name}`);
             });
            // Append form parameters
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
                formData.append('color', color);
                formData.append('opacity', opacity);
                formData.append('repeat', repeat);
                if (repeat === 'true') {
                    formData.append('angle', angle);
                    formData.append('spacing_ratio', spacingRatio.toString());
                }
            }
            console.log("DEBUG: FormData prepared. Sending fetch request to /process...");

            // --- Send Fetch Request ---
            fetch('/process', { method: 'POST', body: formData })
            .then(response => {
                 const contentType = response.headers.get("content-type");
                if (!response.ok) {
                     if (contentType && contentType.indexOf("application/json") !== -1) {
                        return response.json().then(errData => { throw new Error(errData.error || `Server error: ${response.status}`); });
                     } else { throw new Error(`Server error: ${response.status} ${response.statusText}`); }
                }
                 if (contentType && contentType.indexOf("application/json") !== -1) { return response.json(); }
                 else { throw new Error("Received non-JSON response from server."); }
            })
            .then(data => { // Handle the JSON data from Flask
                console.log("DEBUG: Response data from server:", data);
                let messageHtml = '';
                let overallSuccess = data.success;
                let alertClass = 'alert-danger'; // Default

                if (data.results && Array.isArray(data.results)) {
                    messageHtml += `<p>${data.message || 'Processing complete.'}</p><ul class="list-unstyled mb-0">`;
                    data.results.forEach(result => {
                        if (result.status === 'success' && result.download_url) {
                            messageHtml += `<li class="mb-1"><i class="bi bi-check-circle-fill text-success me-1"></i> ${result.original_filename}: <a href="${result.download_url}" target="_blank" class="alert-link fw-bold">Download (${result.output_filename})</a></li>`;
                        } else {
                            const statusClass = result.status === 'skipped' ? 'text-warning' : 'text-danger';
                            const iconClass = result.status === 'skipped' ? 'bi-exclamation-triangle-fill' : 'bi-x-octagon-fill';
                            messageHtml += `<li class="mb-1 ${statusClass}"><i class="bi ${iconClass} me-1"></i> ${result.original_filename}: Failed - ${result.message || 'Unknown error'}</li>`;
                        }
                    });
                    messageHtml += '</ul>';
                    if (overallSuccess) { alertClass = 'alert-success'; }
                    else if (data.results.some(r => r.status === 'success')) { alertClass = 'alert-warning'; }
                } else {
                     messageHtml = data.message || (overallSuccess ? "Success but no details." : "Failed, no details.");
                     alertClass = overallSuccess ? 'alert-success' : 'alert-danger';
                }
                // Display results message below button
                displayResultMessage(messageHtml, alertClass.replace('alert-', ''));

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
                // Display fetch errors below button
                displayResultMessage(`An error occurred: ${error.message}`, 'danger');
            })
            .finally(() => {
                // Re-enable button or not, depending on desired flow
                processBtn.disabled = uploadedFiles.length === 0; // Disable if previews were cleared
                // Let's make it always disabled after an attempt, forcing re-upload for new batch
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
    if (previewArea && previewPlaceholder) {
        if (uploadedFiles.length === 0) {
            previewArea.innerHTML = '';
            previewPlaceholder.classList.remove('d-none');
            previewArea.appendChild(previewPlaceholder);
        } else { previewPlaceholder.classList.add('d-none'); }
    }
     if(processBtn) processBtn.disabled = uploadedFiles.length === 0;
     console.log("DEBUG: Initial UI state set."); // Debug log 24

}); // End of DOMContentLoaded