const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const path = require('path');

// If modifying these scopes, delete token.json.
// const SCOPES = ['https://www.googleapis.com/auth/drive.metadata.readonly'];
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const TOKEN_PATH = 'token.json';


// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Google Drive API.
  var func; 
  switch (process.argv[2]) { // processing the arguments to check which function to call
    case 'clean':
      func = cleanDrive;
      break;
    case 'list': 
      func = listFiles;
      break; 
    case 'create': 
      func = createFile;
      break;
    case 'dl_all': 
      func = downloadFiles;
      break;
    case 'rm': 
      func = deleteFile;
      break;
    default: 
      func = help;
  }
  authorize(JSON.parse(content), func);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

/**
 * Lists the names and IDs of up to 10 files.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listFiles(auth) {
  const drive = google.drive({version: 'v3', auth});
  drive.files.list({
    includeRemoved: false,
    pageSize: 10,
    fields: 'nextPageToken, files(id, name)',
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const files = res.data.files;
    if (files.length) {
      console.log('Files:');
      files.map((file) => {
        console.log(file);
      });
    } else {
      console.log('No files found.');
    }
  });
}

/* Function to create and upload a file 
   Usage: node drive.js create path
*/
function createFile(auth) {
  var file_path = process.argv[3];
  var name = path.basename(file_path); 
  if (typeof file_path === 'undefined') {
    console.error("Please type the name of the file as an argument");
    return;
  }
    var drive = google.drive({version: 'v3', auth});
    var fileMetadata = {
        'name': name
      };
      var media = {
        mimeType: 'text/plain', // TODO: check the mime type of the files to be uploaded
        body: fs.createReadStream(file_path)
      };
      drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id'
      }, function (err, file) {
        if (err) {
          // Handle error
          console.error(err);
        } else {
          console.log(`File uploaded with Id ${file.data.id}`);
        }
      });
}

/* Function to delete an uploaded file 
   Usage: node drive.js rm fileId
*/
function deleteFile(auth) {
  var fileId = process.argv[3];
  if (typeof fileId === 'undefined') {
    console.error("Please type the id of the file as an argument");
    return;
  }
  const drive = google.drive({version: 'v3', auth});
  console.log(`Deleting file ${fileId}`);
  drive.files.delete({
    'fileId': fileId
  });
}

/* Function to clean all the files on the drive 
   Usage: node drive.js clean
*/
function cleanDrive(auth) {
  const drive = google.drive({version: 'v3', auth});
  drive.files.list({
    includeRemoved: false,
    pageSize: 10,
    fields: 'nextPageToken, files(id, name)',
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const files = res.data.files;
    if (files.length) {
      console.log('Deleting files:');
      files.map((file) => {
        console.log(`${file.name} (${file.id})`);
        var request = drive.files.delete({
          'fileId': file.id
        });
      });
    } else {
      console.log('No files found.');
    }
  });

}

/* Function to download all uploaded files of the drive 
   Usage: node drive.js dl_all
*/
function downloadFiles(auth) {
  const drive = google.drive({version: 'v3', auth});
  drive.files.list({
    pageSize: 10,
    fields: 'nextPageToken, files(id, name)',
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const files = res.data.files;
    if (files.length) {
      files.map((file) => {
        downloadFile(auth,file.id);
      });
    } else {
      console.log('No files found.');
    }
  });
}

/* Function used by the previous one to download a file on the drive 
*/
function downloadFile(auth,fileId) {
  const drive = google.drive({version: 'v3', auth});
  var dest = fs.createWriteStream(`./${fileId}_download.txt`);
  drive.files.get({fileId: fileId, alt: 'media'}, {responseType: 'stream'},
    function(err, res){
       res.data
       .on('end', () => {
          console.log(`Downloaded file ${fileId}`);
       })
       .on('error', err => {
          console.log('Error', err);
       })
       .pipe(dest);
    });
  
}

function help(auth) {
  console.log("Unrecognized usage."); 
  console.log("Please type: \n list to print a list of Files \n clean to remove all files from the Drive \n create 'path_to_file' to create and upload a new file \n dl_all to download all files from the Drive \n rm 'fileId' to remove a file");
}