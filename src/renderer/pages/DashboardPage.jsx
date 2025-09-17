const React = require('react');
const { useState, useEffect } = require('react');
const { Card, Row, Col, Statistic, Progress, Button, Tooltip, Modal } = require('antd');
const {
  AudioOutlined,
  TranslationOutlined,
  ClockCircleOutlined,
  TrophyOutlined,
  SettingOutlined,
  GlobalOutlined,
} = require('@ant-design/icons');

const TranslationPanel = require('../components/TranslationPanel').default;
const LanguageSelector = require('../components/LanguageSelector').default;
const TranslationManager = require('../../services/translation/translation-manager');

const DashboardPage = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState([]);
  const [stats, setStats] = useState({
    totalTranslations: 0,
    accuracy: 95,
    languagesUsed: 3,
    timeSpent: 45,
  });
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('es');
  const [translationManager, setTranslationManager] = useState(null);

  // Initialize translation manager
  useEffect(() => {
    const initTranslationManager = async () => {
      try {
        const manager = new TranslationManager();
        await manager.initialize();
        setTranslationManager(manager);
      } catch (error) {
        console.error('Failed to initialize translation manager:', error);
      }
    };
    initTranslationManager();

    return () => {
      if (translationManager) {
        translationManager.destroy();
      }
    };
  }, []);

  const handleStartRecording = () => {
    setIsRecording(true);
    // Integrate with STT service via IPC
    window.electron.ipcRenderer.send('start-recording');
    console.log('Recording started - STT service integration active');
  };

  const handleStopRecording = () => {
    setIsRecording(false);
  };

  const handleSendMessage = async (text) => {
    const newMessage = {
      text,
      type: 'original',
      timestamp: new Date(),
      confidence: 0.98,
    };
    setMessages((prev) => [...prev, newMessage]);

    // Perform actual translation
    if (translationManager) {
      try {
        const result = await translationManager.translate(text, sourceLanguage, targetLanguage);

        if (result.success) {
          const translationMessage = {
            text: result.translation,
            type: 'translation',
            timestamp: new Date(),
            confidence: result.confidence || 0.9,
            service: result.service,
          };
          setMessages((prev) => [...prev, translationMessage]);

          // Update stats
          setStats((prev) => ({
            ...prev,
            totalTranslations: prev.totalTranslations + 1,
          }));
        } else {
          console.error('Translation failed:', result.error);
          // Add error message
          const errorMessage = {
            text: 'Translation failed. Please try again.',
            type: 'error',
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMessage]);
        }
      } catch (error) {
        console.error('Translation error:', error);
      }
    }
  };

  const handleLanguageChange = () => {
    setLanguageModalVisible(true);
  };

  const handleLanguageModalOk = () => {
    setLanguageModalVisible(false);
    // Update stats to reflect language change
    setStats((prev) => ({
      ...prev,
      languagesUsed: prev.languagesUsed + 1,
    }));
  };

  const handleLanguageModalCancel = () => {
    setLanguageModalVisible(false);
  };

  return (
    <div className="dashboard-page">
      <Row gutter={[24, 24]} style={{ height: '100%' }}>
        {/* Left Panel - Stats and Controls */}
        <Col xs={24} lg={8}>
          <div className="stats-panel">
            <Card className="stats-card" title="Session Statistics">
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Statistic
                    title="Translations"
                    value={stats.totalTranslations}
                    prefix={<TranslationOutlined />}
                    valueStyle={{ color: '#bfa6c9' }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Accuracy"
                    value={stats.accuracy}
                    suffix="%"
                    prefix={<TrophyOutlined />}
                    valueStyle={{ color: '#b7cbb0' }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Session Time"
                    value={stats.sessionTime}
                    suffix="min"
                    prefix={<ClockCircleOutlined />}
                    valueStyle={{ color: '#bfa6c9' }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Languages"
                    value={stats.languagesUsed}
                    prefix={<AudioOutlined />}
                    valueStyle={{ color: '#b7cbb0' }}
                  />
                </Col>
              </Row>

              <div className="accuracy-progress">
                <div className="progress-label">
                  <span>Overall Accuracy</span>
                  <span>92%</span>
                </div>
                <Progress percent={92} strokeColor="#bfa6c9" trailColor="#333" showInfo={false} />
              </div>
            </Card>

            <Card className="quick-actions-card" title="Quick Actions">
              <div className="quick-actions">
                <Button
                  type="primary"
                  icon={<AudioOutlined />}
                  block
                  size="large"
                  className="action-button"
                >
                  Start New Session
                </Button>
                <Button
                  icon={<TranslationOutlined />}
                  block
                  size="large"
                  className="action-button secondary"
                >
                  View History
                </Button>
                <Button
                  icon={<SettingOutlined />}
                  block
                  size="large"
                  className="action-button secondary"
                >
                  Settings
                </Button>
              </div>
            </Card>
          </div>
        </Col>

        {/* Right Panel - Translation Interface */}
        <Col xs={24} lg={16}>
          <div className="translation-interface">
            <TranslationPanel
              isRecording={isRecording}
              onStartRecording={handleStartRecording}
              onStopRecording={handleStopRecording}
              onSendMessage={handleSendMessage}
              messages={messages}
              sourceLanguage={sourceLanguage}
              targetLanguage={targetLanguage}
              onLanguageChange={handleLanguageChange}
            />
          </div>
        </Col>
      </Row>

      {/* Language Selection Modal */}
      <Modal
        title="Select Languages"
        open={languageModalVisible}
        onOk={handleLanguageModalOk}
        onCancel={handleLanguageModalCancel}
        width={600}
        okText="Apply"
        cancelText="Cancel"
      >
        <div style={{ padding: '20px 0' }}>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <div style={{ marginBottom: '8px' }}>
                <strong>Source Language (From):</strong>
              </div>
              <LanguageSelector
                type="source"
                value={sourceLanguage}
                onChange={setSourceLanguage}
                className="language-selector-modal"
              />
            </Col>
            <Col span={12}>
              <div style={{ marginBottom: '8px' }}>
                <strong>Target Language (To):</strong>
              </div>
              <LanguageSelector
                type="target"
                value={targetLanguage}
                onChange={setTargetLanguage}
                excludeLanguages={[sourceLanguage]}
                className="language-selector-modal"
              />
            </Col>
          </Row>
        </div>
      </Modal>
    </div>
  );
};

module.exports = DashboardPage;
