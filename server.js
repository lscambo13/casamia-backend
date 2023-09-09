// Import Express
const express = require('express')

// Create an instance of Express
const app = express()

// Define a port number
const port = 8080

const cors = require('cors')
app.use(cors())

const util = require('util');
const exec = util.promisify(require('child_process').exec);

async function parseVideoLink(url) {
  //console.log('stdout:', stdout);
  //console.log('stderr:', stderr);
  let stdout, stderr;
  try {
    res = await exec(`yt-dlp -g ${url} -f best*[vcodec!=none][acodec!=none]`);

  }
  catch (err) {
    console.log(err)
    return
  }
  return { url : res.stdout};
}


// Create a route handler for the root path
app.get('/',async (req, res) => {
  //console.log(req.query)
  const query = req.query.url
  const decodedURL = await parseVideoLink(query)
  console.log(decodedURL)
  res.send(decodedURL);
})

// Start the server
app.listen(port, () => {
  console.log('Server is running on port ' + port)
})