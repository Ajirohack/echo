// Mock for @ant-design/icons
const React = require('react');

// Mock icon components
const createMockIcon = (displayName) => {
  const MockIcon = (props) => (
    <span data-testid={`antd-icon-${displayName.toLowerCase()}`} {...props}>
      {displayName}Icon
    </span>
  );
  MockIcon.displayName = displayName;
  return MockIcon;
};

// Mock the icons you're using
const AudioOutlined = createMockIcon('AudioOutlined');

module.exports = {
  AudioOutlined,
  // Add other mocked icons here as needed
};
