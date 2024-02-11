const express = require('express')
const app = express()
const port = 8081
const cors = require('cors')
app.use(cors())
const util = require('util');
const { error, log } = require('console');
const { exec, spawn, execSync, spawnSync } = require('child_process');
// const exec = util.promisify(require('child_process').exec);

let ytdlp, ffmpeg, cache;
if (process.platform === 'win32') {
  ytdlp = "yt-dlp.exe"
  ffmpeg = "./ffmpeg-n6.1-latest-win64-gpl-6.1/bin/ffmpeg.exe"
  cache = "./yt-dlp-cache"
} else {
  ytdlp = "~/.local/bin/yt-dlp"
  ffmpeg = "./ffmpeg-n6.1-latest-linux64-gpl-6.1/bin/ffmpeg.exe"
  cache = "./yt-dlp-cache"
}

// function dlConfig() {
//   const config = `
// --get-title --get-format --get-thumbnail
// -o "./yt-dlp-cache/%(title)s [%(height)sp].%(ext)s"
// --merge-output-format mp4
// --windows-filenames
// -S "res:2160,fps"
// `;
//   const str = config.replaceAll('\n', ' ')
//   return str
// }

// https://jackett.cambo.in/api/v2.0/indexers/all/results?apikey=${secret}&Query=${query}

// function removeUnicode(text) {
//   return text.replaceAll('\ufffd', '');
// }

function regexResolution(text) {
  let matches = text.match(/\d+x\d+/g);
  const set = new Set(matches)
  matches = Array.from(set)
  // log(matches)
  return matches
}

// function quickParseVideoLink(url) {
//   let decode;
//   try {
//     decode = exec(`yt-dlp -g ${url} -f b ${dlConfig()}`);
//   } catch (err) {
//     log(err)
//     return [{ 'raw': err, 'err': err.stderr }];
//   }
//   log('single_decode', decode)
//   const info = decode.stdout.split('\n')
//   const title = removeUnicode(info[0])
//   const out = [{
//     'title': title,
//     'url': info[1],
//     'thumb': info[2],
//     'res': info[3]
//   }]
//   return out;
// }

// function serveVideo(url, height) {
//   let decode;
//   try {
//     decode = exec(`yt-dlp ${url} ${dlConfig()}`);
//   } catch (err) {
//     log(err)
//     return [{ 'raw': err, 'err': err.stderr }];
//   }
//   log('single_decode', decode)
//   const info = decode.stdout.split('\n')
//   const title = removeUnicode(info[0])
//   const out = [{
//     'title': title,
//     'url': info[1],
//     'thumb': info[2],
//     'res': info[3]
//   }]
//   return out;
// }

// function parsePlaylistLinks(url) {
//   let decode;
//   try {
//     decode = exec(`yt-dlp -g ${url} ${dlConfig()} --print "cut-here-123"`);
//   } catch (err) {
//     return [{ 'raw': err, 'err': err.stderr }]
//   }
//   log('list_decode', decode)
//   const info = decode.stdout.split(`cut-here-123\n`)
//   const out = [];
//   info.forEach((e) => {
//     if (!e.length) return;
//     const info = e.split('\n')
//     const title = removeUnicode(info[0])
//     const template = {};
//     template.title = title
//     template.url = info[1]
//     template.thumb = info[2]
//     template.res = info[3]
//     out.push(template)
//   })
//   return out;
// }

app.get('/', async (req, res) => {
  const queries = req.query
  log(queries)
  return res.sendStatus(200)
})

app.get('/test', async (req, res) => {
  const query = req.query
  log(query)
  res.send(query)
  return
})

app.get('/dl', async (req, res) => {
  let scan
  let scanOut = 'stdout\n'
  let scanErr = 'stderr\n'
  const result =
  {
    'download': undefined,
    'height': undefined,
    'stdout': undefined,
    'stderr': undefined,
    'error': undefined
  }

  const url = req.query.url
  const height = req.query.height
  if (!url) return res.send()
  if (!isFinite(height)) return res.send()

  const config =
    [
      url,
      '-v',
      '-s',
      '--ffmpeg-location', ffmpeg,
      '-o', `${cache}/%(title)s [%(height)sp].%(ext)s`,
      '--merge-output-format', 'mp4',
      '--windows-filenames',
      '-S', `res:${height},fps`
    ]

  scan = spawn(ytdlp, config);
  scan.stdout.on('data', (data) => {
    scanOut = scanOut + data
    console.log(`stdout: ${data}`);
  });
  scan.stderr.on('data', (data) => {
    scanErr = scanErr + data
    console.error(`stderr: ${data}`);
  });
  scan.on('exit', function (code, signal) {
    console.log('spawn process exited with ' +
      `code ${code} and signal ${signal}`);

    result.stdout = scanOut
    result.stderr = scanErr
    return res.send([result])
  });
  scan.on('error', function (err) {
    console.log('spawn process errored with ', err);
    result.error = err
  });

  res.on('close', () => {
    log(req.path, 'closed')
    scan.stdout.destroy();
    scan.stderr.destroy();
    scan.kill('SIGINT');
    log(result)
  })
  res.on('error', (err) => {
    log(req.path, 'errored', err)
  })
  res.on('drain', () => {
    log(req.path, 'drained')
  })
  res.on('pipe', (src) => {
    log(req.path, 'piped', log(src))
  })
  res.on('finish', () => {
    log(req.path, 'finished')
  })

  result.download = url
  result.height = height
  // log(result)
  // res.send(result);
  return
})

app.get('/getInfo', async (req, res) => {
  let scan;
  const url = req.query.url
  if (!url) return res.send()

  const result =
  {
    'title': undefined,
    'source': url,
    'stream': undefined,
    'thumbnail': undefined,
    'resolutions': [],
    'err': undefined
  }

  const config = `-g -f b --get-thumbnail --list-formats --get-title`

  if (url.includes('playlist')) {
    result.err = 'Playlists not supported temporarily.'
    res.send([result])
  } else {
    scan = exec(`${ytdlp} ${url} ${config}`, function (err, stdout, stderr) {
      if (stdout) {
        result.resolutions = regexResolution(stdout)
        const info = stdout.split('\n')
        // log(info)
        result.thumbnail = info[info.length - 2]
        result.stream = info[info.length - 3]
        result.title = info[info.length - 4]
      }
      if (stderr) result.err = result.err
      if (err) result.err = result.err + '\n' + err
      res.send([result])
    })
  }
  res.on('close', () => {
    log(req.path, 'closed')
    scan?.kill('SIGINT');
    log(result)
  })
})

// Start the server
app.listen(port, () => {
  log(`casamia-backend live on http://localhost:${port}`)
})
