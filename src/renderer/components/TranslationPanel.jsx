const React = require('react');
const { useState, useEffect, useRef } = require('react');
const { Input, Button, Avatar, Tooltip, Badge } = require('antd');
const { SendOutlined, AudioOutlined, StopOutlined, SettingOutlined } = require('@ant-design/icons');

const { TextArea } = Input;

const TranslationPanel = ({
  isRecording = false,
  onStartRecording,
  onStopRecording,
  onSendMessage,
  messages = [],
  sourceLanguage = 'English',
  targetLanguage = 'Spanish',
  onLanguageChange,
}) => {
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    if (inputText.trim()) {
      onSendMessage?.(inputText.trim());
      setInputText('');
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getLanguageFlag = (language) => {
    const flags = {
      English: '🇺🇸',
      Spanish: '🇪🇸',
      French: '🇫🇷',
      German: '🇩🇪',
      Italian: '🇮🇹',
      Portuguese: '🇵🇹',
      Russian: '🇷🇺',
      Chinese: '🇨🇳',
      Japanese: '🇯🇵',
      Korean: '🇰🇷',
      Arabic: '🇸🇦',
      Hindi: '🇮🇳',
    };
    return flags[language] || '🌐';
  };

  return (
    <div className="translation-panel">
      {/* Header */}
      <div className="panel-header">
        <div className="language-info">
          <div className="language-pair">
            <span className="language-flag">{getLanguageFlag(sourceLanguage)}</span>
            <span className="language-name">{sourceLanguage}</span>
            <span className="arrow">→</span>
            <span className="language-flag">{getLanguageFlag(targetLanguage)}</span>
            <span className="language-name">{targetLanguage}</span>
          </div>
          <div className="recording-status">
            {isRecording && (
              <div className="recording-indicator">
                <div className="pulse-dot"></div>
                <span>Recording...</span>
              </div>
            )}
          </div>
        </div>
        <div className="header-actions">
          <Tooltip title="Settings">
            <Button
              type="text"
              icon={<SettingOutlined />}
              className="icon-button"
              onClick={() => onLanguageChange?.()}
            />
          </Tooltip>
        </div>
      </div>

      {/* Messages Area */}
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎤</div>
            <h3>Start translating</h3>
            <p>Press the microphone button to begin real-time translation</p>
          </div>
        ) : (
          <div className="messages-list">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`message ${message.type === 'translation' ? 'translation' : 'original'}`}
              >
                <div className="message-content">
                  <div className="message-text">{message.text}</div>
                  <div className="message-meta">
                    <span className="message-time">{formatTime(message.timestamp)}</span>
                    {message.confidence && (
                      <span className="confidence">
                        {Math.round(message.confidence * 100)}% confidence
                      </span>
                    )}
                  </div>
                </div>
                <div className="message-avatar">
                  {message.type === 'translation' ? (
                    <Avatar size="small" style={{ backgroundColor: '#bfa6c9' }}>
                      {getLanguageFlag(targetLanguage)}
                    </Avatar>
                  ) : (
                    <Avatar size="small" style={{ backgroundColor: '#b7cbb0' }}>
                      {getLanguageFlag(sourceLanguage)}
                    </Avatar>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="input-area">
        <div className="input-container">
          <TextArea
            ref={inputRef}
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              setIsTyping(e.target.value.length > 0);
            }}
            onKeyPress={handleKeyPress}
            placeholder="Type a message or use voice..."
            autoSize={{ minRows: 1, maxRows: 4 }}
            className="message-input"
          />
          <div className="input-actions">
            {isTyping && (
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSendMessage}
                className="send-button"
                size="small"
              >
                Send
              </Button>
            )}
          </div>
        </div>

        <div className="voice-controls">
          <Tooltip title={isRecording ? 'Stop recording' : 'Start recording'}>
            <Button
              type="primary"
              shape="circle"
              size="large"
              icon={isRecording ? <StopOutlined /> : <AudioOutlined />}
              onClick={isRecording ? onStopRecording : onStartRecording}
              className={`record-button ${isRecording ? 'recording' : ''}`}
            />
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

module.exports = TranslationPanel;
