// Wait until the entire page is loaded
document.addEventListener("DOMContentLoaded", () => {

    // --- 1. SETUP TABS & PANELS ---
    const menuItems = document.querySelectorAll('.menu-item');
    const panels = document.querySelectorAll('.panel');
    const mainTitle = document.getElementById('main-title');
    const canvas = document.getElementById("signature-canvas");
    let signaturePad; 

    // --- 4. SETUP SIGNATURE PAD (but only initialize if canvas exists) ---
    if (canvas) {
        signaturePad = new SignaturePad(canvas, {
            backgroundColor: 'rgb(255, 255, 255)' // Set background to white
        });

        // Clear button
        document.getElementById("clear-canvas-btn").addEventListener("click", () => {
            signaturePad.clear();
            resultSection.classList.add('hidden');
        });

        // Verify drawing button
        const verifyDrawingBtn = document.getElementById("verify-drawing-btn");
        verifyDrawingBtn.addEventListener("click", async () => {
            if (signaturePad.isEmpty()) {
                alert("Please provide a signature first.");
                return;
            }
            const imageDataURL = signaturePad.toDataURL("image/png");
            
            // --- NEW: Update the result image immediately ---
            updateResultImage(imageDataURL);

            const data = { image_data: imageDataURL };
            showLoading(true, verifyDrawingBtn, "Verifying Drawing...");
            await sendRequest(data, verifyDrawingBtn, "Verify Drawing");
        });
    }

    // This function will resize the canvas
    function resizeCanvas() {
        if (!canvas) return; 
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext("2d").scale(ratio, ratio);
        signaturePad.clear(); 
    }
    
    window.addEventListener("resize", resizeCanvas); 
    
    // --- 1B. CONTINUE TAB SETUP ---
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            const tab = item.getAttribute('data-tab');

            menuItems.forEach(i => i.classList.remove('active'));
            panels.forEach(p => p.classList.remove('active'));

            item.classList.add('active');
            document.getElementById(`${tab}-panel`).classList.add('active');
            
            const titleText = item.querySelector('span').textContent;
            mainTitle.textContent = titleText; 
            
            if (tab === 'live') {
                resizeCanvas();
            }
            
            resultSection.classList.add('hidden');
        });
    });

    // --- 2. SETUP RESULT ELEMENTS ---
    const resultSection = document.getElementById("result-section");
    const loader = document.getElementById("loader");
    const resultContent = document.getElementById("result-content");
    const resultDecision = document.getElementById("result-decision");
    const resultConfidence = document.getElementById("result-confidence");
    // NEW: Get the image element
    const resultDisplayImage = document.getElementById("result-display-image");

    // --- 3. SETUP FILE UPLOAD PANEL ---
    const uploadForm = document.getElementById("upload-form");
    const fileInput = document.getElementById("file-input");
    const fileNameElement = document.getElementById("file-name");
    const uploadButton = document.getElementById("upload-button");

    if (fileInput) {
        fileInput.addEventListener("change", () => {
            if (fileInput.files.length > 0) {
                fileNameElement.textContent = fileInput.files[0].name;
            } else {
                fileNameElement.textContent = "Click to choose a file...";
            }
        });
    }

    if (uploadForm) {
        uploadForm.addEventListener("submit", async (event) => {
            event.preventDefault(); 
            const file = fileInput.files[0];
            if (!file) return;

            // --- NEW: Read the file to display it in result section ---
            const reader = new FileReader();
            reader.onload = function(e) {
                updateResultImage(e.target.result);
            }
            reader.readAsDataURL(file);

            const formData = new FormData();
            formData.append("file", file);
            showLoading(true, uploadButton, "Verifying Upload...");
            await sendRequest(formData, uploadButton, "Verify Upload");
        });
    }

    // --- 5. HELPER FUNCTIONS ---
    
    // NEW helper function to handle updating the preview image
    function updateResultImage(src) {
        if(resultDisplayImage) {
            resultDisplayImage.src = src;
        }
    }

    async function sendRequest(data, buttonElement, buttonText) {
        let fetchOptions;
        let isFormData = data instanceof FormData;

        if (isFormData) {
            fetchOptions = { method: "POST", body: data };
        } else {
            fetchOptions = {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            };
        }

        try {
            const response = await fetch("/predict", fetchOptions);
            const resultData = await response.json();
            if (!response.ok) {
                throw new Error(resultData.error || `Server error: ${response.status}`);
            }
            showResult(resultData.decision, resultData.confidence);
        } catch (error) {
            console.error("Error:", error);
            showResult("Error", error.message);
        } finally {
            showLoading(false, buttonElement, buttonText);
        }
    }

    function showLoading(isLoading, buttonElement, buttonText) {
        resultSection.classList.remove("hidden");
        if (isLoading) {
            loader.classList.remove("hidden");
            resultContent.classList.add("hidden");
            buttonElement.disabled = true;
            buttonElement.textContent = "Verifying...";
        } else {
            loader.classList.add("hidden");
            resultContent.classList.remove("hidden");
            buttonElement.disabled = false;
            buttonElement.textContent = buttonText;
        }
    }

    function showResult(decision, confidence) {
        resultDecision.textContent = decision;
        resultConfidence.textContent = confidence || "N/A";
        resultDecision.dataset.decision = decision; // For CSS styling
    }

    // Manually trigger resize on load if canvas exists
    if(canvas) {
        resizeCanvas();
    }
});