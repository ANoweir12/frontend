const express = require('express');
const path = require('path');
const cors = require("cors")
const Cookies = require("express/lib/application");

const app = express();
const PORT = 8000;

app.use(cors())
app.use(express.static(path.join(__dirname, 'public')));

// Cookies.set('cpee_iagree', 'value', {
//     sameSite: 'none',
//     secure: true
// })

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
