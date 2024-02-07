const express = require('express')
const app = express()
const stream = require('stream');
const port = 8081
const cors = require('cors')
app.use(cors())

// https://jackett.cambo.in/api/v2.0/indexers/all/results?apikey=${secret}&Query=${query}


const util = require('util');
const { error, log } = require('console');
const exec = util.promisify(require('child_process').exec);

function removeUnicodes(text) {
  // let str = text;
  // let newStr = str.replaceAll('\ufffd', '');
  // let newStr = str.replace(/\\u[0-9A-Fa-f]{4}/g, '');
  // console.log(newStr)
  return text
}

async function parseVideoLink(url, res) {
  try {
    // const version = await exec(`yt-dlp --version`);
    const decode = await exec(`yt-dlp -g ${url} -f b --get-title --get-format --get-thumbnail`);
    const info = decode.stdout.split('\n')
    const title = removeUnicodes(info[0])
    const out = [{
      // 'version': version.stdout,
      'title': title,
      'url': info[1],
      'thumb': info[2],
      'res': info[3],
      // 'raw': decode.stdout,
      // 'err': decode.stderr
    }]
    return res.status(200).send(out);
  } catch (err) {
    return res.status(200).send([{ 'err': err.stderr, 'raw': err }])
  }
}

async function parsePlaylistLinks(url, res) {
  try {
    const decode = await exec(`yt-dlp -g ${url} -f b --get-title --get-format --get-thumbnail --print "cut-here-123"`);
    const info = decode.stdout.split(`cut-here-123\n`)
    const out = [];
    info.forEach((e) => {
      if (!e.length) return;
      const info = e.split('\n')
      const title = removeUnicodes(info[0])
      const template = {};
      template.title = title
      template.url = info[1]
      template.thumb = info[2]
      template.res = info[3]
      out.push(template)
    })
    return res.status(200).send(out);
  } catch (err) {
    return res.status(404).send([{ 'err': err.stderr, 'raw': err }])
  }
}

app.get('/', async (req, res) => {
  const queries = req.query
  console.log(queries)
  return res.sendStatus(200)
})

app.get('/dl', async (req, res) => {
  const url = req.query.url
  // res.set({ 'content-type': 'application/json; charset=binary' });
  if (!url) return res.sendStatus(403);
  if (url.includes('playlist')) {
    await parsePlaylistLinks(url, res)
  } else {
    await parseVideoLink(url, res);
  }
})

// Start the server
app.listen(port, () => {
  console.log('Server is running on port ' + port)
})