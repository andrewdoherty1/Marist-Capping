const express = require('express');
const moviesRoutes = require('./routes/moviesRoutes');
const app = express();
const PORT = process.env.PORT || 3000;

app.use('/api/movies', moviesRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});