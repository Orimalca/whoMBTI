import express from 'express';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import * as path from "path";

// Remove text inside square brackets

// Remove text inside curly braces

// Remove URLs starting with http/https or www.

// Remove HTML tags

// Remove line breaks
dotenv.config();
const app = express();
const port = 8080;
const publicDirectoryPath = path.join(process.cwd());
app.use(express.static(publicDirectoryPath));

app.get('/', (req, res) => {
    res.sendFile(publicDirectoryPath+'/index.html');
});

app.get('/personality', (req, res) => {
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const name = urlParams.get('name');
    if (!name) {
        res.status(400).send('Error: Missing "name" parameter');
        return;
    }
    fetch(`https://www.reddit.com/user/${name}/comments.json`, {
        headers: {
            'User-Agent': 'node.js/1.0',
            'Authorization': `Basic ${Buffer.from('YSvDttCz0FJBa9WGyBOpJA:V4CXGfWoqkgDySLmQ0Jb7w').toString('base64')}`
        }
    })
        .then(response => response.json())
        .then(data => {
            const comments = data.data.children.map(comment => comment.data.body).join('\n');
            const regex = /Hello,\s*\/u\/\w+\.\s*Your post has been removed for violating Rule \d+\.\s*\*\*.*?\*\*\s*Please read \[our complete rules page\]\([^)]+\) before participating in the future\./g;
            let clean_comments = comments.replace(regex, "");
            clean_comments = clean_comments.replace(/Hello,\s*\/u\/\w+\.\s*Your post has been removed for violating Rule 10\.\s*\*\*No social-media, messaging, or AI-generated content content\*\*\s*Please read before participating in the future\./g, '');
            clean_comments = clean_comments.replace(/\{.*?\}/g, '');
            clean_comments = clean_comments.replace(/\((https?:\/\/(?:www\.)?\S+)\)/g, '');
            clean_comments = clean_comments.replace(/\[.*?\]/g, '');
            res.status(200).send(`${name}, your comments on Reddit are:\n${clean_comments}`);
        })
        .catch(error => {
            console.error('Error:', error);
            res.status(500).send('Error: Failed to fetch Reddit data');
        });
});

app.listen(port, () => {
    console.log(`Server started on port ${port} Ori hashoter`);
});
