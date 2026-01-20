// src/api/base44Client.js

const API_KEY = "f2a8b940913d480eaa5c536b6f57f0d0";
const APP_ID = "694d61c0ed4660b15e4efd07";
const MAX_RETRIES = 5;
const RETRY_DELAY = 500; // ms
const FETCH_TIMEOUT = 10000; // 10 seconds

// Timeout wrapper for fetch
function fetchWithTimeout(url, options = {}, timeout = FETCH_TIMEOUT) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Fetch timeout')), timeout)
    )
  ]);
}

// Retry helper with exponential backoff
async function fetchWithRetry(url, options = {}, retries = 0) {
  try {
    const res = await fetchWithTimeout(url, options);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    return res;
  } catch (error) {
    const isNetworkError = error.message.includes('QUIC') || 
                          error.message.includes('Failed to fetch') || 
                          error.message.includes('timeout') ||
                          error.name === 'TypeError';
    
    if (retries < MAX_RETRIES && isNetworkError) {
      const delay = RETRY_DELAY * Math.pow(2, retries);
      console.warn(`Request failed (attempt ${retries + 1}/${MAX_RETRIES}), retrying in ${delay}ms:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries + 1);
    }
    throw error;
  }
}

async function fetchEntities(entityName, sortBy = null) {
  const url = new URL(`https://app.base44.com/api/apps/${APP_ID}/entities/${entityName}`);
  if (sortBy) {
    url.searchParams.append('sort_by', sortBy);
  }
  
  try {
    const res = await fetchWithRetry(url.toString(), {
      headers: {
        "api_key": API_KEY,
        "Content-Type": "application/json",
      },
    });
    
    return await res.json();
  } catch (error) {
    console.error(`Failed to fetch ${entityName}:`, error);
    throw new Error(`Failed to fetch ${entityName}: ${error.message}`);
  }
}

async function filterEntities(entityName, filterData, sortBy = null) {
  const url = new URL(`https://app.base44.com/api/apps/${APP_ID}/entities/${entityName}`);
  
  // Add filter parameters as query strings
  if (filterData && typeof filterData === 'object') {
    for (const [key, value] of Object.entries(filterData)) {
      if (value !== null && value !== undefined) {
        url.searchParams.append(key, value);
      }
    }
  }
  
  if (sortBy) {
    url.searchParams.append('sort_by', sortBy);
  }

  try {
    const res = await fetchWithRetry(url.toString(), {
      method: "GET",
      headers: {
        "api_key": API_KEY,
        "Content-Type": "application/json",
      },
    });

    return await res.json();
  } catch (error) {
    console.error(`Failed to filter ${entityName}:`, error);
    throw new Error(`Failed to filter ${entityName}: ${error.message}`);
  }
}

async function createEntity(entityName, data) {
  try {
    const res = await fetchWithRetry(
      `https://app.base44.com/api/apps/${APP_ID}/entities/${entityName}`,
      {
        method: "POST",
        headers: {
          "api_key": API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      }
    );

    return await res.json();
  } catch (error) {
    console.error(`Failed to create ${entityName}:`, error);
    throw new Error(`Failed to create ${entityName}: ${error.message}`);
  }
}

async function updateEntity(entityName, entityId, updateData) {
  try {
    const res = await fetchWithRetry(
      `https://app.base44.com/api/apps/${APP_ID}/entities/${entityName}/${entityId}`,
      {
        method: "PUT",
        headers: {
          "api_key": API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      }
    );

    return await res.json();
  } catch (error) {
    console.error(`Failed to update ${entityName}:`, error);
    throw new Error(`Failed to update ${entityName}: ${error.message}`);
  }
}

async function deleteEntity(entityName, entityId) {
  try {
    const res = await fetchWithRetry(
      `https://app.base44.com/api/apps/${APP_ID}/entities/${entityName}/${entityId}`,
      {
        method: "DELETE",
        headers: {
          "api_key": API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    return await res.json();
  } catch (error) {
    console.error(`Failed to delete ${entityName}:`, error);
    throw new Error(`Failed to delete ${entityName}: ${error.message}`);
  }
}

// IndexedDB helper for storing video files
const DB_NAME = 'VideoEditorDB';
const STORE_NAME = 'videos';

async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

async function storeVideoFile(videoId, file) {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({
        id: videoId,
        file: file,
        timestamp: Date.now()
      });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(videoId);
    });
  } catch (error) {
    console.error('Error storing video file:', error);
  }
}

async function getVideoFile(videoId) {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(videoId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        if (request.result && request.result.file) {
          resolve(request.result.file);
        } else {
          resolve(null);
        }
      };
    });
  } catch (error) {
    console.error('Error retrieving video file:', error);
    return null;
  }
}

async function uploadFile(file) {
  // Since Base44 doesn't have a files/upload endpoint, we create a blob URL
  // and store the file in IndexedDB for persistence
  
  try {
    // Check file size
    if (file.size > 500 * 1024 * 1024) { // > 500MB
      throw new Error('File size too large (max 500MB)');
    }
    
    // Create a temporary ID for the video
    const tempVideoId = 'temp_' + Date.now();
    
    // Store file in IndexedDB for persistence
    await storeVideoFile(tempVideoId, file);
    
    // Create blob URL for immediate use
    const blobUrl = URL.createObjectURL(file);
    
    console.log('File loaded, blob URL:', blobUrl, 'Size:', file.size, 'Stored in DB:', tempVideoId);
    
    return {
      file_url: blobUrl,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      uploaded_at: new Date().toISOString(),
      temp_video_id: tempVideoId
    };
  } catch (error) {
    console.error('File upload error:', error);
    throw new Error('File upload error: ' + error.message);
  }
}

// Create entity-specific adapters for cleaner API
const createEntityAdapter = (entityName) => ({
  list: (sortBy) => fetchEntities(entityName, sortBy),
  filter: (filterData, sortBy) => filterEntities(entityName, filterData, sortBy),
  create: (data) => createEntity(entityName, data),
  update: (id, data) => updateEntity(entityName, id, data),
  delete: (id) => deleteEntity(entityName, id),
});

// Export all your entities
export const base44 = {
  integrations: {
    Core: {
      UploadFile: (params) => uploadFile(params.file),
    }
  },
  entities: {
    ActionAnnotation: createEntityAdapter("ActionAnnotation"),
    Video: createEntityAdapter("Video"),
    VideoTask: createEntityAdapter("VideoTask"),
    VideoSegment: createEntityAdapter("VideoSegment"),
    VideoTag: createEntityAdapter("VideoTag"),
  },
  // Legacy exports for backward compatibility
  ActionAnnotation: createEntityAdapter("ActionAnnotation"),
  Video: createEntityAdapter("Video"),
  VideoTask: createEntityAdapter("VideoTask"),
  VideoSegment: createEntityAdapter("VideoSegment"),
  VideoTag: createEntityAdapter("VideoTag"),
};

// Export helper functions for video file management
export { getVideoFile, storeVideoFile };
