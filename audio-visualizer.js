const prevLevels = new Array(220);
const body = document.querySelector('main');
const visualMainElement = document.querySelector("main");
const canvas = document.createElement('canvas');
body.appendChild(canvas);
const downloadLink = document.getElementById('download');
const runner = new Array();
const ctx = canvas.getContext('2d');
const width = window.innerWidth;
const height = window.innerHeight;
const w = width/prevLevels.length;
const minHeight = 2;
const expSec = 2;
const border = 0.01;
let happy = false;
let shouldStop = false;
let stopped = false;
window.addEventListener('resize', resizeCanvas, false);

function secondsStraight(array,number,happy) {
  const ret = [...array];
  let check = false;
  let up = 0;
  var numberOfStraight = 0;
  if (happy) {
   for (var i = 0; i < ret.length; i++) {
     if (ret[i]["vol"] >=border) {ret[i]["happy"] = true} else {ret[i]["happy"] = false}
     numberOfStraight = array[i]["vol"] >=border ? numberOfStraight + 1 : 0;
     if (numberOfStraight === 0 & check === true) {
      return ret.slice(i-up-number+1,i+1);
     }
     if(numberOfStraight >=number) {
      check = true;
      up = up+1;
     }
     if (i===ret.length-1) {
      return ret.slice(i-up-number+2,i+1);
     }
   }   
  } else {
   for (var i = 0; i < ret.length; i++) {
       numberOfStraight = ret[i]["vol"] >=border ? numberOfStraight + 1 : 0;
       if (numberOfStraight === number) return ret.slice(i-number+1,i+1);
   }   
   return false;
 }
}

class AudioVisualizer {
  constructor(audioContext, processFrame, processError) {
    this.audioContext = audioContext;
    this.processFrame = processFrame;
    this.connectStream = this.connectStream.bind(this);
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: false })
      .then(this.connectStream)
      .catch((error) => {
        if (processError) {
          processError(error);
        }
      });
  }

  connectStream(stream) {
    const ac = this.audioContext;
    if(ac && ac.state !== 'closed') {
  console.log(ac.state);
      const options = {mimeType: 'audio/webm'};
      const mediaRecorder = new MediaRecorder(stream, options);
      const source = this.audioContext.createMediaStreamSource(stream);
      const recordedChunks = [];
      mediaRecorder.start();
      mediaRecorder.addEventListener('dataavailable', function(e) {
        if (e.data.size > 0) {
          recordedChunks.push(e.data);
        }
      });
      this.analyser = ac.createAnalyser();
      const meter = createAudioMeter(this.audioContext);
      source.connect(meter);
      this.analyser.smoothingTimeConstant = 0;
      this.analyser.fftSize = 32;
      this.initRenderLoop(this.analyser,this.audioContext);
      source.connect(this.analyser);
      const x = setInterval(function() {
        runner.push({"vol":meter.volume,"time":meter.context.currentTime});
        const res = secondsStraight(runner,expSec, happy);
        if (res) {
          happy=true;
          const beg = res[0]["time"]-1;
          const end = res[res.length - 1]["time"];
          const lng = res.length+1;
          if (res[res.length - 1]["happy"]===false) {
            //console.log("Great! You chanted approx. for "+lng+" consecutive seconds; your chant should be somewhere between "+beg+" and "+end);
            // console.log("THESE ARE ALL TIMESTAMPS:");
            // console.log(runner);
            // console.log("THESE ARE CONSECUTIVE TIMESTAMPS WITH SATISFYING VOLUME LEVEL:")
            // console.log(res);
            ac.close().then(function() {
              mediaRecorder.stop();
              mediaRecorder.addEventListener('stop', function() {
                downloadLink.href = URL.createObjectURL(new Blob(recordedChunks));
                downloadLink.download = 'chant.wav';
                downloadLink.classList.toggle("hidden"); 
                source.disconnect(0);
                clearInterval(x); 
              });
            });
          }
        }
       }, 1000,ac);
    }
  };

  initRenderLoop() {
    const frequencyData = new Float32Array(this.analyser.getFloatTimeDomainData);
    const processFrame = this.processFrame || (() => {});
    const renderFrame = () => {
      this.analyser.getFloatTimeDomainData(frequencyData);
      processFrame(frequencyData);
      requestAnimationFrame(renderFrame);
    };
    requestAnimationFrame(renderFrame);
  }
}

function createAudioMeter(audioContext, clipLevel, averaging, clipLag) {
  const processor = audioContext.createScriptProcessor(256);
  processor.onaudioprocess = function (event) {
    const channelData = new Float32Array(Math.round(event.inputBuffer.sampleRate * 1));
    const buf = event.inputBuffer.getChannelData(0);
    let sum = 0;
    let x;
    for (var i = 0; i < buf.length; i++) {
      x = buf[i];
      if (Math.abs(x) >= this.clipLevel) {
          this.clipping = true;
          this.lastClip = window.performance.now();
      }
      sum += x * x;
    }
    const rms = Math.sqrt(sum / buf.length);
    this.volume = Math.max(rms, this.volume * this.averaging);
    //document.getElementById('audio-value').innerHTML = this.volume;
  };
  processor.clipping = false;
  processor.lastClip = 0;
  processor.volume = 0;
  processor.clipLevel = clipLevel || 0.98;
  processor.averaging = averaging || 0.95;
  processor.clipLag = clipLag || 750;
  processor.connect(audioContext.destination);

  processor.checkClipping = function () {
    if (!this.clipping) {
      return false
    }
    if ((this.lastClip + this.clipLag) < window.performance.now()) {
      this.clipping = false;
    }
    return this.clipping
  }

  processor.shutdown = function () {
    this.disconnect();
    this.onaudioprocess = null;
  }

  return processor
}



function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  /** * Your drawings need to be inside this function otherwise they will be reset when you resize the browser window and the canvas goes will be cleared. */
  drawStuff(); 
}
resizeCanvas();

function drawStuff() {
        // do your drawing stuff here
}
const init = () => {
  const audioContext = new AudioContext();

  const processFrame = (data) => {
    ctx.clearRect(0, 0, width,height);
    const values = Object.values(data);
    prevLevels.push(values/10);
    prevLevels.splice(0, 1);
    for (var i = 0; i < prevLevels.length; i++) {
        var x = mapRange(i, prevLevels.length, 0, width, 0);
        var h = mapRange(prevLevels[i], 0, 0.5, minHeight, height);
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'pink';
        ctx.stroke();
        ctx.fillStyle = HSVtoRGB(mapRange(h, minHeight, height, 0.5, 1),1,0.9,mapRange(i, 0, prevLevels.length, 1, 250));
        ctx.fillRect(x, height/2, w,h);
    }
  };

  const processError = () => {
    visualMainElement.classList.add("error");
    visualMainElement.innerText =
      "Please allow access to your microphone in order to see this demo.\nNothing bad is going to happen... hopefully :P";
  };

  const a = new AudioVisualizer(audioContext, processFrame, processError);
};

function mapRange (value, a, b, c, d) {
    value = (value - a) / (b - a);
    return c + value * (d - c);
}

function HSVtoRGB(h, s, v, a) {
    var r, g, b, i, f, p, q, t;
    if (arguments.length === 1) {
        s = h.s, v = h.v, h = h.h;
    }
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    return "rgba("+Math.round(r * 255)+","+Math.round(g * 255)+","+Math.round(b * 255)+","+a+")";
}

// return an array of amplitudes for the supplied `audioBuffer` (each item in the array will represent the average amplitude (in dB) for a chunk of audio `t` seconds long)
function slice(audioContext, audioBuffer, t ) {
  var channels = audioBuffer.numberOfChannels,
    sampleRate = audioContext.sampleRate,
    //len = audioBuffer.length,
    len = 1000,
    samples = sampleRate * t,
    output = [],
    amplitude,
    values,
    i = 0,
    j, k;
  // loop by chunks of `t` seconds
  for ( ; i < len; i += samples ) {
    values = [];
    // loop through each sample in the chunk
    for ( j = 0; j < samples && j + i < len; ++j ) {
      amplitude = 0;
      // sum the samples across all channels
      for ( k = 0; k < channels; ++k ) {
        amplitude += audioBuffer.getChannelData(k)[i + j];
      }
      values.push(amplitude);
    }
    output.push(dB(values));
  }
  return output;
}

// calculate the average amplitude (in dB) for an array of samples
function dB( buffer ) {
  var len = buffer.length,
    total = 0,
    i = 0,
    rms,
    db;
  while ( i < len ) {
    total += ( buffer[i] * buffer[i++] );
  }
  rms = Math.sqrt( total / len );
  db = 20 * ( Math.log(rms) / Math.LN10 );
  return db;
}







// const visualMainElement = document.querySelector("main");
// const visualValueCount = 16;
  // const initDOM = () => {
  //   visualMainElement.innerHTML = "";
  //   createDOMElements();
  // };
  // initDOM();
// let visualElements;
// const createDOMElements = () => {
//   let i;
//   for (i = 0; i < visualValueCount; ++i) {
//     const elm = document.createElement("div");
//     visualMainElement.appendChild(elm);
//   }

//   visualElements = document.querySelectorAll("main div");
// };
// createDOMElements();


  //var secs = 0;
  //let secsEl = document.createElement('div');
  //body.appendChild(secsEl);
  //const secsCanc = setInterval(function(){secs += 1;secsEl.innerText = "You have been here for " + secs + " seconds.";}, 1000);