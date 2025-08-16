const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.json([]);
});

router.post('/', (req, res) => {
    res.json({ message: 'contracts endpoint working' });
});

module.exports = router;
