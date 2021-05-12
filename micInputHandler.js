const [main, canvas, downloadLink, downloadButton, continueButton] = [
  document.querySelector("main"),
  document.createElement("canvas"),
  document.getElementById("download-recording"),
  document.querySelector("#download-recording button"),
  document.getElementById("continue-to-content"),
];
document.querySelector("body").appendChild(canvas);
const [
  ctx,
  previousLevels,
  secondsRunner,
  secondsThreshold,
  volumeThreshold,
  minHeight,
] = [canvas.getContext("2d"), new Array(230), new Array(), 1, 0.01, 1.5];
let [satisfyingDurationMet, shouldStop, stopped] = [false, false, false];

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
    if (ac && ac.state === "running") {
      const [mediaRecorder, source, recordedChunks, meter] = [
        new MediaRecorder(stream, { mimeType: "audio/webm" }),
        ac.createMediaStreamSource(stream),
        [],
        createAudioMeter(ac),
      ];
      mediaRecorder.start();
      mediaRecorder.addEventListener("dataavailable", function (e) {
        e.data.size > 0 && recordedChunks.push(e.data);
      });
      source.connect(meter);
      this.analyser = ac.createAnalyser();
      this.analyser.smoothingTimeConstant = 0;
      this.analyser.fftSize = 32;
      this.initRenderLoop(this.analyser, ac);
      source.connect(this.analyser);
      const recordingOfSatisfyingDuration = setInterval(
        function () {
          secondsRunner.push({
            currentVolume: meter.volume,
            currentTime: meter.context.currentTime,
          });
          const satisfiedRunner = consecutiveSecondsMeetingVolumeThreshold(
            secondsRunner,
            secondsThreshold,
            satisfyingDurationMet
          );
          if (satisfiedRunner) {
            satisfyingDurationMet = true;
            const [beginning, ending, duration] = [
              satisfiedRunner[0]["currentTime"] - 1,
              satisfiedRunner[satisfiedRunner.length - 1]["currentTime"],
              satisfiedRunner.length + 1,
            ];
            if (
              satisfiedRunner[satisfiedRunner.length - 1][
                "satisfyingDurationMet"
              ] === false
            ) {
              console.log(
                "Great! You chanted approx. for " +
                  duration +
                  " consecutive seconds; your chant should be somewhere between " +
                  beginning +
                  " and " +
                  ending
              );
              ac.close().then(function () {
                mediaRecorder.stop();
                mediaRecorder.addEventListener("stop", function () {
                  downloadLink.href = URL.createObjectURL(
                    new Blob(recordedChunks)
                  );
                  downloadLink.download = "chant.wav";
                  source.disconnect(0);
                  document
                    .querySelector("#recording-message span")
                    .classList.toggle("start-from-end");
                  setTimeout(function () {
                    document
                      .querySelector("main")
                      .classList.toggle("background-move-5");
                    canvas.classList.toggle("fast-end");
                    [downloadButton, continueButton].map((e) => {
                      e.classList.toggle("start-from-end");
                    });
                  }, 2000);
                  setTimeout(function () {
                    [canvas, downloadButton, continueButton].map((e) => {
                      e.classList.toggle("hidden");
                    });
                  }, 4000);
                  clearInterval(recordingOfSatisfyingDuration);
                });
              });
            }
          }
        },
        1000,
        ac
      );
    } else if (ac && ac.state === "suspended") {
      console.log("User perhaps didn't yet click anything.");
    }
  }

  initRenderLoop() {
    const frequencyData = new Float32Array(
      this.analyser.getFloatTimeDomainData
    );
    const processFrame = this.processFrame || (() => {});
    const renderFrame = () => {
      this.analyser.getFloatTimeDomainData(frequencyData);
      processFrame(frequencyData);
      requestAnimationFrame(renderFrame);
    };
    requestAnimationFrame(renderFrame);
  }
}

function consecutiveSecondsMeetingVolumeThreshold(
  secondsRunner,
  secondsThreshold,
  satisfyingDurationMet
) {
  let [
    checkMeetingOfSatisfyingDuration,
    extraSatisfyingSeconds,
    numberOfConsecutiveSeconds,
  ] = [false, 0, 0];
  if (satisfyingDurationMet) {
    for (let i = 0; i < secondsRunner.length; i++) {
      secondsRunner[i]["satisfyingDurationMet"] =
        secondsRunner[i]["currentVolume"] >= volumeThreshold ? true : false;
      numberOfConsecutiveSeconds =
        secondsRunner[i]["currentVolume"] >= volumeThreshold
          ? numberOfConsecutiveSeconds + 1
          : 0;
      if (
        (numberOfConsecutiveSeconds === 0) &
        (checkMeetingOfSatisfyingDuration === true)
      )
        return secondsRunner.slice(
          i - extraSatisfyingSeconds - secondsThreshold + 1,
          i + 1
        );
      if (numberOfConsecutiveSeconds >= secondsThreshold) {
        (checkMeetingOfSatisfyingDuration = true), extraSatisfyingSeconds++;
      }
      if (i === secondsRunner.length - 1)
        return secondsRunner.slice(
          i - extraSatisfyingSeconds - secondsThreshold + 2,
          i + 1
        );
    }
  } else {
    for (let i = 0; i < secondsRunner.length; i++) {
      numberOfConsecutiveSeconds =
        secondsRunner[i]["currentVolume"] >= volumeThreshold
          ? numberOfConsecutiveSeconds + 1
          : 0;
      if (numberOfConsecutiveSeconds === secondsThreshold)
        return secondsRunner.slice(i - secondsThreshold + 1, i + 1);
    }
    return false;
  }
}

function createAudioMeter(audioContext, clipLevel, averaging, clipLag) {
  const processor = audioContext.createScriptProcessor(256);
  [
    processor.clipping,
    processor.lastClip,
    processor.volume,
    processor.clipLevel,
    processor.averaging,
    processor.clipLag,
  ] = [false, 0, 0, clipLevel || 0.98, averaging || 0.95, clipLag || 750];

  processor.onaudioprocess = function (event) {
    const channelData = new Float32Array(
      Math.round(event.inputBuffer.sampleRate * 1)
    );
    const buf = event.inputBuffer.getChannelData(0);
    let [sum, x] = [0, 0];
    for (let i = 0; i < buf.length; i++) {
      x = buf[i];
      if (Math.abs(x) >= this.clipLevel) {
        this.clipping = true;
        this.lastClip = window.performance.now();
      }
      sum += x * x;
    }
    this.volume = Math.max(
      Math.sqrt(sum / buf.length),
      this.volume * this.averaging
    );
  };

  processor.checkClipping = function () {
    !this.clipping && false;
    this.clipping =
      this.lastClip + this.clipLag < window.performance.now() && false;
    return this.clipping;
  };

  processor.shutdown = function () {
    this.disconnect();
    this.onaudioprocess = null;
  };

  processor.connect(audioContext.destination);
  return processor;
}

function mapRange(value, a, b, c, d) {
  return c + ((value - a) / (b - a)) * (d - c);
}

function HSVtoRGB(h, s, v, a) {
  arguments.length === 1 && ((s = h.s), (v = h.v), (h = h.h));
  let [r, g, b] = [0, 0, 0];
  const [i, p] = [Math.floor(h * 6), v * (1 - s)];
  const f = h * 6 - i;
  const [q, t] = [v * (1 - f * s), v * (1 - (1 - f) * s)];
  switch (i % 6) {
    case 0:
      (r = v), (g = t), (b = p);
      break;
    case 1:
      (r = q), (g = v), (b = p);
      break;
    case 2:
      (r = p), (g = v), (b = t);
      break;
    case 3:
      (r = p), (g = q), (b = v);
      break;
    case 4:
      (r = t), (g = p), (b = v);
      break;
    case 5:
      (r = v), (g = p), (b = q);
      break;
  }
  return (
    "rgba(" +
    Math.round(r * 255) +
    "," +
    Math.round(g * 255) +
    "," +
    Math.round(b * 255) +
    "," +
    a +
    ")"
  );
}

function handleMicrophoneInput() {
  const audioContext = new AudioContext();
  window.addEventListener("resize", resizeCanvas, false);
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight * 0.7;
  }
  const processFrame = (data) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    previousLevels.push(Object.values(data));
    previousLevels.splice(0, 1);
    for (let i = 0; i < previousLevels.length; i++) {
      let [w, x, h] = [
        (canvas.width / previousLevels.length) * 1.5,
        mapRange(i, previousLevels.length, 0, canvas.width, 0),
        mapRange(previousLevels[i], 0, 0.5, minHeight, canvas.height),
      ];
      ctx.fillStyle = HSVtoRGB(
        mapRange(h, minHeight, canvas.height, 0.75, 1),
        1,
        0.9,
        mapRange(i, 0, previousLevels.length, 1, 250)
      );
      ctx.fillRect(x, canvas.height / 2, w, h);
    }
  };
  const processError = () => {
    console.log("Please allow access to your microphone.");
  };
  resizeCanvas();
  const a = new AudioVisualizer(audioContext, processFrame, processError);
  setTimeout(function () {
    document.querySelector("#recording-message span").innerHTML =
      "Thanks! You can download the recording and continue to the content (not yet ready).";
  }, 2000);
}
