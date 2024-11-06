import pkg from 'pg';
import axios from 'axios';
const { Pool } = pkg;

//Connect to the Remote Database.
const pool = new Pool({
  user: 'postgres',       // Database user
  host: '10.11.29.119',  // Remote VM IP address
  database: 'Opinionate',   // Database name
  password: 'capping2024', // Database password
  port: 5432,                 // PostgreSQL default port
});

// Function to fetch music datat from the Spotify API
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



         //Function to fetch music data from the Spotify API
        const fetchMusicData = async () => {
          try {
            if (!spotifyAccessToken) await fetchSpotifyAccessToken();
        
            const response = await fetch('https://api.spotify.com/v1/browse/new-releases?limit=10', {
              headers: {
                Authorization: `Bearer ${spotifyAccessToken}`,
              },
            });
        
            const data = await response.json();
            const albums = data.albums.items.map(album => ({
              spotify_id: album.id,
              title: album.name,
              releaseDate: album.release_date,
              description: album.description || null, // Spotify API may not have description
              coverUrl: album.images?.[0]?.url || null, // Image URL for the album cover
              artist: album.artists[0]?.name || null,  // Assuming the primary artist
            }));
        
            return albums;
          } catch (error) {
            console.error('Failed to fetch music:', error);
          }
        };
        
        // Function to insert music data into the database
        const insertMusicData = async (album) => {
          const client = await pool.connect();
          try {
            await client.query('BEGIN');
            const mediaID = 1; // Update media ID accordingly
            const mediaResult = await client.query(
              `INSERT INTO media ("mediaId", title, "releaseDate", description)
               VALUES ($1, $2, $3, $4) RETURNING "mediaId"`,
              [mediaID, album.title, album.releaseDate, album.description]
            );
        
            console.log(mediaID);
        
            await client.query(
              `INSERT INTO music ("mediaID", artist, cover_url)
               VALUES ($1, $2, $3)`,
              [mediaID, album.artist, album.coverUrl]
            );
        
            await client.query('COMMIT');
            console.log(`Album "${album.title}" inserted successfully`);
          } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error inserting album data:', error);
          } finally {
            client.release();
          }
        };
        
        // Function to fetch and save multiple albums
        const fetchAndSaveMusic = async () => {
          const albums = await fetchMusicData();
          if (albums) {
            for (const album of albums) {
              await insertMusicData(album);
            }
          }
        };
        
        // Run the function to fetch and insert music data
        fetchAndSaveMusic();




// Function to fetch movie data from the TMDB API
const fetchMovieData = async (movieId) => {
  try {
    const response = await axios.get(`https://api.themoviedb.org/3/movie/${movieId}`, {
      headers: {
        accept: 'application/json',
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2NWFkOGE0Y2NiNDgyNWNhOGMxNGYyNzIxYjNkYTA1MiIsIm5iZiI6MTcyOTYzMzA4NS45NTY3NTEsInN1YiI6IjY1Y2U3NmY5MWM2YWE3MDFhYTkxNzk3NiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.frQynqEqWI9w7Tt0nGLqyh7geVkOcuXh_qzNQyGdF1E',
      },
      params: {
        language: 'en-US',
        append_to_response: 'credits',
      },
    });
    const movie = response.data;
    
    const baseImageUrl = 'https://image.tmdb.org/t/p/w500';
    const posterUrl = movie.poster_path ? `${baseImageUrl}${movie.poster_path}` : null;

    // Initialize an array for directors
    const directors = [];

    // Check if credits exist and access crew info.
    if (movie.credits && movie.credits.crew) {
      // Populate the directors array by checking the crew info.
      for (const credit of movie.credits.crew) {
        if (credit.job.toLowerCase() === 'director') {
          directors.push(credit.name); // add director.
        }
      }
    } else {
      console.warn('No credits found in movie data');
    }
    const cast = movie.credits.cast.slice(0, 4).map(actor => actor.name);

    console.log(directors[0]);
    return {
      tmdb_id: movie.id,
      title: movie.title,
      releaseDate: movie.release_date,
      description: movie.overview,
      posterUrl,
      studio: movie.production_companies?.[0]?.name || null,
      cast,
      director: directors[0], 
    };
  } catch (error) {
    console.error('Error fetching movie data:', error);
  }
};

// Function to insert data into the database.
const insertMovieData = async (movie) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const mediaID = 102;
    const mediaResult = await client.query(
      `INSERT INTO media ("mediaId", title, "releaseDate", description)
       VALUES ($1, $2, $3, $4) RETURNING "mediaId"`,
      [mediaID, movie.title, movie.releaseDate, movie.description]
    );

    console.log(mediaID);

    await client.query(
      `INSERT INTO movies ("mediaID", studio, "cast", director, poster_url)
       VALUES ($1, $2, $3, $4, $5)`,
      [mediaID, movie.studio, movie.cast, movie.director, movie.posterUrl]
    );

    await client.query('COMMIT');
    console.log(`Movie "${movie.title}" inserted successfully`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error inserting movie data:', error);
  } finally {
    client.release();
  }
};

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
  

