// src/api/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://fpvvnptfzjruxpijsnun.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwdnZucHRmempydXhwaWpzbnVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5NjgwODAsImV4cCI6MjA4MzU0NDA4MH0.7st3SoR08QDKywUNlkHLN89s75VlraZxpP04V4NlaV8';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Supabase configuration missing. Please check .env.local file.');
}

// Initialize Supabase client with custom fetch for longer timeouts
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    fetch: async (url, options = {}) => {
      const timeout = options.timeout || 120000; // 2 minutes default
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    }
  }
});

// ============= Video Management =============
export const videoService = {
  // Fetch all videos
  async list() {
    const { data, error } = await supabase
      .from('Video')
      .select('*');
    if (error) throw error;
    return data;
  },

  // Filter videos
  async filter(filterData, sortBy = null) {
    let query = supabase.from('Video').select('*');

    // Apply filters
    if (filterData && typeof filterData === 'object') {
      for (const [key, value] of Object.entries(filterData)) {
        if (value !== null && value !== undefined) {
          query = query.eq(key, value);
        }
      }
    }

    // Apply sorting
    if (sortBy) {
      const isDesc = sortBy.startsWith('-');
      const field = isDesc ? sortBy.slice(1) : sortBy;
      query = query.order(field, { ascending: !isDesc });
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // Get single video
  async get(id) {
    const { data, error } = await supabase
      .from('Video')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  // Create video
  async create(videoData) {
    const { data, error } = await supabase
      .from('Video')
      .insert([videoData])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Update video
  async update(id, updateData) {
    const { data, error } = await supabase
      .from('Video')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Delete video
  async delete(id) {
    const { error } = await supabase
      .from('Video')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

// ============= Video Task Management =============
export const videoTaskService = {
  async list() {
    const { data, error } = await supabase.from('VideoTask').select('*');
    if (error) throw error;
    return data;
  },

  async filter(filterData, sortBy = null) {
    let query = supabase.from('VideoTask').select('*');

    if (filterData && typeof filterData === 'object') {
      for (const [key, value] of Object.entries(filterData)) {
        if (value !== null && value !== undefined) {
          query = query.eq(key, value);
        }
      }
    }

    if (sortBy) {
      const isDesc = sortBy.startsWith('-');
      const field = isDesc ? sortBy.slice(1) : sortBy;
      query = query.order(field, { ascending: !isDesc });
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async get(id) {
    const { data, error } = await supabase
      .from('VideoTask')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(taskData) {
    const { data, error } = await supabase
      .from('VideoTask')
      .insert([taskData])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, updateData) {
    const { data, error } = await supabase
      .from('VideoTask')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('VideoTask')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

// ============= Video Tag Management =============
export const videoTagService = {
  async list() {
    const { data, error } = await supabase.from('VideoTag').select('*');
    if (error) throw error;
    return data;
  },

  async filter(filterData, sortBy = null) {
    let query = supabase.from('VideoTag').select('*');

    if (filterData && typeof filterData === 'object') {
      for (const [key, value] of Object.entries(filterData)) {
        if (value !== null && value !== undefined) {
          query = query.eq(key, value);
        }
      }
    }

    if (sortBy) {
      const isDesc = sortBy.startsWith('-');
      const field = isDesc ? sortBy.slice(1) : sortBy;
      query = query.order(field, { ascending: !isDesc });
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async get(id) {
    const { data, error } = await supabase
      .from('VideoTag')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(tagData) {
    const { data, error } = await supabase
      .from('VideoTag')
      .insert([tagData])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, updateData) {
    const { data, error } = await supabase
      .from('VideoTag')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('VideoTag')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

// ============= Video Segment Management =============
export const videoSegmentService = {
  async list() {
    const { data, error } = await supabase.from('VideoSegment').select('*');
    if (error) throw error;
    return data;
  },

  async filter(filterData, sortBy = null) {
    let query = supabase.from('VideoSegment').select('*');

    if (filterData && typeof filterData === 'object') {
      for (const [key, value] of Object.entries(filterData)) {
        if (value !== null && value !== undefined) {
          query = query.eq(key, value);
        }
      }
    }

    if (sortBy) {
      const isDesc = sortBy.startsWith('-');
      const field = isDesc ? sortBy.slice(1) : sortBy;
      query = query.order(field, { ascending: !isDesc });
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async get(id) {
    const { data, error } = await supabase
      .from('VideoSegment')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(segmentData) {
    const { data, error } = await supabase
      .from('VideoSegment')
      .insert([segmentData])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, updateData) {
    const { data, error } = await supabase
      .from('VideoSegment')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('VideoSegment')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

// ============= Action Annotation Management =============
export const actionAnnotationService = {
  async list() {
    const { data, error } = await supabase.from('ActionAnnotation').select('*');
    if (error) throw error;
    return data;
  },

  async filter(filterData, sortBy = null) {
    let query = supabase.from('ActionAnnotation').select('*');

    if (filterData && typeof filterData === 'object') {
      for (const [key, value] of Object.entries(filterData)) {
        if (value !== null && value !== undefined) {
          query = query.eq(key, value);
        }
      }
    }

    if (sortBy) {
      const isDesc = sortBy.startsWith('-');
      const field = isDesc ? sortBy.slice(1) : sortBy;
      query = query.order(field, { ascending: !isDesc });
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async get(id) {
    const { data, error } = await supabase
      .from('ActionAnnotation')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(annotationData) {
    const { data, error } = await supabase
      .from('ActionAnnotation')
      .insert([annotationData])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, updateData) {
    const { data, error } = await supabase
      .from('ActionAnnotation')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('ActionAnnotation')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

// ============= File Storage Management =============
const BUCKET_NAME = 'videos';

export const storageService = {
  // Upload file to Supabase Storage
  async uploadFile(file, path, onProgress) {
    try {
      // Use direct upload for all files - Supabase SDK handles large files efficiently
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true,
          duplex: 'half',
          // Monitor progress
          onUploadProgress: (progress) => {
            if (onProgress && progress.loaded && progress.total) {
              const percent = Math.round((progress.loaded / progress.total) * 100);
              onProgress(percent);
            }
          }
        });
      
      if (error) throw error;
      if (onProgress) onProgress(100);
      return data;
    } catch (err) {
      console.error('Upload error:', err);
      throw err;
    }
  },

  // Get public URL for a file
  getPublicUrl(path) {
    const { data } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(path);
    return data.publicUrl;
  },

  // Delete file
  async deleteFile(path) {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);
    if (error) throw error;
  },

  // Download file
  async downloadFile(path) {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(path);
    if (error) throw error;
    return data;
  },
};

// ============= User Management =============
export const userService = {
  // Fetch all users
  async list() {
    const { data, error } = await supabase
      .from('User')
      .select('*');
    if (error) throw error;
    return data;
  },

  // Filter users
  async filter(filterData, sortBy = null) {
    let query = supabase.from('User').select('*');

    // Apply filters
    if (filterData && typeof filterData === 'object') {
      for (const [key, value] of Object.entries(filterData)) {
        if (value !== null && value !== undefined) {
          query = query.eq(key, value);
        }
      }
    }

    // Apply sorting
    if (sortBy) {
      const isDesc = sortBy.startsWith('-');
      const field = isDesc ? sortBy.slice(1) : sortBy;
      query = query.order(field, { ascending: !isDesc });
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // Get single user
  async get(id) {
    const { data, error } = await supabase
      .from('User')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  // Create user
  async create(userData) {
    const { data, error } = await supabase
      .from('User')
      .insert([userData])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Update user
  async update(id, updateData) {
    const { data, error } = await supabase
      .from('User')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Delete user
  async delete(id) {
    const { error } = await supabase
      .from('User')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

// ============= Authentication =============
export const authService = {
  // Get current user
  async me() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    
    // Get additional user info from User table
    const { data: userData } = await supabase
      .from('User')
      .select('*')
      .eq('id', user.id)
      .single();
    
    return userData || user;
  },

  // Logout
  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // Login
  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  // Sign up
  async signup(email, password, metadata = {}) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata }
    });
    if (error) throw error;
    return data;
  },
};

// ============= Convenience export (backward compatible) =============
export const base44 = {
  auth: {
    me: () => authService.me(),
    logout: () => authService.logout(),
    login: (email, password) => authService.login(email, password),
    signup: (email, password, metadata) => authService.signup(email, password, metadata),
  },
  entities: {
    Video: {
      list: () => videoService.list(),
      filter: (filters, sort) => videoService.filter(filters, sort),
      create: (data) => videoService.create(data),
      update: (id, data) => videoService.update(id, data),
      delete: (id) => videoService.delete(id),
    },
    VideoTask: {
      list: () => videoTaskService.list(),
      filter: (filters, sort) => videoTaskService.filter(filters, sort),
      create: (data) => videoTaskService.create(data),
      update: (id, data) => videoTaskService.update(id, data),
      delete: (id) => videoTaskService.delete(id),
    },
    VideoTag: {
      list: () => videoTagService.list(),
      filter: (filters, sort) => videoTagService.filter(filters, sort),
      create: (data) => videoTagService.create(data),
      update: (id, data) => videoTagService.update(id, data),
      delete: (id) => videoTagService.delete(id),
    },
    VideoSegment: {
      list: () => videoSegmentService.list(),
      filter: (filters, sort) => videoSegmentService.filter(filters, sort),
      create: (data) => videoSegmentService.create(data),
      update: (id, data) => videoSegmentService.update(id, data),
      delete: (id) => videoSegmentService.delete(id),
    },
    ActionAnnotation: {
      list: () => actionAnnotationService.list(),
      filter: (filters, sort) => actionAnnotationService.filter(filters, sort),
      create: (data) => actionAnnotationService.create(data),
      update: (id, data) => actionAnnotationService.update(id, data),
      delete: (id) => actionAnnotationService.delete(id),
    },
    User: {
      list: () => userService.list(),
      filter: (filters, sort) => userService.filter(filters, sort),
      create: (data) => userService.create(data),
      update: (id, data) => userService.update(id, data),
      delete: (id) => userService.delete(id),
    },
  },
};

// Export all services and the backward-compatible base44 object
