(function e(t, n, r) {
  function s(o, u) {
    if (!n[o]) {
      if (!t[o]) {
        var a = typeof require == "function" && require;
        if (!u && a) return a(o, !0);
        if (i) return i(o, !0);
        var f = new Error("Cannot find module '" + o + "'");
        throw ((f.code = "MODULE_NOT_FOUND"), f);
      }
      var l = (n[o] = { exports: {} });
      t[o][0].call(
        l.exports,
        function (e) {
          var n = t[o][1][e];
          return s(n ? n : e);
        },
        l,
        l.exports,
        e,
        t,
        n,
        r
      );
    }
    return n[o].exports;
  }
  var i = typeof require == "function" && require;
  for (var o = 0; o < r.length; o++) s(r[o]);
  return s;
})(
  {
    1: [
      function (require, module, exports) {
        (function (global) {
          "use strict";

          if (
            global.AnalyserNode &&
            !global.AnalyserNode.prototype.getFloatTimeDomainData
          ) {
            var uint8 = new Uint8Array(2048);
            global.AnalyserNode.prototype.getFloatTimeDomainData = function (
              array
            ) {
              this.getByteTimeDomainData(uint8);
              for (var i = 0, imax = array.length; i < imax; i++) {
                array[i] = (uint8[i] - 128) * 0.0078125;
              }
            };
          }
        }.call(
          this,
          typeof global !== "undefined"
            ? global
            : typeof self !== "undefined"
            ? self
            : typeof window !== "undefined"
            ? window
            : {}
        ));
      },
      {},
    ],
  },
  {},
  [1]
);

function clearWindow(skipped, canvasSnap) {
  if (skipped) {
    document.querySelectorAll("#recording-message span").forEach((e) => {
      e.classList.toggle("start-from-end");
    });
    setTimeout(function () {
      document.getElementById("recording").classList.toggle("hidden");
      document.querySelector("main").classList.toggle("background-move-5");
      canvas.classList.toggle("fast-end");
      if (canvasSnap) {
        goToContent(skipped, canvasSnap);
        document.getElementById("myWave").src = canvasSnap;
      } else {
        goToContent(skipped, null);
      }
    }, 2000);
    setTimeout(function () {
      canvas.classList.toggle("hidden");
    }, 4000);
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
    const pc = this.processFrame;
    if (ac.state === "running") {
      ac.suspend();
    }
    ac.resume();
    ac.onstatechange = () => {
      function initRenderLoop(analyser) {
        const frequencyData = new Float32Array(analyser.getFloatTimeDomainData);
        const processFrame = pc || (() => {});
        const renderFrame = () => {
          analyser.getFloatTimeDomainData(frequencyData);
          processFrame(frequencyData);
          requestAnimationFrame(renderFrame);
        };
        requestAnimationFrame(renderFrame);
      }
      if (ac.state === "running") {
        const [source, meter] = [
          ac.createMediaStreamSource(stream),
          createAudioMeter(ac),
        ];
        source.connect(meter);
        this.analyser = ac.createAnalyser();
        this.analyser.smoothingTimeConstant = 0;
        this.analyser.fftSize = 32;
        initRenderLoop(this.analyser, ac);
        source.connect(this.analyser);
        const stopRecording = setInterval(function () {
          stream.getTracks().forEach((track) => track.stop());
          source.disconnect(0);
          clearWindow("no");
          clearInterval(recordingOfSatisfyingDuration);
          clearInterval(stopRecording);
          if (ac.state !== "closed") {
            ac.close();
          }
        }, maxSecondsThreshold * 1000);

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

              if (
                satisfiedRunner[satisfiedRunner.length - 1][
                  "satisfyingDurationMet"
                ] === false
              ) {
                stream.getTracks().forEach((track) => track.stop());
                source.disconnect(0);
                clearWindow("no", canvas.toDataURL("image/png"));
                clearInterval(recordingOfSatisfyingDuration);
                clearInterval(stopRecording);
                if (ac.state !== "closed") {
                  ac.close();
                }
              }
            }
          },
          1000,
          ac
        );
      }
    };
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
  const audioContext = new (window["AudioContext"] ||
    window["webkitAudioContext"])();
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
    clearWindow("yes");
  };
  resizeCanvas();
  const a = new AudioVisualizer(audioContext, processFrame, processError);
}
