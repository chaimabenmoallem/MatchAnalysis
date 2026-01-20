// JavaScript Example: Reading Entities
// Filterable fields: task_id, video_id, start_time, end_time, segment_type, zone, player_visible, notes, order_index
async function fetchVideoSegmentEntities() {
    const response = await fetch(`https://app.base44.com/api/apps/694d61c0ed4660b15e4efd07/entities/VideoSegment`, {
        headers: {
            'api_key': 'f2a8b940913d480eaa5c536b6f57f0d0', // or use await User.me() to get the API key
            'Content-Type': 'application/json'
        }
    });
    const data = await response.json();
    console.log(data);
}

// JavaScript Example: Updating an Entity
// Filterable fields: task_id, video_id, start_time, end_time, segment_type, zone, player_visible, notes, order_index
async function updateVideoSegmentEntity(entityId, updateData) {
    const response = await fetch(`https://app.base44.com/api/apps/694d61c0ed4660b15e4efd07/entities/VideoSegment/${entityId}`, {
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