const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add support for additional file extensions
config.resolver.assetExts.push(
  // Audio formats
  'wav',
  'mp3',
  'aac',
  'm4a',
  'ogg',
  'flac',
  // Video formats
  'mp4',
  'mov',
  'avi',
  'webm',
  // Other formats
  'db',
  'sqlite',
  'sqlite3'
);

// Add support for source map extensions
config.resolver.sourceExts.push(
  'jsx',
  'js',
  'ts',
  'tsx',
  'json',
  'cjs',
  'mjs'
);

// Configure transformer for better performance
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('metro-react-native-babel-transformer'),
  minifierConfig: {
    mangle: {
      keep_fnames: true,
    },
    output: {
      ascii_only: true,
      quote_keys: true,
      wrap_iife: true,
    },
    sourceMap: {
      includeSources: false,
    },
    toplevel: false,
    compress: {
      reduce_funcs: false,
    },
  },
};

// Configure serializer for better bundle optimization
config.serializer = {
  ...config.serializer,
  customSerializer: null,
};

// Configure watcher options
config.watchFolders = [
  // Add any additional folders to watch
];

module.exports = config;