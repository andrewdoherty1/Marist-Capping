//const express = require('express');
import fetch from 'node-fetch';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import pkg from 'pg';
const { Pool } = pkg;
import express from 'express';
import session from 'express-session';


//const moviesRoutes = require('./routes/moviesRoutes');
const app = express();
const PORT = 3000;

//Connect to the Remote Database.
const pool = new Pool({
  user: 'postgres',       // Database user
  host: '10.11.29.119',  // Remote VM IP address
  database: 'Opinionate',   // Database name
  password: 'capping2024', // Database password
  port: 5432,                 // PostgreSQL default port
});

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

//app.use('/api/movies', moviesRoutes);

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, '../client/pages')));

// Configure session middleware
app.use(
  session({
    secret: 'your-secret-key', // Replace with a secure secret key
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true in production with HTTPS
  })
);

// app.get('/', function (req, res) {
//   res.sendFile('index.html', { root: '../client/pages' })
// })
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/pages/index.html'));
});

const API_KEY = '8dfa1038447a4c092e489b3775d27ae4821a1e90';

// Define a route that will serve as a proxy
app.get('/api/games', async (req, res) => {
  try {
    const response = await fetch(`https://www.giantbomb.com/api/games/?api_key=${API_KEY}&format=json&sort=number_of_user_reviews:desc&limit=10`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);  // Send the JSON response back to the client
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Failed to fetch data from GiantBomb API' });
  }
});

// -------------------------------------------------------------
// function to search
app.get('/api/search', async (req, res) => {
  const searchTerm = req.query.q;
  if (!searchTerm) {
    return res.status(400).json({ error: 'Missing search term' });
  }

  try {
    const client = await pool.connect();

    const query = `
          SELECT m."mediaId", m.title, 'Movie' as "mediaType", mv.poster_url
          FROM media m
          JOIN movies mv ON m."mediaId" = mv."mediaID"
          WHERE LOWER(m.title) LIKE LOWER($1)
          UNION
          SELECT m."mediaId", m.title, 'Album' as "mediaType", a.cover_url as poster_url
          FROM media m
          JOIN albums a ON m."mediaId" = a."mediaID"
          WHERE LOWER(m.title) LIKE LOWER($1)
          UNION
          SELECT m."mediaId", m.title, 'Book' as "mediaType", b.cover_url as poster_url
          FROM media m
          JOIN books b ON m."mediaId" = b."mediaID"
          WHERE LOWER(m.title) LIKE LOWER($1)
          UNION
          SELECT m."mediaId", m.title, 'Video Game' as "mediaType", vg.poster_url
          FROM media m
          JOIN "videoGames" vg ON m."mediaId" = vg."mediaID"
          WHERE LOWER(m.title) LIKE LOWER($1)
          LIMIT 10;
      `;

    const values = [`%${searchTerm}%`];
    const result = await client.query(query, values);
    client.release();
    res.json(result.rows);
  } catch (error) {
    console.error('Error executing search query:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// -------------------------------------------------------------
// the majority of the code below is to either retrieve or populate the media 

// Function to fetch game details from GiantBomb
const fetchGameDetails = async (gameId) => {
  try {
    const response = await axios.get(`https://www.giantbomb.com/api/game/${gameId}/?api_key=${API_KEY}&format=json`);
    const game = response.data.results;

    return {
      title: game.name,
      releaseDate: game.original_release_date,
      description: game.deck,
      posterUrl: game.image ? game.image.medium_url : null,
      developer: game.developers[0]?.name || null,
      publisher: game.publishers[0]?.name || null,
    };
  } catch (error) {
    console.error('Error fetching game details:', error);
    throw error;
  }
};

// Function to insert game data into the database
const insertGameData = async (gameData) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const theMediaID = 500;
    const mediaResult = await client.query(
      `INSERT INTO media ("mediaId", title, "releaseDate", description)
           VALUES ($1, $2, $3, $4) RETURNING "mediaId"`,
      [theMediaID, gameData.title, gameData.releaseDate, gameData.description]
    );


    await client.query(
      `INSERT INTO "videoGames" ("mediaID", developer, publisher, poster_url)
           VALUES ($1, $2, $3, $4)`,
      [theMediaID, gameData.developer, gameData.publisher, gameData.posterUrl]
    );

    await client.query('COMMIT');
    console.log(`Game "${gameData.title}" inserted successfully`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error inserting game data:', error);
  } finally {
    client.release();
  }
};

// Endpoint to fetch game data and insert it into the database
app.get('/api/insert-game/:gameId', async (req, res) => {
  const gameId = req.params.gameId;
  try {
    const gameData = await fetchGameDetails(gameId);
    await insertGameData(gameData);
    res.json({ message: `Game "${gameData.title}" inserted successfully` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to insert game data' });
  }
});



// Route to Populate Movies tab.
app.get('/api/random-movies', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query(
      `SELECT 
         m."mediaId",
         m.title,
         TO_CHAR(m."releaseDate", 'YYYY-MM-DD') AS "releaseDate",
         m.description,
         mv.studio,
         mv.cast,
         mv.director,
         mv.poster_url
       FROM media AS m
       JOIN movies AS mv ON m."mediaId" = mv."mediaID"
       ORDER BY RANDOM()
       LIMIT 100`
    );
    client.release();

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching random movies:', error);
    res.status(500).json({ error: 'Failed to fetch random movies' });
  }
});

// Route to fetch album details from the database based on the albumId
app.get('/api/random-albums', async (req, res) => {
  try {
    const client = await pool.connect();

    const albumQuery = `
      SELECT 
        a."mediaID",
        a.artist,
        a.tracks,
        a.cover_url,
        m.title
      FROM albums AS a
      JOIN media AS m ON a."mediaID" = m."mediaId"
      ORDER BY RANDOM()
      LIMIT 100;  -- Limit to 20 random albums, can adjust as needed
    `;

    const result = await client.query(albumQuery);
    client.release();

    if (result.rows.length > 0) {
      res.json(result.rows);  // Return all random albums
    } else {
      res.status(404).json({ error: 'No albums found' });
    }
  } catch (error) {
    console.error('Error fetching random albums:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// Route to Populate Videogame Tab.
app.get('/api/random-games', async (req, res) => {
  try {
    const query = `
      SELECT m."mediaId", m.title, TO_CHAR(m."releaseDate", 'YYYY-MM-DD') AS "releaseDate", m.description, vg.developer, vg.publisher, vg.poster_url
      FROM media m
      JOIN "videoGames" vg ON m."mediaId" = vg."mediaID"
      ORDER BY RANDOM()
      LIMIT 100;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching random video games:', error);
    res.status(500).json({ error: 'Failed to fetch video game data' });
  }
});


// Route to retrieve and display books
app.get('/api/random-books', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query(
      `SELECT 
         m."mediaId",
         m.title,
         m.description,
         b.author,
         b.cover_url,
         b.year
       FROM media AS m
       JOIN books AS b ON m."mediaId" = b."mediaID"
       ORDER BY RANDOM()
       LIMIT 100`
    );
    client.release();

    res.json(result.rows); // Send books data to the frontend
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({ error: 'Failed to fetch books' });
  }
});


// Route to fetch videogame details from the database based on the mediaId.
app.get('/api/games/:id', async (req, res) => {
  const mediaId = req.params.id;

  try {
    const client = await pool.connect();

    const mediaQuery = `
      SELECT 
        m."mediaId", 
        m.title, 
        m.description, 
        TO_CHAR(m."releaseDate", 'YYYY-MM-DD') AS "releaseDate",
        mv.developer, 
        mv.publisher, 
        mv.poster_url 
      FROM media AS m
      JOIN "videoGames" AS mv ON m."mediaId" = mv."mediaID"
      WHERE m."mediaId" = $1;
    `;

    const result = await client.query(mediaQuery, [mediaId]);

    client.release();

    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: 'Media not found' });
    }
  } catch (error) {
    console.error('Error fetching media details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to fetch media details from the database based on the mediaId.
app.get('/api/media/:id', async (req, res) => {
  const mediaId = req.params.id;

  try {
    const client = await pool.connect();

    const mediaQuery = `
      SELECT 
        m."mediaId", 
        m.title, 
        m.description, 
        TO_CHAR(m."releaseDate", 'YYYY-MM-DD') AS "releaseDate",
        mv.studio, 
        mv.cast, 
        mv.director, 
        mv.poster_url 
      FROM media AS m
      JOIN movies AS mv ON m."mediaId" = mv."mediaID"
      WHERE m."mediaId" = $1;
    `;

    const result = await client.query(mediaQuery, [mediaId]);

    client.release();

    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: 'Media not found' });
    }
  } catch (error) {
    console.error('Error fetching media details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/albums/:id', async (req, res) => {
  const mediaId = req.params.id;

  try {
    const client = await pool.connect();

    const mediaQuery = `
      SELECT 
        m."mediaId", 
        m.title, 
        m.description, 
        TO_CHAR(m."releaseDate", 'YYYY-MM-DD') AS "releaseDate",
        mv.artist, 
        mv.tracks, 
        mv.cover_url 
      FROM media AS m
      JOIN albums AS mv ON m."mediaId" = mv."mediaID"
      WHERE m."mediaId" = $1;
    `;

    const result = await client.query(mediaQuery, [mediaId]);

    client.release();

    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: 'Media not found' });
    }
  } catch (error) {
    console.error('Error fetching media details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//For Books media page
app.get('/api/books/:id', async (req, res) => {
  const mediaId = req.params.id;

  try {
    const client = await pool.connect();

    const mediaQuery = `
    SELECT 
      m."mediaId",
      m.title,
      m.description,
      b.author,
      b.cover_url,
      b.year
    FROM media AS m
    JOIN books AS b ON m."mediaId" = b."mediaID"
    WHERE m."mediaId" = $1;
    `;

    const result = await client.query(mediaQuery, [mediaId]);

    client.release();

    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: 'Media not found' });
    }
  } catch (error) {
    console.error('Error fetching media details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------------------------------------
// the coede below pertains to allowing a user to sign-in/log-out and create an account

// Login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const query = 'SELECT * FROM users WHERE username = $1 AND password = $2';
    const result = await pool.query(query, [username, password]);

    if (result.rows.length > 0) {
      // User authenticated, create session
      req.session.user = { username: result.rows[0].username, id: result.rows[0].userID };
      // Log the session user information to the terminal
    console.log('Session User:', req.session.user);
      res.json({ success: true, message: 'Login successful!' });
    } else {
      res.json({ success: false, message: 'Incorrect username or password.' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.json({ success: false, message: 'Login error. Please try again.' });
  }
});

// Route to check if user is logged in
app.get('/check-session', (req, res) => {
  if (req.session.user) {
    res.json({ loggedIn: true, user: req.session.user });
  } else {
    res.json({ loggedIn: false });
  }
});

// Logout route
app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Error logging out:', err);
      return res.json({ success: false, message: 'Logout error' });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// Register route to create a new user
// Register route
app.post('/register', async (req, res) => {
  const { username, password, email } = req.body;

  try {
    // Check if the username already exists
    const checkQuery = 'SELECT * FROM users WHERE username = $1';
    const checkResult = await pool.query(checkQuery, [username]);

    if (checkResult.rows.length > 0) {
      return res.json({ success: false, message: 'Username already exists.' });
    }

    // Insert the new user and return the userID
    const insertQuery = `
      INSERT INTO users (username, password, email)
      VALUES ($1, $2, $3)
      RETURNING userID, username;
    `;
    const insertResult = await pool.query(insertQuery, [username, password, email]);
    const newUser = insertResult.rows[0];
    console.log('New user inserted: ', newUser);

    // Store the user in the session with both username and userID
    req.session.user = { username: newUser.username, id: newUser.userID};
    

    res.json({ success: true, message: 'Account created successfully!', user: req.session.user });
    console.log('User registered and session created:', req.session.user, req.session.userID);
    

  } catch (error) {
    console.error('Registration error:', error);
    res.json({ success: false, message: 'An error occurred during registration. Please try again.' });
  }
});

// Route to fetch all users (for admin or debug purposes)
app.get('/users', async (req, res) => {
  try {
    const query = 'SELECT * FROM users';
    const result = await pool.query(query);
    res.json({ success: true, users: result.rows });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.json({ success: false, message: 'An error occurred while fetching users.' });
  }
});




// ---------------------------------------------------------------------------------------------------------
// the code below is for displaying user information. this includes items such as username, bio description, profile picture etc.
// get's user info
app.get('/user-info', (req, res) => {
  if (req.session.user) {
    res.json({ success: true, username: req.session.user.username });
  } else {
    res.json({ success: false, message: 'User not logged in' });
  }
});

// ensures the user must be logged in before accessing the user profile page
app.get('/userProfile.html', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/index.html'); // Redirect to the index page if not logged in
  }
  res.sendFile(path.join(__dirname, '../client/pages/userProfile.html'));
});


// Route to submit a review
app.post('/submitReview', async (req, res) => {
  // Ensure the user is logged in
  if (!req.session.user) {
      return res.status(401).json({ success: false, message: 'User not logged in' });
  }

  const { mediaID, reviewText, rating } = req.body;
  const userID = req.session.user.id; // Retrieve userID from session

  try {
      const query = `
          INSERT INTO reviews ("userID", "mediaID", "ratingTxt", "ratingStar")
          VALUES ($1, $2, $3, $4)
          RETURNING *;
      `;
      const values = [userID, mediaID, reviewText, rating];
      const result = await pool.query(query, values);

      res.status(200).json({ success: true, review: result.rows[0] });
  } catch (error) {
      console.error('Error inserting review:', error);
      res.status(500).json({ success: false, message: 'Error saving review' });
  }
});

// app.get('/getReviews', async (req, res) => {
//   try {
//       const query = `
//           SELECT reviews."ratingTxt", reviews."ratingStar", users.username, media.title
//           FROM reviews
//           JOIN users ON reviews."userID" = users."userID"
//           JOIN media ON reviews."mediaID" = media."mediaId";
//       `;
//       const result = await pool.query(query);
//       res.status(200).json({ success: true, reviews: result.rows });
//   } catch (error) {
//       console.error('Error fetching reviews:', error);
//       res.status(500).json({ success: false, message: 'Error fetching reviews' });
//   }
// });

app.get('/getReviews', async (req, res) => {
  try {
    const query = `
      SELECT 
                reviews.*, 
                media.title, 
                users.username,
                COALESCE(movies.poster_url, albums.cover_url, books.cover_url, "videoGames".poster_url) AS cover_url,
                CASE
                    WHEN movies."mediaID" IS NOT NULL THEN 'Movie'
                    WHEN albums."mediaID" IS NOT NULL THEN 'Album'
                    WHEN books."mediaID" IS NOT NULL THEN 'Book'
                    WHEN "videoGames"."mediaID" IS NOT NULL THEN 'Video Game'
                END AS mediaType
            FROM reviews
            JOIN media ON reviews."mediaID" = media."mediaId"
            JOIN users ON reviews."userID" = users."userID"
            LEFT JOIN movies ON media."mediaId" = movies."mediaID"
            LEFT JOIN albums ON media."mediaId" = albums."mediaID"
            LEFT JOIN books ON media."mediaId" = books."mediaID"
            LEFT JOIN "videoGames" ON media."mediaId" = "videoGames"."mediaID";
    `;

    const result = await pool.query(query);

    //res.json(result.rows);
    res.status(200).json({ success: true, reviews: result.rows });
  } catch (error) {
    console.error('Error fetching reviews with cover URLs:', error);
    res.status(500).json({ error: 'An error occurred while fetching reviews.' });
  }
});



app.post('/submitBookmark', async (req, res) => {
  // Ensure the user is logged in
  if (!req.session.user) {
      return res.status(401).json({ success: false, message: 'User not logged in' });
  }

  const { mediaID } = req.body;
  const userID = req.session.user.id; // Retrieve userID from session

  try {
      const query = `
          INSERT INTO bookmark ("userID", "mediaID")
          VALUES ($1, $2)
          RETURNING *;
      `;
      const values = [userID, mediaID];
      const result = await pool.query(query, values);

      res.status(200).json({ success: true, bookmark: result.rows[0] });
  } catch (error) {
      console.error('Error inserting bookmark:', error);
      res.status(500).json({ success: false, message: 'Error saving bookmark' });
  }
});

app.get('/getAverageRating/:mediaID', async (req, res) => {
  const { mediaID } = req.params;  // Extract mediaID from the request parameters

  try {
    const query = `
      SELECT 
        AVG(reviews."ratingStar") AS averageRating,
        COUNT(reviews."mediaID") AS reviewCount
      FROM reviews
      WHERE reviews."mediaID" = $1
      GROUP BY reviews."mediaID";
    `;

    const result = await pool.query(query, [mediaID]);

    if (result.rows.length > 0) {
      res.status(200).json({ 
        success: true, 
        mediaID: mediaID, 
        averageRating: result.rows[0].averagerating, 
        reviewCount: result.rows[0].reviewcount 
      });
    } else {
      res.status(404).json({ success: false, message: 'No reviews found for this media.' });
    }
    
  } catch (error) {
    console.error('Error calculating average rating:', error);
    res.status(500).json({ error: 'An error occurred while calculating average rating.' });
  }
});

// Route to fill the user's library tab in their user profile page.
app.get('/getUserReviews', async (req, res) => {
  try {
    // Retrieve userID from the session
    const userID = req.session.user.id;
    if (!userID) {
      return res.status(401).json({ error: 'User not authenticated.' });
    }

    const query = `
      SELECT 
        reviews.*, 
        media.title, 
        users.username,
        COALESCE(movies.poster_url, albums.cover_url, books.cover_url, "videoGames".poster_url) AS cover_url,
        CASE
          WHEN movies."mediaID" IS NOT NULL THEN 'Movie'
          WHEN albums."mediaID" IS NOT NULL THEN 'Album'
          WHEN books."mediaID" IS NOT NULL THEN 'Book'
          WHEN "videoGames"."mediaID" IS NOT NULL THEN 'Video Game'
        END AS mediaType
      FROM reviews
      JOIN media ON reviews."mediaID" = media."mediaId"
      JOIN users ON reviews."userID" = users."userID"
      LEFT JOIN movies ON media."mediaId" = movies."mediaID"
      LEFT JOIN albums ON media."mediaId" = albums."mediaID"
      LEFT JOIN books ON media."mediaId" = books."mediaID"
      LEFT JOIN "videoGames" ON media."mediaId" = "videoGames"."mediaID"
      WHERE reviews."userID" = $1;
    `;

    const result = await pool.query(query, [userID]);

    res.status(200).json({ success: true, reviews: result.rows });
  } catch (error) {
    console.error('Error fetching user reviews with cover URLs:', error);
    res.status(500).json({ error: 'An error occurred while fetching user reviews.' });
  }
});

app.get('/getUserBookmarks', async (req, res) => {
  // Ensure the user is logged in
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: 'User not logged in' });
  }

  const userID = req.session.user.id;

  try {
    const query = `
      SELECT 
        bookmark.*, 
        media.title, 
        COALESCE(movies.poster_url, albums.cover_url, books.cover_url, "videoGames".poster_url) AS cover_url,
        CASE
          WHEN movies."mediaID" IS NOT NULL THEN 'Movie'
          WHEN albums."mediaID" IS NOT NULL THEN 'Album'
          WHEN books."mediaID" IS NOT NULL THEN 'Book'
          WHEN "videoGames"."mediaID" IS NOT NULL THEN 'Video Game'
        END AS mediaType
      FROM bookmark
      JOIN media ON bookmark."mediaID" = media."mediaId"
      LEFT JOIN movies ON media."mediaId" = movies."mediaID"
      LEFT JOIN albums ON media."mediaId" = albums."mediaID"
      LEFT JOIN books ON media."mediaId" = books."mediaID"
      LEFT JOIN "videoGames" ON media."mediaId" = "videoGames"."mediaID"
      WHERE bookmark."userID" = $1;
    `;
    
    const values = [userID];
    const result = await pool.query(query, values);

    res.status(200).json({ success: true, bookmarks: result.rows });
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    res.status(500).json({ success: false, message: 'Error retrieving bookmarks' });
  }
});


// -------------------------------------------------------------
// Server connection
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
