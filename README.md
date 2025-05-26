# Weather Dashboard Application

This application displays the current weather and a 24-hour forecast for a selected location. It uses the **Open-Meteo API** for weather data. It consists of a Python Flask backend (designed as a Cloud Function) and a static HTML, CSS, and JavaScript frontend.

## Project Structure

```
.
├── backend/
│   ├── main.py             # Flask app for the weather API endpoint
│   └── requirements.txt    # Python dependencies (Flask, Open-Meteo client, Pandas, etc.)
├── frontend/
│   ├── index.html          # Main HTML file for the frontend
│   ├── style.css           # CSS styles
│   └── app.js              # JavaScript logic for fetching and displaying data
└── README.md               # This file
```

## Local Development and Testing

This section provides instructions on how to run the backend and frontend components locally for development and testing purposes.

### 1. Running the Backend (Cloud Function locally)

The backend is a Python Flask application that uses the Open-Meteo API.

1.  **Navigate to the `backend` directory:**
    ```bash
    cd backend
    ```

2.  **API Key Note:**
    The Open-Meteo API for weather forecasts, as used in this project, **does not require an API key**.

3.  **Install Dependencies:**
    It's recommended to use a virtual environment. The `requirements.txt` file includes libraries such as Flask, `openmeteo-requests`, `pandas`, `numpy`, `requests-cache`, and `retry-requests`.
    ```bash
    # (Optional but recommended) Create and activate a virtual environment
    # python -m venv venv
    # source venv/bin/activate  # On Linux/macOS
    # venv\Scripts\activate     # On Windows

    pip install -r requirements.txt
    ```

4.  **Run the Flask Development Server:**
    ```bash
    python main.py
    ```
    The backend server will typically start on `http://127.0.0.1:8080` (or another port if 8080 is busy, check the output of `python main.py`). The weather endpoint will be available at `/weather`. For example: `http://127.0.0.1:8080/weather?latitude=52.52&longitude=13.41`. The port is 8080 because the `main.py` file specifies `port=int(os.environ.get('PORT', 8080))`.

### 2. Running the Frontend

The frontend is a static site (HTML, CSS, JavaScript) that now uses the Open-Meteo Geocoding API for city name lookups and fetches weather data from the local backend.

1.  **Open `frontend/index.html` in your Web Browser:**
    Navigate to the `frontend` directory in your file explorer and open the `index.html` file directly with your preferred web browser (e.g., Chrome, Firefox, Edge).

2.  **Important: Configuring `WEATHER_API_URL` for Local Testing (if needed):**
    The `frontend/app.js` file is configured to call the backend API at a relative path (`const WEATHER_API_URL = '/weather';`). When you open `index.html` directly from your local file system (`file:///...`), the browser might block requests to a local server (`http://127.0.0.1:8080`) due to Cross-Origin Resource Sharing (CORS) policies, or the relative path might not resolve correctly.

    If the frontend does not load data and you see errors in the browser's developer console related to fetching data:
    *   Open `frontend/app.js`.
    *   Find the line defining `WEATHER_API_URL`:
        ```javascript
        const WEATHER_API_URL = '/weather';
        ```
    *   **Temporarily change it** to the full local backend URL, including the port your backend is running on (e.g., 8080):
        ```javascript
        const WEATHER_API_URL = 'http://127.0.0.1:8080/weather'; // Example using port 8080
        ```
    *   Save the `app.js` file and refresh `index.html` in your browser.
    *   **Remember to change this back if you are deploying the application where the frontend and backend are served from the same origin.**

### 3. Testing Workflow

1.  **Start the Backend Server:**
    Follow the steps in "Running the Backend" to get it running locally (it should be accessible at a URL like `http://127.0.0.1:8080/weather`).

2.  **Open `frontend/index.html` in the Browser:**
    As described in "Running the Frontend". Make sure `WEATHER_API_URL` in `app.js` is correctly configured if necessary.

3.  **Test Functionality:**
    *   The application should load and display the weather for "Berlin, Germany" by default (using its coordinates).
    *   Enter a different city name in the search box and click "Search" or press Enter. The frontend will use the Open-Meteo Geocoding API to find coordinates and then fetch weather from your backend. The weather display should update.
    *   Click the "Use My Location" button. If you grant location permissions, the weather for your current location should be displayed.
    *   Check the browser's developer console for any errors if things are not working as expected.

---
*Weather data provided by Open-Meteo.*
---

## Deployment to Google Cloud

This section outlines the steps to deploy the Weather Dashboard application to Google Cloud.

### 1. Prerequisites for Deployment

Before you begin, ensure you have the following:

*   **Google Cloud Project:** A Google Cloud Project set up and selected.
*   **Google Cloud SDK (`gcloud`):** The `gcloud` command-line tool installed and authenticated. You can install it from [here](https://cloud.google.com/sdk/docs/install). After installation, run `gcloud auth login` and `gcloud config set project YOUR_PROJECT_ID`.
*   **`gsutil` Tool:** This tool is usually part of the Google Cloud SDK. It's used for interacting with Google Cloud Storage.
*   **Note on API Keys:** The Open-Meteo API for weather forecasts (as used in this project) does not require an API key for deployment.

### 2. Deploying the Backend (Cloud Function)

The backend Python Flask application will be deployed as a Google Cloud Function.

1.  **Navigate to the `backend` directory:**
    ```bash
    cd backend
    ```

2.  **Deploy the Cloud Function:**
    Use the following `gcloud` command. Replace `YOUR_REGION` with the desired Google Cloud region (e.g., `us-central1`).
    An API key environment variable is **no longer needed** for this version of the application as Open-Meteo is used.

    ```bash
    gcloud functions deploy weather-api-function \
        --runtime python39 \
        --trigger-http \
        --entry-point app \
        --source . \
        --region YOUR_REGION \
        --allow-unauthenticated
    ```

    *   **`weather-api-function`**: This is the name you give to your Cloud Function.
    *   **`--runtime python39`**: Specifies the Python version. Adjust if you used a different compatible version (e.g., python310, python311).
    *   **`--trigger-http`**: Makes the function invokable via HTTP requests.
    *   **`--entry-point app`**: This refers to the Flask application instance in your `main.py` file (`app = Flask(__name__)`).
    *   **`--source .`**: Indicates that the source code for the function is in the current directory.
    *   **`YOUR_REGION`**: Replace with the Google Cloud region where you want to deploy the function.
    *   **`--allow-unauthenticated`**: Allows the function to be called publicly without Google Cloud IAM authentication. This is necessary for the frontend to access it directly.

3.  **Find the HTTPS Trigger URL:**
    After successful deployment, the `gcloud` command will output an `httpsTrigger.url`. This is the public URL of your deployed backend. It will look something like:
    `https://YOUR_REGION-YOUR_PROJECT_ID.cloudfunctions.net/weather-api-function`

    You can also find this URL in the Google Cloud Console under Cloud Functions > your function's details.

### 3. Deploying the Frontend (Cloud Storage)

The static frontend (HTML, CSS, JavaScript) will be hosted on Google Cloud Storage.

1.  **Crucial Step: Update `WEATHER_API_URL` in `frontend/app.js`:**
    *   Open `frontend/app.js`.
    *   Find the line:
        ```javascript
        const WEATHER_API_URL = '/weather';
        ```
    *   **Change it** to the full HTTPS trigger URL of your deployed Cloud Function (from the previous step). For example:
        ```javascript
        const WEATHER_API_URL = 'https://YOUR_REGION-YOUR_PROJECT_ID.cloudfunctions.net/weather-api-function/weather';
        ```
        **Note:** Ensure the URL path ends with `/weather` as our backend function is defined with `@app.route('/weather', ...)`.

2.  **Create a Google Cloud Storage Bucket:**
    Bucket names must be globally unique. Replace `YOUR_BUCKET_NAME` with a unique name.
    ```bash
    gsutil mb gs://YOUR_BUCKET_NAME
    ```
    Example: `gsutil mb gs://my-weather-dashboard-frontend-assets`

3.  **Make the Bucket Publicly Readable:**
    This allows users to view the static files hosted in the bucket.
    ```bash
    gsutil iam ch allUsers:objectViewer gs://YOUR_BUCKET_NAME
    ```

4.  **Upload Frontend Files:**
    This command synchronizes the contents of your local `frontend` directory to the bucket.
    ```bash
    gsutil -m rsync -r frontend gs://YOUR_BUCKET_NAME
    ```

5.  **Access the Frontend:**
    The public URL for your frontend will be:
    `https://storage.googleapis.com/YOUR_BUCKET_NAME/index.html`

### 4. (Optional) Setting Up Cloud CDN and HTTPS Load Balancer

For production applications, you might want to:

*   **Use a custom domain** (e.g., `weather.yourdomain.com`) instead of the default Cloud Storage URL.
*   **Enable HTTPS/SSL** for your custom domain.
*   **Improve performance and reduce latency** using Cloud CDN to cache static frontend assets closer to users.
*   **Serve both frontend and backend** under the same domain to avoid CORS issues and simplify `WEATHER_API_URL` configuration.

Setting this up involves using Google Cloud Load Balancing and Cloud CDN. This is a more advanced configuration. Please refer to the [official Google Cloud documentation](https://cloud.google.com/cdn/docs/setting-up-cdn-with-bucket) for detailed instructions.

---
*This README provides guidance for local development, testing, and deployment to Google Cloud.*
---

## Monitoring and Logging

Google Cloud provides integrated services for logging and monitoring your deployed application components, including Cloud Functions and Cloud Storage. These tools are invaluable for debugging issues, understanding performance, and ensuring reliability.

### 1. Cloud Logging

Cloud Functions executions automatically generate logs that are collected in Cloud Logging. These logs include:

*   **Standard Output/Error:** Anything written to `stdout` (e.g., using `print()` in Python) or `stderr` from your function code.
*   **System Logs:** Information about the function's execution, such as start and end times, execution duration, and any errors or unhandled exceptions that occur, along with stack traces.

**Accessing Logs:**

1.  Navigate to the **Google Cloud Console**.
2.  In the navigation menu, find **"Logging" > "Logs Explorer"**.
3.  You can query and filter logs. A common way to find your function's logs is to filter by:
    *   **Resource Type:** "Cloud Function" (`cloud_function`)
    *   **Function Name:** Select your deployed function (e.g., `weather-api-function`).
    *   You can also filter by log severity (e.g., "Error", "Warning").

**Advanced Debugging:**
For more detailed and searchable logs, consider implementing **structured logging** within your Python function. This involves writing logs as JSON objects with defined fields, which can be more effectively queried in Logs Explorer. Python's standard `logging` library can be configured to output structured logs.

### 2. Cloud Monitoring

Cloud Functions and Cloud Storage automatically report various metrics to Cloud Monitoring, allowing you to track their performance and health.

**Key Metrics:**

*   **For Cloud Functions (`weather-api-function`):**
    *   **Invocation Count:** The number of times your function is triggered.
    *   **Execution Duration:** The time it takes for your function to execute (average, percentiles).
    *   **Error Count and Error Rate:** The number and rate of executions that result in an error.
    *   **Memory Usage:** How much memory your function is consuming.
*   **For Cloud Storage (Frontend Bucket):**
    *   **Bucket Size:** Total storage used by your frontend assets.
    *   **Object Count:** Total number of files in the bucket.
    *   **Request Count:** Number of HTTP requests made to your bucket's objects (e.g., for `index.html`, `app.js`).
    *   **Bandwidth Usage:** Data downloaded from your bucket.

**Accessing Metrics:**

1.  Navigate to the **Google Cloud Console**.
2.  In the navigation menu, find **"Monitoring" > "Metrics Explorer"** or **"Monitoring" > "Dashboards"**.
3.  **Metrics Explorer:** Allows you to select specific metrics for Cloud Functions or Cloud Storage, visualize them, and apply filters.
4.  **Dashboards:** Google Cloud often provides pre-built dashboards for services like Cloud Functions and Cloud Storage, which display key metrics. You can also create custom dashboards to group relevant metrics for your application.

**Alerting:**
Cloud Monitoring allows you to create **alerting policies**. For example, you could set up an alert to notify your team if:
*   The error rate for your Cloud Function exceeds a certain threshold.
*   The execution latency for your Cloud Function increases significantly.
*   Your Cloud Storage bucket experiences an unusual spike in requests or bandwidth usage.

### 3. Further Information

The information above provides a starting point. For more comprehensive details on logging, monitoring, advanced querying, structured logging implementation, and setting up custom dashboards or alerts, please refer to the official Google Cloud documentation:

*   [Cloud Logging Documentation](https://cloud.google.com/logging/docs)
*   [Cloud Monitoring Documentation](https://cloud.google.com/monitoring/docs)

---
*This README provides guidance for local development, testing, deployment, and monitoring on Google Cloud.*
