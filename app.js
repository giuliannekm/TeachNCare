/*eslint-env node*/

//------------------------------------------------------------------------------
// node.js starter application for Bluemix
//------------------------------------------------------------------------------

'use strict';

var express    = require('express'),
  app          = express(),
  watson       = require('watson-developer-cloud'),
  fs = require('fs');


// Bootstrap application settings
require('./config/express')(app);

// For local development, replace username and password
var textToSpeech = watson.text_to_speech({
  version: 'v1',
  username: 'bc7055d5-5ee3-4a21-9080-e4f3a259840e',
  password: '5GJLWBdhu3tf'
});

app.get('/api/synthesize', function(req, res, next) {
  var transcript = textToSpeech.synthesize(req.query);
  transcript.on('response', function(response) {
    if (req.query.download) {
      response.headers['content-disposition'] = 'attachment; filename=transcript.ogg';
    }
  });
  transcript.on('error', function(error) {
    next(error);
  });
  transcript.pipe(res);
});

var speechToText = watson.speech_to_text({
  version: 'v1',
  username: 'f3238296-1c22-439f-b7d0-b9f4d1d4e48c',
  password: '5kR4e1SKCDPy',
  url: 'https://stream.watsonplatform.net/speech-to-text/api'
});

var params = {
  content_type: 'audio/wav',
  model: 'en-US_BroadbandModel'
};

var authService = watson.authorization({
  version: 'v1',
  username: 'f3238296-1c22-439f-b7d0-b9f4d1d4e48c',
  password: '5kR4e1SKCDPy'
});

// Get token using your credentials
app.post('/api/token', function(req, res, next) {
  authService.getToken({url: 'https://stream.watsonplatform.net/speech-to-text/api'}, function(err, token) {
    if (err)
      next(err);
    else
      res.send(token);
  });
});

// render index page
app.get('/', function(req, res) {
  res.render('index', {
    ct: req._csrfToken,
    ga: process.env.GOOGLE_ANALYTICS
  });
});


var dialog =  watson.dialog({
  username: 'f71457c1-a6bc-4668-be24-f3a350bec0e7',
  password: 'VWOYY4TwEpiB',
  version: 'v1'
}); 

var dialog_id = 'a9500c86-fc88-460d-9e89-c79e4bc3d1d5';

/*var params = {
     name: 'techncare_dialog',
     file: fs.createReadStream('./dialogs/faq_teachncare.xml')
   };
dialog.createDialog(params, function(err, dialog) {
     if (err)
       console.log(err)
     else
       console.log(dialog.dialog_id);
       return dialog.dialog_id;
});*/


var params = {
  dialog_id: dialog_id,
  file: fs.createReadStream('./dialogs/test.xml')
};

dialog.updateDialog(params, function(err, dialog) {
  if (err)
    console.log(err)
  else
    console.log(dialog);
});


app.post('/conversation', function(req, res, next) {
  var params = { 
    dialog_id: dialog_id,
    input : req.body.input,
    conversation_id: req.body.conversation_id,
    client_id: req.body.client_id};
  dialog.conversation(params, function(err, results) {
    if (err)
      return next(err);
    else
      res.json({ dialog_id: dialog_id, conversation: results});
  });
});

app.route('/profile')
  .post(function(req, res, next) {
    var params = { 
      dialog_id: dialog_id,
      conversation_id: req.body.conversation_id,
      client_id: req.body.client_id};
    dialog.getProfile(params, function(err, results) {
      if (err)
        return next(err);
      else
        res.json(results);
    });
  });

var port = process.env.VCAP_APP_PORT || 3000;
app.listen(port);
console.log('listening at:', port);