// Mock for antd components
const antd = jest.requireActual('antd');

// Mock specific antd components as needed
const mockComponent = (name) => (props) => {
  return <div data-testid={`antd-${name.toLowerCase()}`} {...props} />;
};

// Mock the components you're using
const ConfigProvider = mockComponent('ConfigProvider');
ConfigProvider.ConfigContext = antd.ConfigProvider.ConfigContext;

module.exports = {
  ...antd,
  ConfigProvider,
  // Add other mocked components here as needed
};
