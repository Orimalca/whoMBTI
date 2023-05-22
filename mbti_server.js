import express from 'express';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import * as path from 'path';
import contractions from 'contractions';
import cache from 'memory-cache';

dotenv.config();

const app = express();
const port = 8080;
const publicDirectoryPath = path.join(process.cwd());

const CLASSES = ['INTJ', 'INTP', 'INFJ', 'INFP',
                 'ENFP', 'ENTJ', 'ENFJ', 'ENTP',
                 'ESFP', 'ESTJ', 'ESFJ', 'ESTP',
                 'ISTP', 'ISFP', 'ISFJ', 'ISTJ'];
const MILI_HOUR = 3600000


app.use(express.static(publicDirectoryPath));

app.get('/', (req, res) => {
    res.sendFile(publicDirectoryPath + '/index.html');
});

app.get('/personality', cacheMiddleware, (req, res) => {
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
        // Fetching user comments
        const comments = data.data.children.map(comment => comment.data.body).join('\n');

        // Cleaning user comments
        let clean_comments = comments.replace(/Hello,\s*\/u\/\w+\.\s*Your post has been removed for violating Rule \d+\.\s*\*\*.*?\*\*\s*Please read \[our complete rules page\]\([^)]+\) before participating in the future\./g, "");
        clean_comments = clean_comments.replace(/Hello,\s*\/u\/\w+\.\s*Your post has been removed for violating Rule 10\.\s*\*\*No social-media, messaging, or AI-generated content content\.\*\*\s*Please read before participating in the future\./g, '');
        clean_comments = clean_comments.replace(/\[.*?\]/g, '');
        clean_comments = clean_comments.replace(/\{.*?\}/g, '');
        clean_comments = clean_comments.replace(/<.*?>+/g, '');
        clean_comments = clean_comments.replace(/\n/g, ' ');
        clean_comments = clean_comments.replace(/\\\/r\\\//g, '');
        clean_comments = clean_comments.replace(/\/r\//g, '');
        clean_comments = clean_comments.replace(/https?:\/\/[^\s<>"]+|www\.[^\s<>"]+/g, ' ');
        clean_comments = clean_comments.replace(/\(?(https?|http?):\/\/\S+|www\.\S+\)?/g, ' ');
        clean_comments = clean_comments.replace(/(https?|http?):\/\/\S+|www\.\S+/g, ' ');
        clean_comments = clean_comments.replace(/(https?|http?):\/\/[^\s<>"]+|www\.[^\s<>"]+/g, ' ');
        clean_comments = clean_comments.toLowerCase();
        clean_comments = contractions.expand(clean_comments); // expand contraction (I'm ==> I am)
        clean_comments = clean_comments.replace(/[^\da-z]/g, ' ');
        clean_comments = clean_comments.replace(/\s+/g, ' '); // Replace duplicated whitespaces with a single whitespace
        clean_comments = clean_comments.trim(); // Remove whitespaces from the start and end of the sentence
        if (clean_comments > 22800)
            clean_comments = clean_comments.substring(0, 22799)

        // Sending the data to the model for prediction
        let PREFIX = 'based on MBTI classify the following text:\n\n'
        let SUFFIX = '\n\nMBTI classification:'

        return fetch("https://api.ai21.com/studio/v1/j2-grande/mbti_j2_grande/complete", {
            headers: {
                "Authorization": "Bearer Td0blqoHjOMCOVzhmBKmZ14VTnxWtQEW",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "prompt": PREFIX + clean_comments + SUFFIX,
                "numResults": 1,
                "maxTokens": 3,
                "minTokens": 2,
                "temperature": 0.7,
                "topKReturn": 0
            }),
            method: "POST"
        });
    })
    .then(resp => resp.json())
    .then(function (resp) {
        const completion = resp.completions[0]['data']['text']; // in case of undefined it will go to the catch block
        completion = completion.replace(/\s+/g, '');
        completion = completion.toUpperCase();

        if (!CLASSES.includes(completion)) {
            const randomIndex = Math.floor(Math.random() * CLASSES.length);
            completion = CLASSES[randomIndex];
        }

        res.status(200).send(completion);
    })
    .catch(error => {
        const randomIndex = Math.floor(Math.random() * CLASSES.length);
        console.error('Error:', error);
        res.status(200).send(CLASSES[randomIndex]);
    });
});

function cacheMiddleware(req, res, next) {
    const key = '__express__' + req.originalUrl || req.url;
    const cachedBody = cache.get(key);
    if (cachedBody) {
        res.send(cachedBody);
    } else {
        res.sendResponse = res.send;
        res.send = (body) => {
            cache.put(key, body, MILI_HOUR); // Cache for 1 hour
            res.sendResponse(body);
        };
        next();
    }
}

app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});