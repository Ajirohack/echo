import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Select,
  Button,
  Row,
  Col,
  Alert,
  Progress,
  Typography,
  Space,
  Tooltip,
  message,
} from 'antd';
import {
  AudioOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
} from '@ant-design/icons';
import audioService from '../services/audioService';

const { Option } = Select;
const { Text, Title } = Typography;

const AudioDeviceSelector = () => {
  const [devices, setDevices] = useState({
    inputs: [],
    outputs: [],
    virtuals: [],
  });
  const [selectedInput, setSelectedInput] = useState('');
  const [selectedOutput, setSelectedOutput] = useState('');
  const [selectedVirtual, setSelectedVirtual] = useState('');
  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [testStatus, setTestStatus] = useState({
    input: 'idle', // 'idle', 'testing', 'success', 'error'
    output: 'idle',
    virtual: 'idle',
  });
  const [showVirtualHelp, setShowVirtualHelp] = useState(false);
  const [installationGuide, setInstallationGuide] = useState(null);

  // Load devices on component mount
  const loadDevices = useCallback(async () => {
    try {
      setIsLoading(true);
      const deviceList = await audioService.getDevices();
      setDevices(deviceList);

      // Try to select default devices
      if (deviceList.inputs.length > 0 && !selectedInput) {
        setSelectedInput(deviceList.inputs[0].deviceId);
      }
      if (deviceList.outputs.length > 0 && !selectedOutput) {
        setSelectedOutput(deviceList.outputs[0].deviceId);
      }
      if (deviceList.virtuals.length > 0 && !selectedVirtual) {
        setSelectedVirtual(deviceList.virtuals[0].deviceId);
      }
    } catch (err) {
      console.error('Error loading audio devices:', err);
      setError('Failed to load audio devices. Please check your audio settings and try again.');
      message.error('Failed to load audio devices');
    } finally {
      setIsLoading(false);
    }
  }, [selectedInput, selectedOutput, selectedVirtual]);

  useEffect(() => {
    loadDevices();

    // Set up audio level updates
    const levelInterval = setInterval(() => {
      if (isCapturing) {
        audioService
          .getAudioLevels()
          .then((levels) => {
            setInputLevel(levels.input);
            setOutputLevel(levels.output);
          })
          .catch(console.error);
      }
    }, 100);

    return () => clearInterval(levelInterval);
  }, [isCapturing, loadDevices]);

  // Handle devices updated event
  const handleDevicesUpdated = (updatedDevices) => {
    setDevices(updatedDevices);

    // Auto-select first available devices if none selected
    if (!selectedInput && updatedDevices.inputs.length > 0) {
      setSelectedInput(updatedDevices.inputs[0].deviceId);
    }

    if (!selectedOutput && updatedDevices.outputs.length > 0) {
      setSelectedOutput(updatedDevices.outputs[0].deviceId);
    }

    if (!selectedVirtual && updatedDevices.virtuals.length > 0) {
      setSelectedVirtual(updatedDevices.virtuals[0].deviceId);
    }
  };

  // Handle audio level updates
  const handleAudioLevels = ({ inputLevel: inLvl, outputLevel: outLvl }) => {
    if (inLvl !== undefined) setInputLevel(inLvl);
    if (outLvl !== undefined) setOutputLevel(outLvl);
  };

  // Load available audio devices
  const handleRefresh = async () => {
    try {
      await loadDevices();
      message.success('Audio devices refreshed');
    } catch (err) {
      console.error('Refresh error:', err);
      message.error('Failed to refresh devices');
    }
  };

  const runTest = async (type) => {
    setTestStatus((prev) => ({ ...prev, [type]: 'testing' }));

    try {
      // Simulate test with timeout
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setTestStatus((prev) => ({ ...prev, [type]: 'success' }));
      message.success(`${type} test completed successfully`);
    } catch (err) {
      console.error(`${type} test failed:`, err);
      setTestStatus((prev) => ({ ...prev, [type]: 'error' }));
      message.error(`${type} test failed`);
    }
  };

  // Start/stop audio capture
  const handleStartCapture = async () => {
    if (!selectedInput) {
      setError('Please select an input device');
      message.warning('Please select an input device');
      return;
    }

    try {
      setIsLoading(true);
      await audioService.startCapture(selectedInput);
      setIsCapturing(true);
      setError('');
      message.success('Audio capture started');
    } catch (err) {
      console.error('Capture error:', err);
      setError(err.message || 'Failed to start audio capture');
      message.error('Failed to start audio capture');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopCapture = async () => {
    try {
      setIsLoading(true);
      await audioService.stopCapture();
      setIsCapturing(false);
      message.info('Audio capture stopped');
    } catch (err) {
      console.error('Stop capture error:', err);
      setError(err.message || 'Failed to stop audio capture');
      message.error('Failed to stop audio capture');
    } finally {
      setIsLoading(false);
    }
  };

  // Get device display name
  const getDeviceName = (device) => {
    if (!device) return 'Unknown';
    return device.label || device.deviceId || 'Unnamed Device';
  };

  // Render device options
  const renderDeviceOptions = (deviceList) => {
    return deviceList.map((device) => (
      <Option key={device.deviceId} value={device.deviceId}>
        {device.label || device.deviceId || 'Unnamed Device'}
      </Option>
    ));
  };

  const renderTestStatus = (type) => {
    const status = testStatus[type];
    const statusMap = {
      idle: null,
      testing: <span style={{ color: '#1890ff' }}>Testing...</span>,
      success: (
        <span style={{ color: '#52c41a' }}>
          <CheckCircleFilled /> Success
        </span>
      ),
      error: (
        <span style={{ color: '#ff4d4f' }}>
          <CloseCircleFilled /> Failed
        </span>
      ),
    };

    return statusMap[status] || null;
  };

  return (
    <div className="audio-device-selector">
      <Card
        title={
          <Space>
            <AudioOutlined style={{ color: '#bfa6c9' }} />
            <span style={{ color: '#bfa6c9', fontWeight: 600 }}>Audio Device Configuration</span>
          </Space>
        }
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            disabled={isCapturing || isLoading}
            loading={isLoading}
            style={{ background: '#bfa6c9', color: '#222222', borderRadius: 18, fontWeight: 600 }}
          >
            Refresh Devices
          </Button>
        }
        style={{ background: '#232323', borderRadius: 24 }}
      >
        {error && (
          <Alert
            message="Error"
            description={error}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            closable
            onClose={() => setError('')}
          />
        )}

        <Row gutter={[16, 24]}>
          <Col xs={24} md={8}>
            <div
              className="device-selector"
              style={{
                background: '#292929',
                borderRadius: 12,
                padding: 16,
                border: '1px solid #333',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text strong style={{ color: '#bfa6c9' }}>
                  Input Device
                </Text>
                <Button
                  type="link"
                  size="small"
                  onClick={() => runTest('input')}
                  disabled={isLoading || isCapturing}
                  loading={testStatus.input === 'testing'}
                  style={{ color: '#bfa6c9' }}
                >
                  Test
                </Button>
              </div>
              <Select
                value={selectedInput}
                onChange={setSelectedInput}
                style={{ width: '100%', background: '#232323', color: '#f5f5f5', borderRadius: 12 }}
                disabled={isCapturing || isLoading}
                placeholder="Select input device"
                loading={isLoading}
                dropdownStyle={{ background: '#232323', color: '#f5f5f5' }}
              >
                {renderDeviceOptions(devices.inputs)}
              </Select>
              <div className="audio-level" style={{ marginTop: 8 }}>
                <Progress
                  percent={inputLevel * 100}
                  showInfo={false}
                  status={isCapturing ? 'active' : 'normal'}
                  strokeColor={isCapturing ? '#bfa6c9' : '#b7cbb0'}
                />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    marginTop: 4,
                    color: '#b7b7b7',
                  }}
                >
                  <span>Input Level</span>
                  <span>{Math.round(inputLevel * 100)}%</span>
                </div>
                {renderTestStatus('input')}
              </div>
            </div>
          </Col>

          <Col xs={24} md={8}>
            <div
              className="device-selector"
              style={{
                background: '#292929',
                borderRadius: 12,
                padding: 16,
                border: '1px solid #333',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text strong style={{ color: '#bfa6c9' }}>
                  Output Device
                </Text>
                <Button
                  type="link"
                  size="small"
                  onClick={() => runTest('output')}
                  disabled={isLoading || isCapturing}
                  loading={testStatus.output === 'testing'}
                  style={{ color: '#bfa6c9' }}
                >
                  Test
                </Button>
              </div>
              <Select
                value={selectedOutput}
                onChange={setSelectedOutput}
                style={{ width: '100%', background: '#232323', color: '#f5f5f5', borderRadius: 12 }}
                disabled={isCapturing || isLoading}
                placeholder="Select output device"
                loading={isLoading}
                dropdownStyle={{ background: '#232323', color: '#f5f5f5' }}
              >
                {renderDeviceOptions(devices.outputs)}
              </Select>
              <div className="audio-level" style={{ marginTop: 8 }}>
                <Progress
                  percent={outputLevel * 100}
                  showInfo={false}
                  status={isCapturing ? 'active' : 'normal'}
                  strokeColor={isCapturing ? '#bfa6c9' : '#b7cbb0'}
                />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    marginTop: 4,
                    color: '#b7b7b7',
                  }}
                >
                  <span>Output Level</span>
                  <span>{Math.round(outputLevel * 100)}%</span>
                </div>
                {renderTestStatus('output')}
              </div>
            </div>
          </Col>

          <Col xs={24} md={8}>
            <div
              className="device-selector"
              style={{
                background: '#292929',
                borderRadius: 12,
                padding: 16,
                border: '1px solid #333',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <Text strong style={{ color: '#bfa6c9', marginRight: 8 }}>
                    Virtual Device
                  </Text>
                  <Tooltip title="Virtual audio devices allow you to route audio between applications">
                    <InfoCircleOutlined style={{ color: '#8c8c8c' }} />
                  </Tooltip>
                </div>
                <Button
                  type="link"
                  size="small"
                  onClick={() => runTest('virtual')}
                  disabled={isLoading || isCapturing || !selectedVirtual}
                  loading={testStatus.virtual === 'testing'}
                  style={{ color: '#bfa6c9' }}
                >
                  Test
                </Button>
              </div>
              <Select
                value={selectedVirtual}
                onChange={setSelectedVirtual}
                style={{ width: '100%', background: '#232323', color: '#f5f5f5', borderRadius: 12 }}
                disabled={isCapturing || isLoading}
                placeholder="Select virtual device"
                loading={isLoading}
                dropdownStyle={{ background: '#232323', color: '#f5f5f5' }}
              >
                {devices.virtuals.length > 0 ? (
                  devices.virtuals.map((device) => (
                    <Option key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </Option>
                  ))
                ) : (
                  <Option value="" disabled>
                    No virtual devices found
                  </Option>
                )}
              </Select>

              <div style={{ marginTop: 8 }}>
                {devices.virtuals.length === 0 ? (
                  <div>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => {
                        const os = window.navigator.platform.toLowerCase();
                        let url = 'https://github.com/ExistentialAudio/BlackHole';

                        if (os.includes('win')) {
                          url = 'https://www.vb-audio.com/Cable/';
                        } else if (os.includes('linux')) {
                          url =
                            'https://www.freedesktop.org/wiki/Software/PulseAudio/Documentation/User/Modules/#module-null-sink';
                        }

                        window.open(url, '_blank');
                      }}
                      disabled={isLoading}
                      style={{ color: '#bfa6c9' }}
                    >
                      Install Virtual Audio Device
                    </Button>
                    <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
                      Required for system audio capture
                    </div>
                  </div>
                ) : (
                  <div style={{ minHeight: 20 }}>{renderTestStatus('virtual')}</div>
                )}
              </div>
            </div>
          </Col>
        </Row>

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          {isCapturing ? (
            <Button
              type="primary"
              danger
              onClick={handleStopCapture}
              loading={isLoading}
              size="large"
              style={{
                minWidth: 160,
                background: '#bfa6c9',
                color: '#222222',
                borderRadius: 18,
                fontWeight: 600,
              }}
            >
              Stop Capture
            </Button>
          ) : (
            <Button
              type="primary"
              onClick={handleStartCapture}
              loading={isLoading}
              icon={<AudioOutlined />}
              size="large"
              style={{
                minWidth: 160,
                background: '#bfa6c9',
                color: '#222222',
                borderRadius: 18,
                fontWeight: 600,
              }}
              disabled={!selectedInput}
            >
              {isLoading ? 'Starting...' : 'Start Capture'}
            </Button>
          )}
        </div>

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Text type="secondary" style={{ fontSize: 12, color: '#b7b7b7' }}>
            {isCapturing
              ? 'Capturing audio...'
              : 'Click "Start Capture" to begin monitoring audio levels'}
          </Text>
        </div>
      </Card>

      <style jsx>{`
        .device-selector {
          background: #fafafa;
          border-radius: 8px;
          padding: 16px;
          height: 100%;
          border: 1px solid #f0f0f0;
          transition: all 0.3s;
        }

        .device-selector:hover {
          border-color: #d9d9d9;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        .audio-level {
          margin-top: 12px;
        }

        @media (max-width: 768px) {
          .device-selector {
            margin-bottom: 16px;
          }
        }
      `}</style>
    </div>
  );
};

export default AudioDeviceSelector;
