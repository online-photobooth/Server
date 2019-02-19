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

// TAKE PICTURE
app.get('/takePicture', (req, res) => {
  logger.info(`Taking picture`)
  camera.takePicture({
    download: true
  }, function (er, data) {
    if(!er) {
      logger.info(`Picture taken`)
      fs.writeFileSync(__dirname + '/picture.jpg', data);
      lastImageTaken = data;
      
      res.status(200).send({
        message: 'Picture taken',
        image: 'data:image/png;base64, ' + data.toString('base64'),
      })
    } else {
      if (er == '-110') {
        const errorMessage = 'Camera lens is obscured. Try again without anything in front of the lens.'
        logger.warn(errorMessage)
        res.status(500).send({ 
          message: errorMessage,
        })
      } else {
        const errorMessage = 'Something went wrong taking the picture.'
        logger.warn(errorMessage)
        res.status(500).send({ 
          message: errorMessage,
        })
      }
    }
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
  
  const fromEmail = 'postmaster@kdgphotobooth.be'
  const toEmail = req.body.email

  let transporter = nodemailer.createTransport({
    host: 'smtp.mailgun.org',
    port: 587,
    secure: true,
    auth: {
        user: 'apikey',
        pass: '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',
    }
  })

  let mailOptions = {
    from: `"Karel de Grote Hogeschool Antwerpen" ${fromEmail}`, // sender address
    to: toEmail, // list of receivers
    subject: req.body.title, // Subject line
    html: 
    `
    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
    <html xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Arial', sans-serif;">
    <head style="font-family: 'Arial', sans-serif;">
      <title style="font-family: 'Arial', sans-serif;">KdG ${req.body.title}</title>
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8" style="font-family: 'Arial', sans-serif;">
      <meta name="viewport" content="width=device-width, initial-scale=1.0" style="font-family: 'Arial', sans-serif;">
      <style type="text/css" style="font-family: 'Arial', sans-serif;">
        *{
          font-family: 'Arial', sans-serif;
        }
        a{
          outline:none;
          color:#34bedc;
          text-decoration:none;
        }
        .footer-links a:hover{border-bottom: 1px solid #34bedc;}
        .post-footer a:hover{text-decoration:underline !important;}
        .active:hover{opacity:0.8;}
        .active{
          -webkit-transition:all 0.3s ease;
          -moz-transition:all 0.3s ease;
          -ms-transition:all 0.3s ease;
          transition:all 0.3s ease;
        }
        a img{border:none !important;}
        .address span{color:inherit !important; border:none !important;}
        table td{mso-line-height-rule:exactly;}
        @media only screen and (max-width:500px) {
          table[class="flexible"]{width:100% !important;}
          table[class="table-center"]{float:none !important; margin:0 auto !important; width:auto !important;}
          *[class="hide"]{display:none !important; width:0 !important; height:0 !important; padding:0 !important; font-size:0 !important; line-height:0 !important;}
          td[class~="aligncenter"]{text-align:center !important;}
          th[class~="flex"]{display:block !important; width:100% !important;}
          td[class~="logo"]{padding:30px 20px !important;}
          td[class~="block-holder"]{padding:20px 0 !important;}
          td[class~="bg-holder"]{background-size:cover !important; padding:30px !important;}
          td[class~="box-01"]{padding:20px 30px !important;}
          td[class~="p-b-30"]{padding-bottom:30px !important;}
          td[class~="box-holder"]{padding:20px 15px !important;}
          td[class="footer"]{padding:0 10px !important;}
        }
      </style>
    </head>
    <body style="margin: 0;padding: 0;-webkit-text-size-adjust: 100%;-ms-text-size-adjust: 100%;font-family: 'Arial', sans-serif;" bgcolor="#ffffff">
      <table style="min-width: 320px;font-family: 'Arial', sans-serif;" width="100%" cellspacing="0" cellpadding="0" bgcolor="#ffffff">
        <tr style="font-family: 'Arial', sans-serif;">
          <td style="font-family: 'Arial', sans-serif;mso-line-height-rule: exactly;">
            <table class="flexible" width="600" align="center" style="margin: 0 auto 0;font-family: 'Arial', sans-serif;" cellpadding="0" cellspacing="0">
              <!-- logo https://www.kdg.be/doc/huisstijl/Logo_H_Closed_whitespace.png -->
              <tr style="font-family: 'Arial', sans-serif;">
                <td class="logo" align="left" style="padding: 50px 0px; font-family: 'Arial', sans-serif;mso-line-height-rule: exactly;">
                  <a target="_blank" href="https://www.kdg.be" rel="noopener" style="font-family: 'Arial', sans-serif;outline: none;color: #000;text-decoration: none;"><img src="https://andre.robbe.mtantwerp.eu/kdg-logo.png" border="0" style="vertical-align: top;height: 48px;font-family: 'Arial', sans-serif;border: none !important;" height="48" alt="KdG Logo"></a>
                </td>
              </tr>
              <tr style="font-family: 'Arial', sans-serif;">
                <td class="block-holder" style="padding: 0px 0 20px;font-family: 'Arial', sans-serif;mso-line-height-rule: exactly;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="font-family: 'Arial', sans-serif;">
                    <tr style="font-family: 'Arial', sans-serif;">
                      <td style="line-height: 20px;font-size: 18px;mso-line-height-rule: at-least;font-family: 'Arial', sans-serif;">
                      Leuk dat je op KdG ${req.body.title} aanwezig was!</td>
                    </tr>
                    <tr style="font-family: 'Arial', sans-serif;">
                      <td style="line-height: 20px;font-size: 18px;mso-line-height-rule: at-least;padding: 0 0 10px;font-family: 'Arial', sans-serif;">
                      Hieronder is jouw foto te zien!</td>
                    </tr>
                    <tr style="font-family: 'Arial', sans-serif;">
                      <td class="bg-holder" width="100%" height="auto" bgcolor="#fff" background="cid:unique@nodemailer.com" style="background-size: cover; background-repeat: no-repeat; background-position: center center; height: auto;width: 100%; background-repeat: no-repeat;border: 1px solid #f7f7f7;font-family: 'Arial', sans-serif;mso-line-height-rule: exactly;">
                        <!--[if gte mso 9]>
                          <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="background-size: cover; background-repeat: no-repeat; background-position: center center; width:100%; height:auto;">
                            <v:fill type="tile" src="cid:unique@nodemailer.com" color="#fff" />
                            <v:textbox inset="0,0,0,0">
                              <![endif]-->
                                <table width="100%" cellpadding="0" cellspacing="0" style="font-family: 'Arial', sans-serif;">
                                  <tr style="font-family: 'Arial', sans-serif;">
                                    <td width="125" height="375" class="hide" style="font-family: 'Arial', sans-serif;mso-line-height-rule: exactly;">
                                    </td>
                                    <td width="100" height="335" class="hide" style="font-family: 'Arial', sans-serif;mso-line-height-rule: exactly;"></td>
                                  </tr>
                                </table>
                              <!--[if gte mso 9]>
                            </v:textbox>
                          </v:rect>
                        <![endif]-->
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr style="font-family: 'Arial', sans-serif;">
                <td class="block-holder" style="padding: 50px 0 100px;font-family: 'Arial', sans-serif;mso-line-height-rule: exactly;" align="center">
                  <div style="font-family: 'Arial', sans-serif;">
                    <!--[if mso]>
                      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${req.body.albumLink}" rel="noopener" style="height:40px;v-text-anchor:middle;width:300px;" arcsize="100%" stroke="f" fillcolor="#000">
                        <w:anchorlock/>
                        <center>
                      <![endif]-->
                          <a href="${req.body.albumLink}" target="_blank" rel="noopener" style="background-color: #000;border-radius: 40px;color: #fff;display: inline-block;font-family: Arial;text-transform: uppercase;font-weight: bold;line-height: 40px;text-align: center;text-decoration: none;width: 300px;-webkit-text-size-adjust: none;outline: none;">Bekijk het album!</a>
                      <!--[if mso]>
                        </center>
                      </v:roundrect>
                    <![endif]-->
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <!-- footer -->
      <table style="min-width: 320px;border-top: 1px solid #191414;font-family: 'Arial', sans-serif;" width="100%" cellspacing="0" cellpadding="0" bgcolor="#f7f7f7">
        <tr style="font-family: 'Arial', sans-serif;">
          <td style="font-family: 'Arial', sans-serif;mso-line-height-rule: exactly;">
            <table class="flexible" width="600" align="center" style="margin: 0 auto;font-family: 'Arial', sans-serif;" cellpadding="0" cellspacing="0">
              <tr style="font-family: 'Arial', sans-serif;">
                <td class="footer" style="font-family: 'Arial', sans-serif;mso-line-height-rule: exactly;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="font-family: 'Arial', sans-serif;">
                    <tr style="font-family: 'Arial', sans-serif;">
                      <td class="p-b-30" style="padding: 0 0 57px;font-family: 'Arial', sans-serif;mso-line-height-rule: exactly;">
                        <table width="100%" cellpadding="0" cellspacing="0" style="font-family: 'Arial', sans-serif;">
                          <tr style="font-family: 'Arial', sans-serif;">
                            <th class="flex" width="170" align="left" style="vertical-align: top;padding: 0;font-family: 'Arial', sans-serif;">
                              <table width="100%" cellpadding="0" cellspacing="0" style="font-family: 'Arial', sans-serif;">
                                <tr style="font-family: 'Arial', sans-serif;">
                                  <td class="logo" align="left" style="padding: 20px 5px 0;font-family: 'Arial', sans-serif;mso-line-height-rule: exactly;">
                                    <a target="_blank" href="https://www.kdg.be" rel="noopener" style="font-family: 'Arial', sans-serif;outline: none;color: #000;text-decoration: none;"><img src="https://andre.robbe.mtantwerp.eu/kdg-logo.png" border="0" style="vertical-align: top;height: 32px;font-family: 'Arial', sans-serif;border: none !important;" height="32" alt="KdG Logo"></a>
                                  </td>
                                </tr>
                              </table>
                            </th>
                            <th class="flex" width="1" height="10" style="padding: 0;font-family: 'Arial', sans-serif;"></th>
                            <th class="flex" width="36" align="left" style="vertical-align: top;padding: 0;font-family: 'Arial', sans-serif;">
                              <table class="table-center footer-links" align="right" cellpadding="0" cellspacing="0" style="font-family: 'Arial', sans-serif;">
                                <tr style="font-family: 'Arial', sans-serif;">
                                  <td class="active" align="center" style="line-height: 20px;font-size: 14px;mso-line-height-rule: at-least;padding: 25px 10px 0;font-family: 'Arial', sans-serif;-webkit-transition: all 0.3s ease;-moz-transition: all 0.3s ease;-ms-transition: all 0.3s ease;transition: all 0.3s ease;">
                                    <a target="_blank" href="${req.body.albumLink}" rel="noopener" style="font-family: 'Arial', sans-serif;outline: none;color: #34bedc;text-decoration: none;">Online bekijken</a>
                                  </td>
                                </tr>
                              </table>
                            </th>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </html>
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
    return res.status(200).send('Email has been sent!')
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
