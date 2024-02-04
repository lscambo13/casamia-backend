const express = require('express')
const app = express()
const port = 8081
const cors = require('cors')
app.use(cors())

const util = require('util');
const { error, log } = require('console')
const exec = util.promisify(require('child_process').exec);

async function parseVideoLink(url) {
  try {
    const version = await exec(`yt-dlp --version`);
    const decode = await exec(`yt-dlp -g ${url} -f b --get-title --get-format`);
    const info = decode.stdout.split('\n')
    return {
      'version': version.stdout,
      'title': info[0],
      'link': info[1],
      'resolution': info[2],
      'raw': info.stdout,
      'err': info.stderr
    };
  } catch (err) {
    return { 'err': err.stderr }
  }
}

app.get('/', async (req, res) => {
  const queries = req.query
  console.log(queries)
  return res.sendStatus(200)
})

app.get('/dl', async (req, res) => {
  const url = req.query.url
  if (url)
    if (url) {
      const decodedURL = await parseVideoLink(url)
      if (decodedURL.link) return res.status(200).send(decodedURL);
      else return res.status(404).send(decodedURL);
    } else return res.sendStatus(403)
})

// Start the server
app.listen(port, () => {
  console.log('Server is running on port ' + port)
})