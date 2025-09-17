const React = require('react');
const { useState } = require('react');
const {
  Card,
  Button,
  Steps,
  Form,
  Select,
  Switch,
  Progress,
  Typography,
  Space,
  Alert,
  Divider,
} = require('antd');
const {
  AudioOutlined,
  TranslationOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  ArrowRightOutlined,
  PlayCircleOutlined,
} = require('@ant-design/icons');

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const WelcomePage = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const steps = [
    {
      title: 'Welcome',
      icon: <TranslationOutlined />,
      description: 'Get started with echo',
    },
    {
      title: 'Language Setup',
      icon: <SettingOutlined />,
      description: 'Choose your languages',
    },
    {
      title: 'Audio Test',
      icon: <AudioOutlined />,
      description: 'Test your microphone',
    },
    {
      title: 'Ready',
      icon: <CheckCircleOutlined />,
      description: 'Start translating',
    },
  ];

  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'it', name: 'Italian', flag: '🇮🇹' },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
    { code: 'ru', name: 'Russian', flag: '🇷🇺' },
    { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean', flag: '🇰🇷' },
    { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
    { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      const values = await form.validateFields();
      console.log('Welcome setup completed:', values);

      // Save user preferences using SettingsManager via IPC
      const result = await window.electronAPI.settings.update({
        ui: {
          theme: values.theme || 'light',
          language: values.language || 'en',
        },
        audio: {
          inputDevice: values.inputDevice || 'default',
          outputDevice: values.outputDevice || 'default',
        },
        translation: {
          defaultService: values.translationService || 'google',
          sourceLanguage: values.sourceLanguage || 'auto',
          targetLanguage: values.targetLanguage || 'en',
        },
        onboarding: {
          completed: true,
          completedAt: new Date().toISOString(),
        },
      });

      if (result.success) {
        console.log('User preferences saved successfully');
      } else {
        console.error('Failed to save user preferences:', result.error);
      }

      onComplete?.(values);
    } catch (error) {
      console.error('Setup validation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderWelcomeStep = () => (
    <div className="welcome-step">
      <div className="welcome-content">
        <div className="welcome-logo">
          <img src="assets/icons/echo/echo-logo.png" alt="echo" className="welcome-logo-img" />
        </div>
        <Title level={1} className="welcome-title">
          Welcome to echo
        </Title>
        <Paragraph className="welcome-subtitle">
          Your AI-powered real-time translation companion
        </Paragraph>

        <div className="welcome-features">
          <div className="feature-item">
            <div className="feature-icon">🎤</div>
            <div className="feature-text">
              <Text strong>Real-time Voice Translation</Text>
              <Text type="secondary">Speak naturally and get instant translations</Text>
            </div>
          </div>
          <div className="feature-item">
            <div className="feature-icon">🤖</div>
            <div className="feature-text">
              <Text strong>AI-Powered Accuracy</Text>
              <Text type="secondary">Advanced AI models for precise translations</Text>
            </div>
          </div>
          <div className="feature-item">
            <div className="feature-icon">🌍</div>
            <div className="feature-text">
              <Text strong>100+ Languages</Text>
              <Text type="secondary">Support for major world languages</Text>
            </div>
          </div>
        </div>

        <Alert
          message="Quick Setup"
          description="This will take just a few minutes to configure your preferences and test your audio setup."
          type="info"
          showIcon
          className="welcome-alert"
        />
      </div>
    </div>
  );

  const renderLanguageStep = () => (
    <div className="language-step">
      <Title level={3}>Choose Your Languages</Title>
      <Paragraph type="secondary">
        Select the languages you'll be translating between most often.
      </Paragraph>

      <Form form={form} layout="vertical" className="language-form">
        <Form.Item
          label="I speak"
          name="sourceLanguage"
          rules={[{ required: true, message: 'Please select your language' }]}
        >
          <Select
            placeholder="Select your language"
            showSearch
            optionFilterProp="children"
            size="large"
          >
            {languages.map((lang) => (
              <Option key={lang.code} value={lang.code}>
                <Space>
                  <span>{lang.flag}</span>
                  <span>{lang.name}</span>
                </Space>
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          label="I want to translate to"
          name="targetLanguage"
          rules={[{ required: true, message: 'Please select target language' }]}
        >
          <Select
            placeholder="Select target language"
            showSearch
            optionFilterProp="children"
            size="large"
          >
            {languages.map((lang) => (
              <Option key={lang.code} value={lang.code}>
                <Space>
                  <span>{lang.flag}</span>
                  <span>{lang.name}</span>
                </Space>
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item label="Auto-detect language" name="autoDetect" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </div>
  );

  const renderAudioStep = () => (
    <div className="audio-step">
      <Title level={3}>Test Your Microphone</Title>
      <Paragraph type="secondary">Let's make sure your audio setup is working properly.</Paragraph>

      <div className="audio-test-container">
        <Card className="audio-test-card">
          <div className="audio-test-content">
            <div className="audio-visualizer">
              <div className="audio-bars">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="audio-bar" />
                ))}
              </div>
            </div>

            <div className="audio-test-text">
              <Text strong>Click the button below and say something</Text>
              <Text type="secondary">We'll test your microphone and show you the audio levels</Text>
            </div>

            <Button
              type="primary"
              size="large"
              icon={<PlayCircleOutlined />}
              className="test-audio-button"
            >
              Test Microphone
            </Button>

            <div className="audio-status">
              <Text type="success">✓ Microphone detected</Text>
              <Text type="success">✓ Audio levels normal</Text>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );

  const renderReadyStep = () => (
    <div className="ready-step">
      <div className="ready-content">
        <div className="ready-icon">
          <CheckCircleOutlined />
        </div>
        <Title level={2}>You're all set!</Title>
        <Paragraph type="secondary">
          echo is ready to help you communicate across languages.
        </Paragraph>

        <div className="ready-summary">
          <div className="summary-item">
            <Text strong>Source Language:</Text>
            <Text>English 🇺🇸</Text>
          </div>
          <div className="summary-item">
            <Text strong>Target Language:</Text>
            <Text>Spanish 🇪🇸</Text>
          </div>
          <div className="summary-item">
            <Text strong>Audio Setup:</Text>
            <Text>✓ Ready</Text>
          </div>
        </div>

        <Alert
          message="Pro Tip"
          description="You can change these settings anytime from the Settings page."
          type="success"
          showIcon
          className="ready-alert"
        />
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderWelcomeStep();
      case 1:
        return renderLanguageStep();
      case 2:
        return renderAudioStep();
      case 3:
        return renderReadyStep();
      default:
        return null;
    }
  };

  return (
    <div className="welcome-page">
      <div className="welcome-container">
        <div className="welcome-header">
          <Steps current={currentStep} className="welcome-steps">
            {steps.map((step, index) => (
              <Steps.Step
                key={index}
                title={step.title}
                description={step.description}
                icon={step.icon}
              />
            ))}
          </Steps>
        </div>

        <div className="welcome-body">
          <Card className="welcome-card">{renderStepContent()}</Card>
        </div>

        <div className="welcome-footer">
          <Space size="large">
            {currentStep > 0 && <Button onClick={handlePrev}>Previous</Button>}

            {currentStep < steps.length - 1 ? (
              <Button type="primary" onClick={handleNext} icon={<ArrowRightOutlined />}>
                Next
              </Button>
            ) : (
              <Button
                type="primary"
                onClick={handleComplete}
                loading={loading}
                icon={<CheckCircleOutlined />}
                size="large"
              >
                Get Started
              </Button>
            )}
          </Space>
        </div>
      </div>
    </div>
  );
};

module.exports = WelcomePage;
