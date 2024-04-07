const express = require('express')
const app = express()
const port = 8081
const cors = require('cors')
app.use(cors())
const { log } = require('console');
const { exec, spawn } = require('child_process');
const fs = require('fs');

let ytdlp, ffmpeg, cache;
if (process.platform === 'win32') {
  ytdlp = "yt-dlp.exe"
  ffmpeg = "./ffmpeg-n6.1-latest-win64-gpl-6.1/bin/ffmpeg.exe"
  cache = "./yt-dlp-cache"
} else {
  ytdlp = "/home/ubuntu/.local/bin/yt-dlp"
  ffmpeg = "./ffmpeg-n6.1-latest-linux64-gpl-6.1/bin/ffmpeg"
  cache = "./yt-dlp-cache"
}

// https://jackett.cambo.in/api/v2.0/indexers/all/results?apikey=${secret}&Query=${query}
// yt-dlp.exe https://www.youtube.com/watch?v=8SeRU_ZPDkE --ffmpeg-location "./ffmpeg-n6.1-latest-win64-gpl-6.1/bin/ffmpeg.exe" --downloader ffmpeg -S res:1080,fps
// http://localhost:8081/getDL/?url=https://www.youtube.com/watch?v=8SeRU_ZPDkE&height=1080&title=test

function regexResolution(text) {
  let fullResolutions = text.match(/\d+x\d+/g);
  const set = new Set(fullResolutions)
  fullResolutions = Array.from(set)
  let heights = []
  fullResolutions.forEach((e) => {
    const x = e.split('x')
    heights.push(Math.min(...x))
  })
  log(heights)
  return [heights, fullResolutions]
}

function deleteDir(dir) {
  fs.rmSync(dir,
    { recursive: true, force: true },
    (err) => {
      console.log(err)
    })
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

app.get('/cdn', async (req, res) => {
  const workDir = req.query.workDir
  const outName = req.query.outName
  const outputFile = workDir + outName + '.mkv'
  res.header('Content-Disposition', `attachment; filename=${outName}`);

  const fileStream = fs.createReadStream(`${outputFile}.mkv`);
  fileStream.on('error', (err) => {
    console.log(err)
  })
  fileStream.pipe(res);
  fileStream.on('close', () => {
    deleteDir(workDir)
  })

})

app.get('/getDL2', async (req, res) => {

  const timestamp = Date.now();
  const workDir = `${cache}/${timestamp}`
  fs.mkdirSync(workDir,
    { recursive: true, force: true },
    (err) => {
      console.log(err)
      res.send(err)
    }
  )
  const height = getResolutionHeight(req.query.height)
  const outputFile = `${cache}/${timestamp}/${req.query.title} [${height}p]`
  const outName = `${req.query.title} [${height}p].mkv`

  const config = [
    req.query.url,
    '--ffmpeg-location', ffmpeg,
    '-o', outputFile,
    '--merge-output-format', 'mkv',
    '-S', `res:${height},fps`
  ]

  const spawn = require('child_process').spawn;
  const ytDlpProcess = spawn(ytdlp, config);

  ytDlpProcess.on('close', function (code, signal) {
    console.log('spawn process exited with ' +
      `code ${code} and signal ${signal}`);

    if (fs.existsSync(`${outputFile}.mkv`)) {
      res.write(`SUCCESS`)
      res.write(`/cdn/?workDir=${encodeURIComponent(workDir)}&outName=${encodeURIComponent(outName)}`)
    } else {
      deleteDir(workDir)
      res.write(`FAILED!`)
    }
    res.end();
  });

  ytDlpProcess.stdout.on('data', (d) => {
    return res.write(d)
  })

  res.on('close', () => {
    ytDlpProcess.stdout.destroy();
    ytDlpProcess.stderr.destroy();
    ytDlpProcess.kill('SIGINT');
  })
  // ytDlpProcess.stdout.pipe(res);
});


app.get('/getDL', async (req, res) => {
  const height = getResolutionHeight(req.query.height)
  res.header('Content-Disposition', `attachment; filename=${req.query.title} [${height}p].mp4`);

  const config = [
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

  res.on('close', () => {
    ytDlpProcess.stdout.destroy();
    ytDlpProcess.stderr.destroy();
    ytDlpProcess.kill('SIGINT');
  })
});

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
      'bestVideoWithAudio': {
        'stream': '',
        'info': ''
      },
    },
    'thumbnail': undefined,
    'resolutions': [],
    'err': ''
  }

  const config = `-g -f b.1 --restrict-filenames --get-thumbnail --list-formats --get-title --print "cut-here" --print "%(resolution)s"`

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
        let i = Math.min(...bestVideoWithAudio[0].split('x'))
        result.streams.bestVideoWithAudio.info = i

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
