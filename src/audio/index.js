const AudioCapture = require('./capture');
const AudioOutput = require('./output');
const VirtualAudioDevice = require('./virtual-device');
const AudioProcessor = require('./processor');
const AudioDeviceManager = require('./device-manager');

module.exports = {
  AudioCapture,
  AudioOutput,
  VirtualAudioDevice,
  AudioProcessor,
  AudioDeviceManager,
};
