import os
import cv2
import numpy as np
import base64  # <-- We need this to read the drawing
import io
from PIL import Image # <-- We need this to read the drawing
from flask import Flask, request, jsonify, render_template
from tensorflow.keras.models import load_model

# Initialize the Flask application
app = Flask(__name__)

# --- 1. Load your Machine Learning Model ---
print("Loading model... Please wait.")
# Use the correct, full name of your model
MODEL_PATH = 'signature_verification_resnet50_final_BEST.h5' 
model = load_model(MODEL_PATH)
print("Model loaded successfully.")

# --- 2. Define Preprocessing Function ---
# 🚨 This is still the most critical part.
# This function will now accept an image 'object'
def preprocess_image(image):
    try:
        # --- Common Preprocessing Steps ---
        # 1. Convert to NumPy array (if it's a PIL image from drawing)
        img_np = np.array(image)
        
        # 2. Convert to BGR (standard for OpenCV) if it has color
        if len(img_np.shape) == 2: # Grayscale
             img_np = cv2.cvtColor(img_np, cv2.COLOR_GRAY2BGR)
        else: # Assumes RGB
             img_np = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)

        # 3. Resize to the model's expected input (e.g., 224x224)
        IMG_SIZE = 224 
        img_resized = cv2.resize(img_np, (IMG_SIZE, IMG_SIZE))
        
        # 4. Normalize pixel values (e.g., 0-1)
        img_normalized = img_resized / 255.0
        
        # 5. Expand dimensions to create a "batch" of 1
        img_batch = np.expand_dims(img_normalized, axis=0) 
        
        return img_batch
    except Exception as e:
        print(f"Error in preprocessing: {e}")
        return None

# --- 3. Define Threshold Logic ---
def apply_thresholds(score):
    # We are TUNING these values to fix false rejections
    ACCEPT_THRESHOLD = 0.70  # <-- LOWERED from 0.90
    REJECT_THRESHOLD = 0.30  # <-- LOWERED from 0.50
    
    score_percent = f"{score * 100:.2f}%"

    if score >= ACCEPT_THRESHOLD:
        return "Accept", score_percent
    elif score < REJECT_THRESHOLD:
        return "Reject", score_percent
    else:
        # The 'Review' range is now bigger (between 30% and 70%)
        return "Review", score_percent
    
# --- 4. Define Flask Routes (API Endpoints) ---

@app.route('/', methods=['GET'])
def index():
    # Serves the main HTML page
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    image_to_process = None
    
    # --- SMART ROUTE: Check for file upload OR drawing ---
    
    if 'file' in request.files:
        # --- A. Handling File Upload ---
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400
        
        # Read image from file stream
        image_to_process = Image.open(file.stream).convert('RGB')
    
    elif 'image_data' in request.json:
        # --- B. Handling Drawing Data (Base64) ---
        image_data_url = request.json['image_data']
        
        # The data is a string "data:image/png;base64,iVBORw..."
        # We need to split off the "header" part
        try:
            header, encoded_data = image_data_url.split(',', 1)
            image_bytes = base64.b64decode(encoded_data)
            # Read image from in-memory bytes
            image_to_process = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        except Exception as e:
            print(f"Error decoding base64 image: {e}")
            return jsonify({'error': 'Invalid image data'}), 400
    
    else:
        return jsonify({'error': 'No image data found'}), 400

    # --- Now, process the image (from file or drawing) ---
    if image_to_process:
        # 1. Preprocess the image
        processed_image = preprocess_image(image_to_process)
        
        if processed_image is None:
            return jsonify({'error': 'Error processing image'}), 500
        
        # 2. Make a prediction
        prediction = model.predict(processed_image)
        score = float(prediction[0][0])
        
        # 3. Apply threshold logic
        decision, score_percent = apply_thresholds(score)
        
        # 4. Send the result back
        return jsonify({
            'decision': decision,
            'confidence': score_percent
        })

    return jsonify({'error': 'An unknown error occurred'}), 500

# --- 5. Run the Flask App ---
if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000)
