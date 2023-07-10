const router = require('express').Router();
const chatGptController = require('../controllers/ChatGptController');

router.get('/', chatGptController.getAnswer);

module.exports = router;