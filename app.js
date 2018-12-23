'use strict';

const bodyParser = require('body-parser')
const config = require('./config.js')
const express = require('express')
const expressWinston = require('express-winston')
const http = require('http')
const request = require('request-promise')
const session = require('express-session')
const winston = require('winston')
const gphoto2 = require('gphoto2')
const cors = require('cors')
const nodemailer = require('nodemailer');
var fs = require('fs');

const GPhoto = new gphoto2.GPhoto2();
const app = express();
const server = http.Server(app);

app.use(cors())

GPhoto.setLogLevel(1);
GPhoto.on('log', function (level, domain, message) {
  console.log(domain, message);
});

let camera = undefined;
let lastImageTaken = undefined;

// List cameras / assign list item to variable to use below options
GPhoto.list(function (list) {
  if (list.length === 0) return;
  camera = list[0];
  console.log('Found', camera.model);
});

const consoleTransport = new winston.transports.Console();
const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.simple()
  ),
  transports: [
    consoleTransport
  ]
});

if (process.env.DEBUG) {
  logger.level = 'silly';

  app.use(expressWinston.logger({
    transports: [
          consoleTransport
        ],
        winstonInstance: logger
  }));
  require('request-promise').debug = true
} else {
  logger.level = 'verbose'
}

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))

// Take photo with camera without saving it to the camera
app.get('/takePicture', (req, res) => {
  logger.info(`Taking picture`)
  camera.takePicture({
    download: true
  }, function (er, data) {
    logger.info(`Picture taken`)
    fs.writeFileSync(__dirname + '/picture.jpg', data);
    lastImageTaken = data;
    
    res.status(200).send({ 
      message: 'Picture taken',
      image: 'data:image/png;base64, ' + data.toString('base64'),
    })
  })
})

app.post('/uploadLastImageTaken', (req, res) => {
  const date = Date.now();
  const filename = `${date}_kdg-photobooth.jpg`;

  logger.info(`Uploading last image taken ${filename}`);

  try {
    const resp = uploadPictureToGooglePhotos(req, res, {
      data: lastImageTaken,
      name: filename,
      token: req.body.token,
      album: req.body.album || '',
    })
    return res.status(200).send(resp)
  } catch (error) {
    return res.status(500).send(error)
  }
});

// EMAILS
app.post('/sendPictureToEmail', (req, res) => {
  console.log(req.body);

  if (req.body.token === '') {
    return res.status(400).send('No Access Token present.')
  }
  
  const fromEmail = 'kdgphotobooth@gmail.com'
  const toEmail = 'testerman@jordypereira.be'

  let transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        type: 'OAuth2',
        user: fromEmail,
        accessToken: req.body.token,
    }
  })

  let mailOptions = {
    from: `"Karel de Grote Hogeschool Antwerpen" ${fromEmail}`, // sender address
    to: toEmail, // list of receivers
    subject: req.body.title, // Subject line
    html: 
    `
    <div style="max-width: 720px">
      <h1>${req.body.title}</h1>

      <h3>Bedankt dat je op ons evenement ${req.body.title} aanwezig was!</h3>

      <p>Bekijk het hele album op <a href="${req.body.albumLink}" rel="noopener" target="_blank">Google photos</a></p>
      <p>Hieronder vind je jouw foto:</p>
      <img style="max-width: 1080px" src="cid:unique@nodemailer.com"/>
    </div>
    `,
    attachments: [{
        filename: 'picture.jpg',
        path: './picture.jpg',
        cid: 'unique@nodemailer.com'
    }]
  }

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        console.log(error)
        return res.status(400).send(error)
    }
    console.log('Message sent: %s', info.messageId)
  });
})

// Start the server
server.listen(config.port, () => {
  console.log(`App listening on http://localhost:${config.port}`)
  console.log('Press Ctrl+C to quit.')
});

const uploadPictureToGooglePhotos = async (req, res, file) => {
  const filename = file.name
  logger.info(`Uploading file ${filename} to Google Photos`)

  // try {
    const authToken = file.token
  // } catch (error) {
  //   logger.info('No Auth Token received.')
  //   return 'No Auth Token received.'
  // }

  // try {
    const albumId = file.album
  // } catch (error) {
  //   logger.info('No Album id received.')
  //   return 'No Album id received.'
  // }

  // OPTIONS UPLOAD FILE
  const options = {
    method: 'POST',
    uri: config.apiEndpoint + '/v1/uploads',
    body: file.data,
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Goog-Upload-File-Name': filename,
      'X-Goog-Upload-Protocol': 'raw'  
    },
    auth: {'bearer': authToken},
  }

  // UPLOAD FILE
  try {
    const upload_token = await request.post(options)

    // OPTIONS MEDIA ITEM
    const options2 = {
      method: 'POST',
      uri: config.apiEndpoint + '/v1/mediaItems:batchCreate',
      body: {
        'albumId': albumId,
        'newMediaItems': [
          {
            'description': 'Upload Image',
            'simpleMediaItem': {
              'uploadToken': upload_token
            }
          }
         ,
        ]
      },
      headers: {
        'Content-Type': 'application/json',
      },
      auth: {'bearer': authToken},
      json: true
    }
    logger.info(`Received Token and creating Media file`)

    // CREATE MEDIA ITEM
    try {
      const result2 = await request.post(options2)
      logger.info(`Uploaded Media file`)
      return result2
    } catch (error) {
      logger.info(`Failed Uploading Media file`)
      console.log(error)
      
      return error
    }
    
  } catch (error) {
    // res.status(500).send(error); 
    console.log(error)
    return error
  }
}