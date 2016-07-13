
/**
 * Copyright 2014 IBM Corp. All Rights Reserved.
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
/* global $ */
/* eslint no-invalid-this: 0, brace-style: 0, dot-notation: 0, spaced-comment:0 */
'use strict';

const INITIAL_OFFSET_X = 30;
const INITIAL_OFFSET_Y = 30;
const fontSize = 16;
const delta_y = 2 * fontSize;
const radius = 5;
const space = 4;
const hstep = 32;
const timeout = 500;
const defaultFont = fontSize + 'px Arial';
const boldFont = 'bold ' + fontSize + 'px Arial';
const italicFont = 'italic ' + fontSize + 'px Arial';
const opacity = '0.6';
var canvas = document.getElementById('canvas');
var showAllHypotheses = true;
var keywordsInputDirty = false;
var keywords_to_search = [];
var detected_keywords = {};
var ctx = canvas.getContext('2d');
var leftArrowEnabled = false;
var rightArrowEnabled = false;
var worker = null;
var runTimer = false;
var scrolled = false;
// var textScrolled = false;
var pushed = 0;
var popped = 0;

ctx.font = defaultFont;


exports.initDisplayMetadata = function() {
  keywordsInputDirty = false;

  var workerScriptBody =
    'var fifo = [];\n' +
    'var onmessage = function(event) {\n' +
    '  var payload = event.data;\n' +
    '  var type = payload.type;\n' +
    '  if(type == \'push\') {\n' +
    '    fifo.push(payload.msg);\n' +
    '  }\n' +
    '  else if(type == \'shift\' && fifo.length > 0) {\n' +
    '    var msg = fifo.shift();\n' +
    '    postMessage({\n' +
    '     bins:msg.results[0].word_alternatives,\n' +
    '     kws:msg.results[0].keywords_result\n' +
    '    });\n' +
    '  }\n' +
    '  else if(type == \'clear\') {\n' +
    '    fifo = [];\n' +
    '    console.log(\'worker: fifo cleared\');\n' +
    '  }\n' +
    '}\n';

  var blobURL = window.URL.createObjectURL(new Blob([workerScriptBody]));
  worker = new Worker(blobURL);
  worker.onmessage = function(event) {
    var data = event.data;
    // eslint-disable-next-line no-use-before-define
    //showCNsKWS(data.bins, data.kws);
    popped++;
    console.log('----> popped', popped);
  };
};

exports.showJSON = function(baseJSON) {
   $('#resultsJSON').val(baseJSON);
};

function onTimer() {
  worker.postMessage({
    type:'shift'
  });
  if (runTimer == true) {
    setTimeout(onTimer, timeout);
  }
}

exports.showResult = function(msg, baseString) {
  if (msg.results && msg.results.length > 0) {
    //var alternatives = msg.results[0].alternatives;
    var text = msg.results[0].alternatives[0].transcript || '';

    // apply mappings to beautify
    text = text.replace(/%HESITATION\s/g, '');
    text = text.replace(/([^*])\1{2,}/g, '');

    if (msg.results[0].final) {
          
      var textDisplay = document.getElementById('textDisplay');
      var myspan = document.createElement("SPAN");
      myspan.textContent = text;
      textDisplay.appendChild(myspan);

      console.log('-> ' + text);
      worker.postMessage({
        type:'push',
        msg:msg
      });
      pushed++;
      console.log('----> pushed', pushed);
      if (runTimer == false) {
        runTimer = true;
        setTimeout(onTimer, timeout);
      }
    }
    text = text.replace(/D_[^\s]+/g,'');

    // if all words are mapped to nothing then there is nothing else to do
    if ((text.length == 0) || (/^\s+$/.test(text))) {
      return baseString;
    }

    // capitalize first word
    // if final results, append a new paragraph
    if (msg.results && msg.results[0] && msg.results[0].final) {
      text = text.slice(0, -1);
      text = text.charAt(0).toUpperCase() + text.substring(1);
      baseString += ' ' + text;
      $('#resultsText').val(baseString);
    }
    else {
      $('#resultsText').val(baseString + ' ' + text);
    }
  }
  //updateTextScroll();
  console.log(baseString);
  return baseString;
};

exports.cleanScreen = function(){
  $("span").remove();
};