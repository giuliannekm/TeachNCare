/**
 * Copyright 2014, 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/*global $:false, SPEECH_SYNTHESIS_VOICES */

'use strict';

var utils = require('./utils');
var PubSub = require('pubsub-js');
utils.initPubSub();
var initViews = require('./views').initViews;
var showerror = require('./views/showerror');
var showError = showerror.showError;

var conversation_id, client_id;

var inputHistory = [];
var inputHistoryPointer = -1
var answer = '';


var cloudant_credentials = {
      username: "a07a80ff-45df-4f63-9a96-f10d964c2843-bluemix",
      password: "826181d5f1057b52573c309645c349d24f1c97d4ff08c8e27a6a885205180d57",
      host: "a07a80ff-45df-4f63-9a96-f10d964c2843-bluemix.cloudant.com",
      port: 443,
      url: "https://a07a80ff-45df-4f63-9a96-f10d964c2843-bluemix:826181d5f1057b52573c309645c349d24f1c97d4ff08c8e27a6a885205180d57@a07a80ff-45df-4f63-9a96-f10d964c2843-bluemix.cloudant.com"
};

/*var nano = require('nano')(cloudant.url);
var db = nano.db.use('schedule');

var request = require('request');*/

// Load the Cloudant library.
var Cloudant = require('cloudant');

var me = cloudant_credentials.username; // Set this to your own account
var password = cloudant_credentials.password;

// Initialize the library with my account.
var cloudant = Cloudant({account:me, password:password});

window.BUFFERSIZE = 8192;

$(document).ready(function() {
  var audio = document.getElementById('myaudio');
  try {
    audio.currentTime = 0;
  }
  catch(ex) {
    // ignore. Firefox just freaks out here for no apparent reason.
  }
  //audio.hidden = true;
  audio.controls = true;
  audio.muted = false;
  audio.hidden = true;

  var tokenGenerator = utils.createTokenGenerator();

  // Make call to API to try and get token
   tokenGenerator.getToken(function(err, token) {
    window.onbeforeunload = function() {
      localStorage.clear();
    };

    if (!token) {
      console.error('No authorization token available');
      console.error('Attempting to reconnect...');

      if (err && err.code)
        showError('Server error ' + err.code + ': ' + err.error);
      else
        showError('Server error ' + err.code + ': please refresh your browser and try again');
    }

    var viewContext = {
      currentModel: 'en-US_BroadbandModel',
      token: token,
      bufferSize: BUFFERSIZE
    };

    initViews(viewContext);

    // Check if playback functionality is invoked
    localStorage.setItem('playbackON', false);
    var query = window.location.search.substring(1);
    var vars = query.split('&');
    for (var i = 0; i < vars.length; i++) {
      var pair = vars[i].split('=');
      if (decodeURIComponent(pair[0]) === 'debug') {
        localStorage.setItem('playbackON',decodeURIComponent(pair[1]));
      }
    }

    // Set default current model
    localStorage.setItem('currentModel', 'en-US_BroadbandModel');
    localStorage.setItem('sessionPermissions', 'true');

  });

  function synthesizeRequest(audio, text) {
    audio.pause();
    audio.src = '/api/synthesize?voice=en-US_AllisonVoice&text=' + encodeURIComponent(text) + '&X-WDC-PL-OPT-OUT=1';
    setTimeout(function () {      
      audio.play();
    }, 150);
    return true;
  }

  $.ajaxSetup({
    headers: {
      'csrf-token': $('meta[name="ct"]').attr('content')
    }
  });

  var newquestion = function(msg, data){
    var question = data.trim();
    if(question != ''){
      converse(question);
    }
  };
  var expecting_answer = PubSub.subscribe( 'newquestion', newquestion );

  var converse = function(userText) {

    // build the conversation parameters
    var params = { input : userText };

    // check if there is a conversation in place and continue that
    // by specifing the conversation_id and client_id
    if (conversation_id) {
      params.conversation_id = conversation_id;
      params.client_id = client_id;
    }
    console.log(params);
    $.post('/conversation', params)
      .done(function onSuccess(dialog) {
        console.log(dialog.conversation.response)

        conversation_id = dialog.conversation.conversation_id;
        client_id = dialog.conversation.client_id;

        var texts = dialog.conversation.response;
        var response = texts.join('<br/>'); // &lt;br/&gt; is <br/>

        getProfile(function(data){
          if(response == ''){
            talk('WATSON', data); // show
          }
          else{
            talk('WATSON', response); // show
          }
        });
      })
      .fail(function(error){
        //talk('WATSON', error.responseJSON ? error.responseJSON.error : error.statusText);
      })
  };

  var getProfile = function(callback) {
    var params = {
      conversation_id: conversation_id,
      client_id: client_id
    };

    var search_now = '',
        subject = '',
        year = '',
        discipline = '',
        discipline_kind = '',
        answer = false;

    $.post('/profile', params).done(function(data) {
      data.name_values.forEach(function(par) {
        switch(par.name) {
          case 'search_now':
            search_now = par.value
            break;
          case 'subject':
            subject = par.value
            break;
          case 'year':
            year = par.value
            break;
          case 'discipline':
            discipline = par.value
            break; 
          case 'discipline_kind':
            discipline_kind = par.value
            break; 
        }
      });
      if (search_now == 'Yes'){
        if(subject == "time"){
          var db = cloudant.db.use('schedule')
          db.find({selector:{discipline:discipline, year:year}}, function(er, result) {
            if (er) {
              throw er
            }
            answer = 'This class happens on ' + result.docs[0].schedule.join(' and ');
            callback(answer);
          });
        }
        else{
          if(subject == "discipline_kind"){
            var db = cloudant.db.use('schedule')
            db.find({selector:{discipline_type:discipline_kind, year:year}}, function(er, result) {
              if (er) {
                throw er
              }
              answer = 'Checking it out';
              if(result.docs.length == 0){
                  answer = 'You do not have any ' + discipline_kind + ' classes';
              }
              else {
                if(result.docs.length == 1){
                  answer = 'You only have a ' + discipline_kind + ' class which is ' + result.docs[0].discipline;
                }
                else{
                  answer = 'You have ' + result.docs[0].discipline;
                  var i;
                  for(i=1;i<result.docs.length-1;i++){
                    answer += ', ' + result.docs[i].discipline
                  }
                  answer += ' and ' + result.docs[result.docs.length-1].discipline + ' as ' + discipline_kind + ' classes';
                }
              }
              callback(answer);
            });
          }
        }
      }
      else{
          callback(answer);
      }
    }).fail(function(error){
      talk('WATSON', error.responseJSON ? error.responseJSON.error : error.statusText);
    });
  };

  var talk = function(origin, text) {    
    synthesizeRequest(audio,text);
  };

  // Initialize the conversation
  converse();
  
  /*var db = cloudant.db.use('schedule')
  var type_year = {name:'disctype_year', type:'json', index:{fields:['discipline_type', 'year']}};
  db.index(type_year, function(er, response) {
    if (er) {
      throw er;
    }
    console.log('Index creation result: %s', response.result);
  });*/

});