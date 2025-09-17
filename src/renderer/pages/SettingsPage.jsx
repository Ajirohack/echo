const React = require('react');
const { useState } = require('react');
const {
  Card,
  Form,
  Select,
  Switch,
  Slider,
  Button,
  Divider,
  Row,
  Col,
  InputNumber,
  Typography,
  Space,
  Alert,
} = require('antd');
const {
  AudioOutlined,
  TranslationOutlined,
  SettingOutlined,
  SaveOutlined,
  ReloadOutlined,
} = require('@ant-design/icons');

const { Title, Text } = Typography;
const { Option } = Select;

const SettingsPage = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

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

  const audioDevices = [
    { id: 'default', name: 'Default Microphone' },
    { id: 'mic1', name: 'Built-in Microphone' },
    { id: 'mic2', name: 'External USB Microphone' },
    { id: 'mic3', name: 'Bluetooth Headset' },
  ];

  const onFinish = async (values) => {
    setLoading(true);
    try {
      // Save settings using the SettingsManager via IPC
      const result = await window.electronAPI.settings.update(values);

      if (result.success) {
        message.success('Settings saved successfully!');
        console.log('Settings saved:', values);
      } else {
        message.error(`Failed to save settings: ${result.error}`);
        console.error('Error saving settings:', result.error);
      }
    } catch (error) {
      message.error('Failed to save settings');
      console.error('Error saving settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    form.resetFields();
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <Title level={2} className="settings-title">
          <SettingOutlined /> Settings
        </Title>
        <Text type="secondary">Configure your translation preferences and app settings</Text>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{
          sourceLanguage: 'en',
          targetLanguage: 'es',
          audioDevice: 'default',
          autoTranslate: true,
          showConfidence: true,
          audioLevel: 0.8,
          translationSpeed: 'normal',
          theme: 'dark',
        }}
      >
        <Row gutter={[24, 24]}>
          {/* Language Settings */}
          <Col xs={24} lg={12}>
            <Card
              title={
                <Space>
                  <TranslationOutlined />
                  Language Settings
                </Space>
              }
              className="settings-card"
            >
              <Form.Item
                label="Source Language"
                name="sourceLanguage"
                rules={[{ required: true, message: 'Please select source language' }]}
              >
                <Select placeholder="Select source language" showSearch optionFilterProp="children">
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
                label="Target Language"
                name="targetLanguage"
                rules={[{ required: true, message: 'Please select target language' }]}
              >
                <Select placeholder="Select target language" showSearch optionFilterProp="children">
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

              <Form.Item label="Translation Speed" name="translationSpeed">
                <Select>
                  <Option value="fast">Fast (Lower accuracy)</Option>
                  <Option value="normal">Normal (Balanced)</Option>
                  <Option value="accurate">Accurate (Slower)</Option>
                </Select>
              </Form.Item>
            </Card>
          </Col>

          {/* Audio Settings */}
          <Col xs={24} lg={12}>
            <Card
              title={
                <Space>
                  <AudioOutlined />
                  Audio Settings
                </Space>
              }
              className="settings-card"
            >
              <Form.Item label="Audio Input Device" name="audioDevice">
                <Select placeholder="Select audio device">
                  {audioDevices.map((device) => (
                    <Option key={device.id} value={device.id}>
                      {device.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item label="Audio Level" name="audioLevel">
                <Slider
                  min={0}
                  max={1}
                  step={0.1}
                  marks={{
                    0: '0%',
                    0.5: '50%',
                    1: '100%',
                  }}
                />
              </Form.Item>

              <Form.Item label="Noise Reduction" name="noiseReduction" valuePropName="checked">
                <Switch />
              </Form.Item>

              <Form.Item label="Echo Cancellation" name="echoCancellation" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Card>
          </Col>

          {/* Display Settings */}
          <Col xs={24} lg={12}>
            <Card title="Display Settings" className="settings-card">
              <Form.Item label="Theme" name="theme">
                <Select>
                  <Option value="dark">Dark Theme</Option>
                  <Option value="light">Light Theme</Option>
                  <Option value="auto">Auto (System)</Option>
                </Select>
              </Form.Item>

              <Form.Item
                label="Show Confidence Scores"
                name="showConfidence"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item
                label="Auto-translate on speak"
                name="autoTranslate"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item label="Show Timestamps" name="showTimestamps" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Card>
          </Col>

          {/* Advanced Settings */}
          <Col xs={24} lg={12}>
            <Card title="Advanced Settings" className="settings-card">
              <Form.Item label="Translation Provider" name="translationProvider">
                <Select>
                  <Option value="azure">Azure Translator</Option>
                  <Option value="google">Google Translate</Option>
                  <Option value="deepl">DeepL</Option>
                  <Option value="groq">Groq (AI)</Option>
                </Select>
              </Form.Item>

              <Form.Item label="Speech Recognition Provider" name="sttProvider">
                <Select>
                  <Option value="azure">Azure Speech</Option>
                  <Option value="google">Google Speech</Option>
                  <Option value="whisper">OpenAI Whisper</Option>
                </Select>
              </Form.Item>

              <Form.Item label="Text-to-Speech Provider" name="ttsProvider">
                <Select>
                  <Option value="azure">Azure TTS</Option>
                  <Option value="elevenlabs">ElevenLabs</Option>
                  <Option value="google">Google TTS</Option>
                </Select>
              </Form.Item>

              <Form.Item label="Cache Size (MB)" name="cacheSize">
                <InputNumber min={10} max={1000} step={10} style={{ width: '100%' }} />
              </Form.Item>
            </Card>
          </Col>
        </Row>

        <Divider />

        {/* Action Buttons */}
        <div className="settings-actions">
          <Space size="large">
            <Button
              type="primary"
              icon={<SaveOutlined />}
              size="large"
              htmlType="submit"
              loading={loading}
            >
              Save Settings
            </Button>
            <Button icon={<ReloadOutlined />} size="large" onClick={handleReset}>
              Reset to Defaults
            </Button>
          </Space>
        </div>
      </Form>

      <Alert
        message="Settings saved successfully!"
        type="success"
        showIcon
        style={{ marginTop: 16, display: 'none' }}
        id="settings-saved-alert"
      />
    </div>
  );
};

module.exports = SettingsPage;
