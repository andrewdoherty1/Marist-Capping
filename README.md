# Marist-Capping
Code Installation Documentation:
 
 Dependencies:
 - Node.js
 - PostgreSQL

 Step 1: Clone the Repository from Github
 - Enter the command: git clone https://github.com/andrewdoherty1/Marist-Capping.git
 - Navigate to the cloned repository at the command line.

 Step 2: Setup the Database
 - Assuming that you are in the project's directory on your local machine, enter the following commands:

   psql -U postgres -c "CREATE DATABASE opinionate;"

   psql -U postgres -d opinionate -f "database/Opinionate_backup.sql"

 - Ensure that the database was indeed created before moving on to the next step.
 - The password for the created user reviewer is capping2024

 Step 3: Updates to Code: <br/>

 a. You first want to ensure that you can talk to the database:
    - To do this navigate to line 21 in app.js in the server folder.
    - Update the database connection to the following:
``` javascript
    //Connect to the Remote Database.
      const pool = new Pool({
      user: 'reviewer',
      host: '127.0.0.1',  // Connect to the local machine
      database: 'opinionate',
      password: 'capping2024',
      port: 5432
    });
```
    Note: You may also change this to whatever modifications you see fit!

 b. Next, do the same thing as above to update the database connection on line 7 of the databaseCommsTest.js file. 
  (Only do this step if you are interested in inserting media into the database).

 c. Navigate to line 140 in createAccount.html which is in client/pages.
    - replace the line with: 

        const response = await fetch('http://localhost:3000/login', {

 d. Navigate to line 179 in createAccount.html which is in client/pages.
    - replace the line with: 

        const response = await fetch('http://localhost:3000/register', {

 e. Go to app.js which is in the server folder.
    - replace line 19 with: const PORT = 3000;
    - replace line 1069-1072 with:

      // Server connection
      app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
      }); 

 Step 4: Install Node Dependencies
 - Simply run npm install while in the project's directory.
 Note: You may need to run an npm install sharp if you are on a windows machine.

 Step 5: Issue the command: node app.js while in the server folder.

 Step 6: Navigate to http://localhost:3000 and the site should be up and running!
 - Note you can update the port as you see fit!


