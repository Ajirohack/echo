const { ipcRenderer } = require('electron');
const React = require('react');
const ReactDOM = require('react-dom');
const { ConfigProvider } = require('antd');
const { BrowserRouter, Route, Routes } = require('react-router-dom');
const { RecoilRoot } = require('recoil');
const { AudioOutlined } = require('@ant-design/icons');

// Import components
const AudioTestPage = require('./pages/AudioTestPage').default;
const AppLayout = require('./components/AppLayout').default;

// Import styles
require('./styles/global.less');

// Main App Component
const App = () => (
  <RecoilRoot>
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 4,
          colorBgContainer: '#ffffff',
        },
      }}
    >
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<AudioTestPage />} />
            <Route path="/audio-test" element={<AudioTestPage />} />
            {/* Add more routes as needed */}
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </ConfigProvider>
  </RecoilRoot>
);

// Render the app
ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);

// Handle window controls
window.addEventListener('DOMContentLoaded', () => {
  // Handle minimize
  const minimizeBtn = document.getElementById('minimize-btn');
  if (minimizeBtn) {
    minimizeBtn.addEventListener('click', () => {
      ipcRenderer.send('window-minimize');
    });
  }

  // Handle maximize/restore
  const maxResBtn = document.getElementById('maximize-btn');
  if (maxResBtn) {
    maxResBtn.addEventListener('click', () => {
      ipcRenderer.send('window-maximize');
    });
  }

  // Handle close
  const closeBtn = document.getElementById('close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      ipcRenderer.send('window-close');
    });
  }
});

// Handle window maximize/restore state
ipcRenderer.on('window-state-changed', (event, isMaximized) => {
  const maxResBtn = document.getElementById('maximize-btn');
  if (maxResBtn) {
    maxResBtn.innerHTML = isMaximized ? '⧉' : '□';
  }
});

// Initialize audio service
const initializeApp = async () => {
  try {
    const audioService = require('./services/audioService');
    await audioService.initialize();
    console.log('Audio service initialized');
  } catch (error) {
    console.error('Failed to initialize audio service:', error);
  }
};

// Initialize the app
initializeApp();
