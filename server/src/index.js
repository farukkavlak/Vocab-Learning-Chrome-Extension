const express = require('express');
const app = express();
const cors = require('cors');

require("dotenv").config();

const corsOptions = {
    origin: '*',
    methods: [
        'GET',
        'POST',
        'PUT',
    ],
    allowedHeaders: [
        'Content-Type',
    ],
};

app.use(cors(corsOptions))

const port = process.env.STATUS === 'production' ? process.env.PROD_PORT : process.env.DEV_PORT;;

const chatGptRouter = require('./api/routes/ChatGptRoute');

app.use(express.json());

app.use('/api/v1', chatGptRouter);

  
  app.listen(port, () => {
    console.log(`Server listening at ${port}`);
  });