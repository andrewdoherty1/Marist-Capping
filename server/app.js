//const express = require('express');
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
//const moviesRoutes = require('./routes/moviesRoutes');
const app = express();
//const PORT = process.env.PORT || 3000;
const PORT = 3000;

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

//app.use('/api/movies', moviesRoutes);

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, '../client/pages')));

// Enable CORS for all routes
app.use(cors());

app.use(express.json()); // Parse JSON request bodies

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
       LIMIT 20`
    );
    client.release();

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching random movies:', error);
    res.status(500).json({ error: 'Failed to fetch random movies' });
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

// -------------------------------------------------------
// LOGIN FUNCTION

// Login function to check user credentials
const loginUser = async (username, password) => {
  try {
    const query = 'SELECT * FROM users WHERE username = $1 AND password = $2';
    const res = await pool.query(query, [username, password]);
    if (res.rows.length > 0) {
      console.log('User logged in:', res.rows[0]);
      return { success: true, message: 'Login successful!' };
    } else {
      return { success: false, message: 'Incorrect username or password.' };
    }
  } catch (err) {
    console.error('Error logging in user:', err.stack);
    return { success: false, message: 'Login error. Please try again.' };
  }
};

// Login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const result = await loginUser(username, password);
  res.json(result);
});




// connecting to the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});