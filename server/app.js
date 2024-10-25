//const express = require('express');
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
//const moviesRoutes = require('./routes/moviesRoutes');
const app = express();
//const PORT = process.env.PORT || 3000;
const PORT = 3000;

//app.use('/api/movies', moviesRoutes);

app.use(express.static('client/pages'));

// Enable CORS for all routes
app.use(cors());

app.get('/', function (req, res) {
  res.sendFile('index.html', { root: '../client/pages' })
})

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

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});