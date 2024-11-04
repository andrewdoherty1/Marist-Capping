import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  user: 'postgres',       // Database user
  host: '10.11.29.119',  // Remote VM IP address
  database: 'Opinionate',   // Database name
  password: 'capping2024', // Database password
  port: 5432,                 // PostgreSQL default port
});

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
  

getTableNames();
