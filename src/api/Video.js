// JavaScript Example: Reading Entities
// Filterable fields: title, file_url, duration, resolution, frame_rate, file_size, format, home_team, away_team, competition, match_date, venue, player_name, jersey_number, player_team, player_position, played_full_match, minutes_played, sample_frames, status
async function fetchVideoEntities() {
    const response = await fetch(`https://app.base44.com/api/apps/694d61c0ed4660b15e4efd07/entities/Video`, {
        headers: {
            'api_key': 'f2a8b940913d480eaa5c536b6f57f0d0', // or use await User.me() to get the API key
            'Content-Type': 'application/json'
        }
    });
    const data = await response.json();
    console.log(data);
}

// JavaScript Example: Updating an Entity
// Filterable fields: title, file_url, duration, resolution, frame_rate, file_size, format, home_team, away_team, competition, match_date, venue, player_name, jersey_number, player_team, player_position, played_full_match, minutes_played, sample_frames, status
async function updateVideoEntity(entityId, updateData) {
    const response = await fetch(`https://app.base44.com/api/apps/694d61c0ed4660b15e4efd07/entities/Video/${entityId}`, {
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