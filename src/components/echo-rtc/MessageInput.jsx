import React, { useState, useRef, useEffect } from 'react';
import { useEchoRTC } from './EchoRTCProvider.jsx';
import './MessageInput.css';

/**
 * Message Input Component
 * Handles real-time messaging with translation support
 */
const MessageInput = ({
  placeholder = 'Type a message...',
  maxLength = 500,
  showTranslation = true,
  showEmojiPicker = true,
  showAttachments = false,
  autoFocus = false,
  className = '',
  style = {},
  onMessageSent = null,
  onTyping = null,
}) => {
  const { sendMessage, isConnected, translationEnabled, sourceLanguage, targetLanguage, echoRTC } =
    useEchoRTC();

  // Local state
  const [message, setMessage] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedMessage, setTranslatedMessage] = useState('');
  const [showEmojiPanel, setShowEmojiPanel] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [messageHistory, setMessageHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Refs
  const inputRef = useRef(null);
  const emojiPanelRef = useRef(null);

  // Common emojis
  const commonEmojis = [
    '😀',
    '😂',
    '😍',
    '🤔',
    '👍',
    '👎',
    '❤️',
    '🎉',
    '😊',
    '😢',
    '😮',
    '😡',
    '🙏',
    '👏',
    '🔥',
    '💯',
    '😎',
    '🤗',
    '😴',
    '🤯',
    '🎵',
    '📱',
    '💻',
    '🌟',
  ];

  // Message suggestions
  const messageSuggestions = [
    'Hello everyone!',
    'Can you hear me?',
    'Thanks for joining',
    'Let me share my screen',
    'I need to step away for a moment',
    'Great presentation!',
    'Any questions?',
    'See you next time!',
  ];

  /**
   * Handle message change
   */
  const handleMessageChange = (e) => {
    const value = e.target.value;

    if (value.length <= maxLength) {
      setMessage(value);

      // Handle typing indicator
      if (!isTyping && value.length > 0) {
        setIsTyping(true);
        if (onTyping) {
          onTyping(true);
        }
      }

      // Clear typing timeout
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }

      // Set new typing timeout
      const timeout = setTimeout(() => {
        setIsTyping(false);
        if (onTyping) {
          onTyping(false);
        }
      }, 1000);

      setTypingTimeout(timeout);

      // Auto-translate if enabled
      if (translationEnabled && value.trim()) {
        handleAutoTranslate(value);
      } else {
        setTranslatedMessage('');
      }
    }
  };

  /**
   * Handle auto-translation
   */
  const handleAutoTranslate = async (text) => {
    if (!echoRTC || !text.trim()) return;

    setIsTranslating(true);

    try {
      const translated = await echoRTC.translateText({
        text: text.trim(),
        sourceLanguage,
        targetLanguage,
      });

      setTranslatedMessage(translated.translatedText || '');
    } catch (error) {
      console.error('Auto-translation failed:', error);
      setTranslatedMessage('');
    } finally {
      setIsTranslating(false);
    }
  };

  /**
   * Handle send message
   */
  const handleSendMessage = async () => {
    if (!message.trim() || !isConnected) return;

    const messageData = {
      text: message.trim(),
      timestamp: Date.now(),
      translated: translatedMessage || null,
      sourceLanguage: sourceLanguage,
      targetLanguage: targetLanguage,
    };

    try {
      await sendMessage(messageData);

      // Add to history
      setMessageHistory((prev) => {
        const newHistory = [message.trim(), ...prev.slice(0, 9)];
        return newHistory;
      });

      // Clear input
      setMessage('');
      setTranslatedMessage('');
      setHistoryIndex(-1);

      // Focus input
      if (inputRef.current) {
        inputRef.current.focus();
      }

      // Callback
      if (onMessageSent) {
        onMessageSent(messageData);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  /**
   * Handle key press
   */
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    } else if (e.key === 'ArrowUp' && message === '') {
      e.preventDefault();
      navigateHistory('up');
    } else if (e.key === 'ArrowDown' && message === '') {
      e.preventDefault();
      navigateHistory('down');
    } else if (e.key === 'Escape') {
      setShowEmojiPanel(false);
      setShowSuggestions(false);
    }
  };

  /**
   * Navigate message history
   */
  const navigateHistory = (direction) => {
    if (messageHistory.length === 0) return;

    let newIndex = historyIndex;

    if (direction === 'up') {
      newIndex = Math.min(historyIndex + 1, messageHistory.length - 1);
    } else {
      newIndex = Math.max(historyIndex - 1, -1);
    }

    setHistoryIndex(newIndex);

    if (newIndex >= 0) {
      setMessage(messageHistory[newIndex]);
    } else {
      setMessage('');
    }
  };

  /**
   * Handle emoji selection
   */
  const handleEmojiSelect = (emoji) => {
    const newMessage = message + emoji;
    if (newMessage.length <= maxLength) {
      setMessage(newMessage);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
    setShowEmojiPanel(false);
  };

  /**
   * Handle suggestion selection
   */
  const handleSuggestionSelect = (suggestion) => {
    setMessage(suggestion);
    setShowSuggestions(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  /**
   * Handle input focus
   */
  const handleInputFocus = () => {
    if (message === '' && messageHistory.length > 0) {
      setShowSuggestions(true);
    }
  };

  /**
   * Handle input blur
   */
  const handleInputBlur = () => {
    // Delay hiding suggestions to allow for clicks
    setTimeout(() => {
      setShowSuggestions(false);
    }, 200);
  };

  // Auto-focus
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Click outside handler for emoji panel
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPanelRef.current && !emojiPanelRef.current.contains(event.target)) {
        setShowEmojiPanel(false);
      }
    };

    if (showEmojiPanel) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPanel]);

  // Cleanup typing timeout
  useEffect(() => {
    return () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
    };
  }, [typingTimeout]);

  return (
    <div className={`message-input ${className}`} style={style}>
      {/* Translation Preview */}
      {translationEnabled && (translatedMessage || isTranslating) && (
        <div className="message-input__translation-preview">
          <div className="message-input__translation-header">
            <span className="message-input__translation-label">
              Translation ({sourceLanguage} → {targetLanguage}):
            </span>
            {isTranslating && <span className="message-input__translation-loading">🔄</span>}
          </div>
          <div className="message-input__translation-text">
            {isTranslating ? 'Translating...' : translatedMessage}
          </div>
        </div>
      )}

      {/* Message Suggestions */}
      {showSuggestions && (
        <div className="message-input__suggestions">
          <div className="message-input__suggestions-header">Quick Messages</div>
          <div className="message-input__suggestions-list">
            {messageSuggestions.map((suggestion, index) => (
              <button
                key={index}
                className="message-input__suggestion"
                onClick={() => handleSuggestionSelect(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>

          {messageHistory.length > 0 && (
            <>
              <div className="message-input__suggestions-header">Recent Messages</div>
              <div className="message-input__suggestions-list">
                {messageHistory.slice(0, 5).map((historyMessage, index) => (
                  <button
                    key={index}
                    className="message-input__suggestion message-input__suggestion--history"
                    onClick={() => handleSuggestionSelect(historyMessage)}
                  >
                    {historyMessage}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Main Input Area */}
      <div className="message-input__main">
        {/* Emoji Panel */}
        {showEmojiPanel && (
          <div className="message-input__emoji-panel" ref={emojiPanelRef}>
            <div className="message-input__emoji-header">Emojis</div>
            <div className="message-input__emoji-grid">
              {commonEmojis.map((emoji, index) => (
                <button
                  key={index}
                  className="message-input__emoji"
                  onClick={() => handleEmojiSelect(emoji)}
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Controls */}
        <div className="message-input__controls">
          {/* Emoji Button */}
          {showEmojiPicker && (
            <button
              className={`message-input__control-button ${
                showEmojiPanel ? 'message-input__control-button--active' : ''
              }`}
              onClick={() => setShowEmojiPanel(!showEmojiPanel)}
              title="Add Emoji"
              disabled={!isConnected}
            >
              😀
            </button>
          )}

          {/* Attachment Button */}
          {showAttachments && (
            <button
              className="message-input__control-button"
              onClick={() => {
                /* Handle file attachment */
              }}
              title="Attach File"
              disabled={!isConnected}
            >
              📎
            </button>
          )}

          {/* Translation Toggle */}
          {showTranslation && (
            <button
              className={`message-input__control-button ${
                translationEnabled ? 'message-input__control-button--active' : ''
              }`}
              onClick={() => echoRTC?.toggleTranslation()}
              title={translationEnabled ? 'Disable Translation' : 'Enable Translation'}
              disabled={!isConnected}
            >
              🌐
            </button>
          )}
        </div>

        {/* Text Input */}
        <div className="message-input__input-container">
          <textarea
            ref={inputRef}
            className="message-input__input"
            value={message}
            onChange={handleMessageChange}
            onKeyDown={handleKeyPress}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder={isConnected ? placeholder : 'Not connected...'}
            disabled={!isConnected}
            rows={1}
            style={{
              resize: 'none',
              overflow: 'hidden',
            }}
          />

          {/* Character Counter */}
          <div className="message-input__counter">
            <span
              className={`message-input__counter-text ${
                message.length > maxLength * 0.9 ? 'message-input__counter-text--warning' : ''
              }`}
            >
              {message.length}/{maxLength}
            </span>
          </div>
        </div>

        {/* Send Button */}
        <button
          className={`message-input__send-button ${
            message.trim() && isConnected ? 'message-input__send-button--enabled' : ''
          }`}
          onClick={handleSendMessage}
          disabled={!message.trim() || !isConnected}
          title="Send Message (Enter)"
        >
          {isConnected ? '📤' : '🚫'}
        </button>
      </div>

      {/* Status Bar */}
      <div className="message-input__status">
        {/* Connection Status */}
        <div className="message-input__status-item">
          <span
            className={`message-input__status-indicator ${
              isConnected
                ? 'message-input__status-indicator--connected'
                : 'message-input__status-indicator--disconnected'
            }`}
          ></span>
          <span className="message-input__status-text">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {/* Translation Status */}
        {showTranslation && translationEnabled && (
          <div className="message-input__status-item">
            <span className="message-input__status-indicator message-input__status-indicator--translation"></span>
            <span className="message-input__status-text">
              Translation: {sourceLanguage} → {targetLanguage}
            </span>
          </div>
        )}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="message-input__status-item">
            <span className="message-input__status-indicator message-input__status-indicator--typing"></span>
            <span className="message-input__status-text">Typing...</span>
          </div>
        )}

        {/* Keyboard Shortcuts */}
        <div className="message-input__shortcuts">
          <span className="message-input__shortcut">Enter to send</span>
          <span className="message-input__shortcut">↑↓ for history</span>
          <span className="message-input__shortcut">Esc to close panels</span>
        </div>
      </div>
    </div>
  );
};

export default MessageInput;
