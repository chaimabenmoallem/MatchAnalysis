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
  list: async () => [],
  filter: async () => [],
  get: async () => null,
  create: async (data) => data,
  update: async (id, data) => data,
  delete: async () => {}
};

export const videoTagService = {
  list: async () => [],
  filter: async () => [],
  get: async () => null,
  create: async (data) => data,
  update: async (id, data) => data,
  delete: async () => {}
};

export const videoSegmentService = {
  list: async () => [],
  filter: async () => [],
  get: async () => null,
  create: async (data) => data,
  update: async (id, data) => data,
  delete: async () => {}
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
  create: async (data) => data,
  update: async (id, data) => data,
  delete: async () => {}
};

export const storageService = {
  uploadFile: async (file, path) => ({ path }),
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
