// JavaScript Example: Reading Entities
// Filterable fields: video_id, task_type, status, assigned_to, assigned_by, assigned_date, started_date, completed_date, match_start_time, player_video_url, player_video_confirmed, notes, priority
async function fetchVideoTaskEntities() {
    const response = await fetch(`https://app.base44.com/api/apps/694d61c0ed4660b15e4efd07/entities/VideoTask`, {
        headers: {
            'api_key': 'f2a8b940913d480eaa5c536b6f57f0d0', // or use await User.me() to get the API key
            'Content-Type': 'application/json'
        }
    });
    const data = await response.json();
    console.log(data);
}

// JavaScript Example: Updating an Entity
// Filterable fields: video_id, task_type, status, assigned_to, assigned_by, assigned_date, started_date, completed_date, match_start_time, player_video_url, player_video_confirmed, notes, priority
async function updateVideoTaskEntity(entityId, updateData) {
    const response = await fetch(`https://app.base44.com/api/apps/694d61c0ed4660b15e4efd07/entities/VideoTask/${entityId}`, {
        method: 'PUT',
        headers: {
            'api_key': 'f2a8b940913d480eaa5c536b6f57f0d0', // or use await User.me() to get the API key
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
    });
    const data = await response.json();
    console.log(data);
}