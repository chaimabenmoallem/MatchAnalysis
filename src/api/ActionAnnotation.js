// JavaScript Example: Reading Entities
// Filterable fields: task_id, video_id, start_time, end_time, action_category, pitch_start_x, pitch_start_y, pitch_end_x, pitch_end_y, outcome, context, pass_length, pass_direction, shot_result, goal_target_x, goal_target_y, body_part, defensive_pressure, opponents_bypassed, defensive_action_type, defensive_consequence, note
async function fetchActionAnnotationEntities() {
    const response = await fetch(`https://app.base44.com/api/apps/694d61c0ed4660b15e4efd07/entities/ActionAnnotation`, {
        headers: {
            'api_key': 'f2a8b940913d480eaa5c536b6f57f0d0', // or use await User.me() to get the API key
            'Content-Type': 'application/json'
        }
    });
    const data = await response.json();
    console.log(data);
}

// JavaScript Example: Updating an Entity
// Filterable fields: task_id, video_id, start_time, end_time, action_category, pitch_start_x, pitch_start_y, pitch_end_x, pitch_end_y, outcome, context, pass_length, pass_direction, shot_result, goal_target_x, goal_target_y, body_part, defensive_pressure, opponents_bypassed, defensive_action_type, defensive_consequence, note
async function updateActionAnnotationEntity(entityId, updateData) {
    const response = await fetch(`https://app.base44.com/api/apps/694d61c0ed4660b15e4efd07/entities/ActionAnnotation/${entityId}`, {
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