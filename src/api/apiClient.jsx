// src/api/supabaseClient.js
const API_BASE_URL = '/api';

// ============= Video Management =============
export const videoService = {
  async list() {
    const response = await fetch(`${API_BASE_URL}/videos`);
    if (!response.ok) throw new Error('Failed to fetch videos');
    return await response.json();
  },
  async filter(filterData, sortBy = null) {
    return this.list();
  },
  async get(id) {
    const videos = await this.list();
    return videos.find(v => v.id === id);
  },
  async create(videoData) {
    const response = await fetch(`${API_BASE_URL}/videos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(videoData)
    });
    if (!response.ok) throw new Error('Failed to create video');
    return await response.json();
  },
  async update(id, updateData) { return updateData; },
  async delete(id) { return; }
};

export const videoTaskService = {
  async list() {
    const response = await fetch(`${API_BASE_URL}/tasks`);
    if (!response.ok) throw new Error('Failed to fetch tasks');
    return await response.json();
  },
  async filter(filterData, sortBy = null) {
    const params = new URLSearchParams();
    if (filterData?.task_type) params.append('task_type', filterData.task_type);
    if (sortBy) params.append('sort_by', sortBy);
    
    const response = await fetch(`${API_BASE_URL}/tasks?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to filter tasks');
    return await response.json();
  },
  async get(id) {
    const response = await fetch(`${API_BASE_URL}/tasks/${id}`);
    if (!response.ok) throw new Error('Failed to get task');
    return await response.json();
  },
  create: async (data) => {
    const response = await fetch(`${API_BASE_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create task');
    return await response.json();
  },
  update: async (id, data) => data,
  delete: async () => {}
};

export const videoTagService = {
  async list() {
    const response = await fetch(`${API_BASE_URL}/tags`);
    return await response.json();
  },
  async filter(filterData) {
    const params = new URLSearchParams();
    if (filterData?.video_id) params.append('video_id', filterData.video_id);
    const response = await fetch(`${API_BASE_URL}/tags?${params.toString()}`);
    return await response.json();
  },
  async create(data) {
    const response = await fetch(`${API_BASE_URL}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await response.json();
  },
  async delete(id) {
    await fetch(`${API_BASE_URL}/tags/${id}`, { method: 'DELETE' });
  }
};

export const videoSegmentService = {
  async list() {
    const response = await fetch(`${API_BASE_URL}/segments`);
    return await response.json();
  },
  async filter(filterData) {
    const params = new URLSearchParams();
    if (filterData?.video_id) params.append('video_id', filterData.video_id);
    const response = await fetch(`${API_BASE_URL}/segments?${params.toString()}`);
    return await response.json();
  },
  async create(data) {
    const response = await fetch(`${API_BASE_URL}/segments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await response.json();
  },
  async update(id, data) {
    const response = await fetch(`${API_BASE_URL}/segments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await response.json();
  },
  async delete(id) {
    await fetch(`${API_BASE_URL}/segments/${id}`, { method: 'DELETE' });
  }
};

export const actionAnnotationService = {
  async list(videoId) {
    const response = await fetch(`${API_BASE_URL}/annotations/${videoId}`);
    if (!response.ok) throw new Error('Failed to fetch annotations');
    return await response.json();
  },
  async extractFrames(videoUrl) {
    const response = await fetch(`${API_BASE_URL}/extract-frames`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: videoUrl })
    });
    if (!response.ok) throw new Error('Failed to extract frames');
    return await response.json();
  },
  filter: async () => [],
  get: async () => null,
  create: async (data) => {
    const response = await fetch(`${API_BASE_URL}/annotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create annotation');
    return await response.json();
  },
  update: async (id, data) => data,
  delete: async () => {}
};

export const storageService = {
  uploadFile: (file, path, onProgress) => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', path);
      
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      });
      
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (e) {
            reject(new Error('Invalid response from server'));
          }
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });
      
      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed - network error'));
      });
      
      xhr.addEventListener('timeout', () => {
        reject(new Error('Upload timed out - file may be too large'));
      });
      
      xhr.timeout = 0; // No timeout for large uploads
      xhr.open('POST', `${API_BASE_URL}/upload`);
      xhr.send(formData);
    });
  },
  getPublicUrl: (path) => path,
  deleteFile: async () => {},
  downloadFile: async () => new Blob()
};

export const userService = {
  list: async () => [],
  filter: async () => [],
  get: async () => null,
  create: async (data) => data,
  update: async (id, data) => data,
  delete: async () => {}
};

export const authService = {
  me: async () => ({ id: '1', email: 'user@example.com', role: 'admin' }),
  logout: async () => {},
  login: async () => ({ user: { id: '1' } }),
  signup: async () => ({ user: { id: '1' } })
};

export const supabase = {};
export const base44 = {
    auth: authService,
    entities: {
        Video: videoService,
        VideoTask: videoTaskService,
        VideoTag: videoTagService,
        VideoSegment: videoSegmentService,
        ActionAnnotation: actionAnnotationService,
        User: userService
    }
};
