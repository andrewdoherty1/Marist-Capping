import pkg from 'pg';
import axios from 'axios';
const { Pool } = pkg;

const mediaID = 225; // dont change after, must change pre-run
//Connect to the Remote Database.
const pool = new Pool({
  user: 'postgres',
  host: '10.11.29.119',
  database: 'Opinionate',
  password: 'capping2024',
  port: 5432,
});

// Refresh Spotify Token every 55 minutes
setInterval(fetchSpotifyAccessToken, 55 * 60 * 1000);

// Spotify API credentials
const CLIENT_ID = 'caff6515bb5c4394a35ad9b11ee09f31';
const CLIENT_SECRET = 'aa0145b7bc214e2fae5c02bc3ff2933b';
let spotifyAccessToken;

// Fetch Spotify Access Token
async function fetchSpotifyAccessToken() {
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: 'Basic ' + btoa(CLIENT_ID + ':' + CLIENT_SECRET),
        },
        body: 'grant_type=client_credentials'
    });

    const data = await response.json();
    spotifyAccessToken = data.access_token;
}

// Function to fetch specific album data, including track names
const fetchMusicData = async (albumId) => {
  try {
    if (!spotifyAccessToken) await fetchSpotifyAccessToken();

    // Fetch album info
    const albumResponse = await fetch(`https://api.spotify.com/v1/albums/${albumId}`, {
      headers: {
        Authorization: `Bearer ${spotifyAccessToken}`,
      },
    });

    if (!albumResponse.ok) {
      throw new Error(`Failed to fetch album data: ${albumResponse.statusText}`);
    }

    const album = await albumResponse.json();

    // Check if album and tracks are available
    if (!album || !album.tracks || !album.tracks.items) {
      throw new Error("Album or tracks data is missing in the API response");
    }

    // Prepare album data with track names as a comma-separated string
    const albumData = {
      spotify_id: album.id,
      title: album.name,
      releaseDate: album.release_date,
      coverUrl: album.images?.[0]?.url || null,
      artist: album.artists[0]?.name || null,
      tracks: album.tracks.items.map(track => track.name), // Track names in a single string
    };

    return albumData;
  } catch (error) {
    console.error('Failed to fetch album data:', error);
  }
};

// Function to insert album data into the database
const insertMusicData = async (album) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const mediaResult = await client.query(
      `INSERT INTO media ("mediaId", title, "releaseDate", description)
       VALUES ($1, $2, $3, $4) RETURNING "mediaId"`,
      [mediaID, album.title, album.releaseDate, album.description || null]
    );

    await client.query(
      `INSERT INTO albums ("mediaID", artist, cover_url, tracks)
       VALUES ($1, $2, $3, $4)`,
      [mediaID, album.artist, album.coverUrl, album.tracks]
      
    );
      //mediaID++
    await client.query('COMMIT');
    console.log(`Album "${album.title}" inserted successfully`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error inserting album data:', error);
  } finally {
    client.release();
  }
};

// Fetch and store a specific album
const fetchAndSaveAlbum = async (albumId) => {
  const album = await fetchMusicData(albumId);
  if (album) {
    await insertMusicData(album);
  }
};

// Example usage
//fetchAndSaveAlbum('2pzOAoHNZiVE6Pxo3PQMhE');

// // Function to fetch and insert a movie DO NOT DELETE!
// (async () => {
//   const movieId = 631; // Desired movie ID
//   const movieData = await fetchMovieData(movieId);
//   if (movieData) {
//     await insertMovieData(movieData);
//   }
// })();

const getTableNames = async () => {
    try {
      const res = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      console.log('Tables in the database:');
      res.rows.forEach(row => {
        console.log(row.table_name);
      });
    } catch (err) {
      console.error('Error executing query', err.stack);
    }
  };

  const insertUser = async (username, password, email) => {
    try {
      const query = `
        INSERT INTO users (username, password, email)
        VALUES ($1, $2, $3)
        RETURNING *;
      `;
      
      const values = [username, password, email];  
      
      const res = await pool.query(query, values);
      
      console.log('User inserted:', res.rows[0]); 
    } catch (err) {
      console.error('Error executing query', err.stack);
    }
  };



  

