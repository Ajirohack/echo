// Mock implementation of useTranslation hook
const useTranslation = () => ({
  t: (key) => ({
    'startRecording': 'Start Recording',
    'stopRecording': 'Stop Recording',
    'recording': 'Recording',
    'permissionDenied': 'Microphone access denied',
    'elapsedTime': 'Elapsed Time: {time}'
  }[key] || key),
});

export default useTranslation;
