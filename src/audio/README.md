# Audio System for echo

This module provides a cross-platform audio capture, processing, and routing system for the echo application.

## Features

- **Cross-platform support** (Windows, macOS, Linux)
- **Real-time audio capture** from microphone and system audio
- **Virtual audio device** management and auto-installation
- **Audio processing** with format conversion, normalization, and effects
- **Device management** with automatic detection of audio devices
- **Event-based architecture** for real-time updates

## Components

### 1. AudioCapture
Handles audio input from microphones and system audio.

```javascript
const { AudioCapture } = require('./capture');
const capture = new AudioCapture();

// Start capturing from microphone
await capture.startCapture({ source: 'mic' });

// Handle captured audio data
capture.on('data', ({ source, data }) => {
  console.log(`Received ${data.length} bytes from ${source}`);
});

// Stop capturing
await capture.stopCapture();
```

### 2. AudioOutput
Manages audio playback and routing to output devices.

```javascript
const { AudioOutput } = require('./output');
const output = new AudioOutput();

// Play audio data
await output.play(audioBuffer, { 
  deviceId: 'default',
  volume: 80 
});

// Route audio to virtual device
await output.routeToVirtual(audioBuffer, {
  deviceId: 'VB-Audio Virtual Cable',
  volume: 100
});
```

### 3. VirtualAudioDevice
Manages virtual audio devices.

```javascript
const { VirtualAudioDevice } = require('./virtual-device');
const virtualDevice = new VirtualAudioDevice();

// Check if virtual device is installed
const isInstalled = await virtualDevice.checkInstallation();

// Install virtual device if not present
if (!isInstalled) {
  await virtualDevice.install();
}

// Set as default output device
await virtualDevice.setAsDefault();
```

### 4. AudioProcessor
Handles audio format conversion and processing.

```javascript
const { AudioProcessor } = require('./processor');
const processor = new AudioProcessor();

// Convert audio format
const converted = await processor.convertFormat(audioBuffer, {
  sampleRate: 16000,
  channels: 1,
  bitDepth: 16
});

// Normalize audio levels
const normalized = await processor.normalize(audioBuffer, {
  targetLevel: -3
});

// Trim silence
const trimmed = await processor.trimSilence(audioBuffer, {
  silenceThreshold: -50,
  silenceDuration: 0.5
});
```

### 5. AudioDeviceManager
Manages audio devices and provides device information.

```javascript
const { AudioDeviceManager } = require('./device-manager');
const deviceManager = new AudioDeviceManager();

// Initialize and start monitoring
await deviceManager.initialize();

// Get all devices
const { inputs, outputs, virtual } = deviceManager.getDevices();

// Set default device
deviceManager.setDefaultDevice(deviceId, 'output');

// Handle device changes
deviceManager.on('devicesUpdated', (devices) => {
  console.log('Audio devices updated:', devices);
});

// Clean up
deviceManager.destroy();
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. For Windows: Install VB-Cable Virtual Audio Device
3. For macOS: Install BlackHole (will be installed automatically if not present)
4. For Linux: Ensure PulseAudio is installed and configured

## Configuration

Edit `config/audio-config.json` to customize audio settings:

```json
{
  "audio": {
    "sampleRate": 16000,
    "channels": 1,
    "bitDepth": 16,
    "inputDevice": "",
    "outputDevice": "",
    "virtualDevice": ""
  },
  "virtualAudio": {
    "enabled": true,
    "autoInstall": true
  }
}
```

## Platform-Specific Notes

### Windows
- Uses VB-Cable for virtual audio routing
- Requires administrator privileges for device installation
- Supports both MME and WASAPI audio interfaces

### macOS
- Uses BlackHole for virtual audio routing
- May require system extension approval
- Supports Core Audio for high-quality capture

### Linux
- Uses PulseAudio for audio routing
- May require additional permissions for audio capture
- Supports both PulseAudio and ALSA backends

## Error Handling

All components emit 'error' events for error conditions. Always listen for these events:

```javascript
capture.on('error', (error) => {
  console.error('Capture error:', error.message);
});
```

## License

MIT

## See Also

- [FFmpeg](https://ffmpeg.org/)
- [Node.js Streams](https://nodejs.org/api/stream.html)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
