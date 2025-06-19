import React, { useState, useEffect } from 'react';
import { Card, Typography, Button, Space, Alert, Divider, Progress } from 'antd';
import { AudioOutlined, AudioMutedOutlined, ReloadOutlined } from '@ant-design/icons';
import AudioDeviceSelector from '../components/AudioDeviceSelector';

const { Title, Text } = Typography;

const AudioTestPage = () => {
  const [testStatus, setTestStatus] = useState({
    inputTested: false,
    outputTested: false,
    virtualTested: false,
    isTesting: false
  });
  
  const [audioLevels, setAudioLevels] = useState({
    input: 0,
    output: 0
  });
  
  const [error, setError] = useState('');
  
  // Simulate audio levels for testing
  useEffect(() => {
    if (!testStatus.isTesting) return;
    
    const interval = setInterval(() => {
      setAudioLevels(prev => ({
        input: Math.min(1, prev.input + (Math.random() * 0.1 - 0.02)),
        output: Math.min(1, prev.output + (Math.random() * 0.1 - 0.02))
      }));
    }, 100);
    
    return () => clearInterval(interval);
  }, [testStatus.isTesting]);
  
  const startTest = (type) => {
    setTestStatus(prev => ({
      ...prev,
      isTesting: true,
      [`${type}Tested`]: false
    }));
    
    // Simulate test completion after 3 seconds
    setTimeout(() => {
      setTestStatus(prev => ({
        ...prev,
        isTesting: false,
        [`${type}Tested`]: true
      }));
    }, 3000);
  };
  
  const getTestStatus = (type) => {
    if (testStatus.isTesting && !testStatus[`${type}Tested`]) {
      return 'testing';
    }
    return testStatus[`${type}Tested`] ? 'success' : 'waiting';
  };
  
  const renderTestButton = (type, label, icon) => {
    const status = getTestStatus(type);
    let buttonType = 'default';
    let buttonText = `Test ${label}`;
    
    if (status === 'testing') {
      buttonType = 'primary';
      buttonText = 'Testing...';
    } else if (status === 'success') {
      buttonType = 'success';
      buttonText = `✓ ${label} Working`;
    }
    
    return (
      <Button
        type={buttonType}
        icon={icon}
        onClick={() => startTest(type)}
        disabled={testStatus.isTesting}
        style={{ minWidth: 180 }}
      >
        {buttonText}
      </Button>
    );
  };
  
  const renderTestSection = (title, description, type, icon) => (
    <div style={{ marginBottom: 24 }}>
      <div style={{ marginBottom: 8 }}>
        <Text strong>{title}</Text>
        <div style={{ marginTop: 4 }}>
          <Text type="secondary">{description}</Text>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {renderTestButton(type, title, icon)}
        <Progress 
          percent={testStatus[`${type}Tested`] ? 100 : testStatus.isTesting ? 50 : 0} 
          showInfo={false} 
          status={getTestStatus(type) === 'success' ? 'success' : 'active'}
          style={{ flex: 1, maxWidth: 200 }}
        />
      </div>
    </div>
  );

  return (
    <div style={{ padding: 24 }}>
      <Title level={2} style={{ marginBottom: 24 }}>Audio Device Test</Title>
      
      {error && (
        <Alert 
          message="Error" 
          description={error} 
          type="error" 
          showIcon 
          style={{ marginBottom: 24 }} 
          closable 
          onClose={() => setError('')} 
        />
      )}
      
      <Card title="Audio Device Configuration" style={{ marginBottom: 24 }}>
        <AudioDeviceSelector />
      </Card>
      
      <Card title="Audio Test" style={{ marginBottom: 24 }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Test each audio component to ensure proper functionality
        </Text>
        
        {renderTestSection(
          'Microphone', 
          'Speak into your microphone to test input levels',
          'input',
          <AudioOutlined />
        )}
        
        <Divider style={{ margin: '16px 0' }} />
        
        {renderTestSection(
          'Speaker', 
          'Listen for the test tone in your speakers',
          'output',
          <AudioOutlined />
        )}
        
        <Divider style={{ margin: '16px 0' }} />
        
        {renderTestSection(
          'Virtual Device', 
          'Test audio routing through virtual device',
          'virtual',
          <AudioOutlined />
        )}
      </Card>
      
      <Card title="Audio Levels" style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text>Input Level</Text>
            <Text>{Math.round(audioLevels.input * 100)}%</Text>
          </div>
          <Progress 
            percent={audioLevels.input * 100} 
            status={testStatus.isTesting ? 'active' : 'normal'}
            strokeColor={testStatus.isTesting ? '#1890ff' : '#52c41a'}
          />
        </div>
        
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text>Output Level</Text>
            <Text>{Math.round(audioLevels.output * 100)}%</Text>
          </div>
          <Progress 
            percent={audioLevels.output * 100} 
            status={testStatus.isTesting ? 'active' : 'normal'}
            strokeColor={testStatus.isTesting ? '#1890ff' : '#52c41a'}
          />
        </div>
      </Card>
      
      <div style={{ textAlign: 'center', marginTop: 32 }}>
        <Button 
          type="primary" 
          size="large"
          disabled={!testStatus.inputTested || !testStatus.outputTested || !testStatus.virtualTested}
        >
          Continue to Translation
        </Button>
      </div>
    </div>
  );
};

export default AudioTestPage;
