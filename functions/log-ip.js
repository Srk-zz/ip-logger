const fetch = require('node-fetch');

exports.handler = async function (event, context) {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const REPO_OWNER = process.env.REPO_OWNER;
  const REPO_NAME = process.env.REPO_NAME;
  const FILE_PATH = 'ip_log.txt';
  const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;

  try {
    // Get client IP from event headers
    const clientIp = event.headers['x-forwarded-for'] || 
                     event.headers['x-real-ip'] || 
                     event.requestContext?.identity?.sourceIp || 
                     'unknown';

    // Get current file content (if it exists)
    let sha = null;
    let content = '';
    const getResponse = await fetch(API_URL, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });

    if (getResponse.ok) {
      const data = await getResponse.json();
      sha = data.sha;
      content = Buffer.from(data.content, 'base64').toString('utf-8');
    } else if (getResponse.status !== 404) {
      throw new Error(`Failed to fetch file: ${getResponse.status}`);
    }

    // Append new IP with timestamp
    const newEntry = `${clientIp} - ${new Date().toISOString()}\n`;
    const updatedContent = content + newEntry;
    const encodedContent = Buffer.from(updatedContent).toString('base64');

    // Create or update the file
    const putResponse = await fetch(API_URL, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify({
        message: 'Log visitor IP',
        content: encodedContent,
        sha: sha, // Include SHA if updating existing file
        committer: {
          name: 'IP Logger Bot',
          email: 'bot@example.com'
        }
      })
    });

    if (!putResponse.ok) {
      const errorData = await putResponse.json();
      throw new Error(`GitHub API error: ${errorData.message}`);
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({ 
        message: 'IP logged successfully',
        ip: clientIp 
      })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: 'Error logging IP' })
    };
  }
};
