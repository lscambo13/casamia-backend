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
  ytdlp = "/home/ubuntu/.local/bin/yt-dlp"
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
  let fullResolutions = text.match(/\d+x\d+/g);

  const set = new Set(fullResolutions)
  fullResolutions = Array.from(set)
  let heights = []
  fullResolutions.forEach((e) => {
    const x = e.split('x')
    heights.push(x[1])
  })
  log(heights)
  return [heights, fullResolutions]
}

function getResolutionHeight(text) {
  if (text == 'SD') return '480';
  else if (text == 'HD') return '720';
  else if (text == 'FHD') return '1080';
  else if (text == 'QHD') return '1440';
  else if (text == 'UHD') return '2160';
  else if (text == 'UHD+') return '4320';
  else return text;
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

app.get('/getFreeDownload', async (req, res) => {
  const height = getResolutionHeight(req.query.height)
  res.header('Content-Disposition', `attachment; filename=${req.query.title} [${height}p].mp4`);

  const config =
    [
      req.query.url,
      '--ffmpeg-location', ffmpeg,
      '-o', '-',
      '-S', `res:${height},fps`
    ]

  const spawn = require('child_process').spawn;
  const ytDlpProcess = spawn(ytdlp, config);

  ytDlpProcess.on('close', function (code, signal) {
    console.log('spawn process exited with ' +
      `code ${code} and signal ${signal}`);
  });

  ytDlpProcess.stdout.pipe(res);
});

// app.get('/pipe', (req, res) => {
//   // Handle client request here
//   // Pipe yt-dlp output to the response
//   const config =
//     [
//       req.query.url,
//       '--ffmpeg-location', ffmpeg,
//       '-o', `${cache}/%(title)s [%(height)sp].%(ext)s`,
//       '-S', `res:1080,fps`
//     ]

//   const configName =
//     [
//       req.query.url,
//       '--print', 'filename',
//       '-o', `${cache}/%(title)s [%(height)sp].%(ext)s`,
//       '-S', `res:1080,fps`
//     ]

//   const spawn = require('child_process').spawn;

//   res.header('Content-Disposition', 'attachment; filename="new file name.mp4"');
//   const ytDlpProcessName = spawn(ytdlp, configName);
//   const ytDlpProcess = spawn(ytdlp, config);


//   ytDlpProcessName.stdout.on('data', (data) => {
//     const name = ytDlpProcessName.stdout.
//       console.log(name)
//     console.log(`stdout: ${data}`);
//   });

//   ytDlpProcess.on('close', function (code, signal) {
//     console.log('spawn process exited with ' +
//       `code ${code} and signal ${signal}`);
//   });

//   ytDlpProcess.stdout.pipe(res);
//   // return
// });

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
    'streams': {
      // 'bestVideoOnly': {
      //   'stream': '',
      //   'info': ''
      // },
      'bestVideoWithAudio': {
        'stream': '',
        'info': ''
      },
      // 'secondBestVideoWithAudio': {
      //   'stream': '',
      //   'info': ''
      // },
      // 'thirdBestVideoWithAudio': {
      //   'stream': '',
      //   'info': ''
      // },
      'bestAudioOnly': {
        'stream': '',
        'info': ''
      },
    },
    'thumbnail': undefined,
    'resolutions': [],
    'err': ''
  }

  // const config = `-g -f b.1,b.2,b.3,ba,bv --restrict-filenames --get-thumbnail --list-formats --get-title --print "cut-here" --print "%(height)s"`
  const config = `-g -f b.1,ba --restrict-filenames --get-thumbnail --list-formats --get-title --print "cut-here" --print "%(height)s"`


  if (url.includes('playlist')) {
    result.err = 'Playlists not supported temporarily.'
    res.send([result])
  } else {
    scan = exec(`${ytdlp} ${url} ${config}`, function (err, stdout, stderr) {
      if (stdout) {
        const info = stdout.split('cut-here\n')
        log(info)
        const formats = info[0]
        result.resolutions = regexResolution(formats)

        const bestVideoWithAudio = info[1].split('\n')
        result.streams.bestVideoWithAudio.stream = bestVideoWithAudio[2]
        result.streams.bestVideoWithAudio.info = bestVideoWithAudio[0]

        // const secondBest = info[2]?.split('\n')
        // if (secondBest &&
        //   secondBest[2] !== bestVideoWithAudio[2]) {
        //   result.streams.secondBestVideoWithAudio.stream = secondBest[2]
        //   result.streams.secondBestVideoWithAudio.info = secondBest[0]
        // }

        // const thirdBest = info[2]?.split('\n')
        // if (thirdBest &&
        //   thirdBest[2] !== secondBest[2]) {
        //   result.streams.thirdBestVideoWithAudio.stream = thirdBest[2]
        //   result.streams.thirdBestVideoWithAudio.info = thirdBest[0]
        // }

        const bestAudioOnly = info[2]?.split('\n')
        if (bestAudioOnly) {
          result.streams.bestAudioOnly.stream = bestAudioOnly[2]
          result.streams.bestAudioOnly.info = bestAudioOnly[0]
        }

        // const bestVideoOnly = info[4]?.split('\n')
        // if (bestVideoOnly &&
        //   bestVideoOnly[2] !== bestVideoWithAudio[2]) {
        //   result.streams.bestVideoOnly.stream = bestVideoOnly[2]
        //   result.streams.bestVideoOnly.info = bestVideoOnly[0]
        // }

        result.title = bestVideoWithAudio[1]
        result.thumbnail = bestVideoWithAudio[3]
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
