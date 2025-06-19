// Mock for audio-devices module
const audioDevices = {
  getDevices: jest.fn().mockResolvedValue([
    {
      name: 'Built-in Microphone',
      id: 'default',
      type: 'input',
      sampleRate: 44100,
      channels: 2,
      isDefault: true
    },
    {
      name: 'Built-in Output',
      id: 'default',
      type: 'output',
      sampleRate: 44100,
      channels: 2,
      isDefault: true
    }
  ]),
  getDefaultInputDevice: jest.fn().mockResolvedValue({
    name: 'Built-in Microphone',
    id: 'default',
    type: 'input',
    isDefault: true
  }),
  getDefaultOutputDevice: jest.fn().mockResolvedValue({
    name: 'Built-in Output',
    id: 'default',
    type: 'output',
    isDefault: true
  })
};

module.exports = audioDevices;
