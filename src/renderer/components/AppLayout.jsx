const React = require('react');
const { useState } = require('react');
const { useNavigate, useLocation } = require('react-router-dom');
const { Button, Modal, Space } = require('antd');
const {
  AudioOutlined,
  SettingOutlined,
  DashboardOutlined,
  QuestionCircleOutlined,
  InfoCircleOutlined,
} = require('@ant-design/icons');

const AppLayout = ({ children }) => {
  const [aboutModalVisible, setAboutModalVisible] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const showAboutModal = () => {
    setAboutModalVisible(true);
  };

  const handleAboutModalCancel = () => {
    setAboutModalVisible(false);
  };

  const isActiveRoute = (path) => {
    return location.pathname === path;
  };

  const getActiveButtonStyle = (isActive) => ({
    background: isActive ? '#bfa6c9' : 'transparent',
    color: isActive ? '#222222' : '#f5f5f5',
    border: isActive ? 'none' : '1px solid #333',
  });

  return (
    <div className="app-layout">
      {/* Header */}
      <div className="header">
        <div className="header-left">
          <img src="assets/icons/echo/echo-logo.png" alt="echo" className="header-logo" />
          <div className="header-title">
            echo
            <span className="by">by WhyteHoux.ai</span>
          </div>
        </div>

        {/* Navigation */}
        <div className="header-nav">
          <Space size="small">
            <Button
              type="text"
              icon={<DashboardOutlined />}
              onClick={() => navigate('/dashboard')}
              style={getActiveButtonStyle(isActiveRoute('/dashboard') || isActiveRoute('/'))}
              className="nav-button"
            >
              Dashboard
            </Button>
            <Button
              type="text"
              icon={<AudioOutlined />}
              onClick={() => navigate('/audio-test')}
              style={getActiveButtonStyle(isActiveRoute('/audio-test'))}
              className="nav-button"
            >
              Audio Test
            </Button>
            <Button
              type="text"
              icon={<SettingOutlined />}
              onClick={() => navigate('/settings')}
              style={getActiveButtonStyle(isActiveRoute('/settings'))}
              className="nav-button"
            >
              Settings
            </Button>
          </Space>
        </div>

        {/* Header Right */}
        <div className="header-right">
          <Space size="small">
            <Button
              type="text"
              icon={<QuestionCircleOutlined />}
              onClick={() => navigate('/welcome')}
              className="header-button"
            />
            <Button
              type="text"
              icon={<InfoCircleOutlined />}
              onClick={showAboutModal}
              className="header-button"
            />
            <div id="window-controls">
              <button className="window-control" id="minimize-btn">
                ─
              </button>
              <button className="window-control" id="maximize-btn">
                □
              </button>
              <button className="window-control close" id="close-btn">
                ×
              </button>
            </div>
          </Space>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-panel">{children}</div>

      {/* About Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img
              src="assets/icons/echo/echo-logo.png"
              alt="echo"
              style={{ height: '32px', width: '32px' }}
            />
            <span>About echo</span>
          </div>
        }
        open={aboutModalVisible}
        onCancel={handleAboutModalCancel}
        footer={[
          <Button key="close" onClick={handleAboutModalCancel}>
            Close
          </Button>,
        ]}
        width={500}
        className="about-modal"
      >
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <h2 style={{ color: '#bfa6c9', marginBottom: '16px' }}>echo</h2>
          <p style={{ color: '#b7b7b7', marginBottom: '16px' }}>
            Your AI-powered real-time translation companion
          </p>
          <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>Version 1.0.0</p>
          <div
            style={{
              background: '#292929',
              padding: '16px',
              borderRadius: '8px',
              textAlign: 'left',
            }}
          >
            <h4 style={{ color: '#f5f5f5', marginBottom: '12px' }}>Features:</h4>
            <ul style={{ color: '#b7b7b7', margin: 0, paddingLeft: '20px' }}>
              <li>Real-time voice translation</li>
              <li>AI-powered accuracy</li>
              <li>100+ supported languages</li>
              <li>Cross-platform compatibility</li>
              <li>Advanced audio processing</li>
            </ul>
          </div>
          <p
            style={{
              color: '#666',
              fontSize: '12px',
              marginTop: '24px',
              fontStyle: 'italic',
            }}
          >
            Built with ❤️ by WhyteHoux.ai
          </p>
        </div>
      </Modal>
    </div>
  );
};

module.exports = AppLayout;
