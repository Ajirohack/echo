module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      [
        'module-resolver',
        {
          root: ['./src'],
          extensions: ['.ios.js', '.android.js', '.js', '.jsx', '.ts', '.tsx', '.json'],
          alias: {
            '@': './src',
            '@components': './src/components',
            '@screens': './src/screens',
            '@providers': './src/providers',
            '@services': './src/services',
            '@utils': './src/utils',
            '@constants': './src/constants',
            '@assets': './src/assets'
          }
        }
      ]
    ]
  };
};