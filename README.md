# Universal Translator

## Overview

Universal Translator is a production-ready, real-time translation application that seamlessly integrates with communication platforms like Discord, Zoom, Microsoft Teams, and more. It captures audio from your microphone or system, translates it in real-time, and outputs the translated speech through virtual audio devices.

## 🚀 Key Features

### Real-Time Translation Pipeline

- **Audio Capture**: High-quality microphone and system audio capture
- **Speech-to-Text**: Advanced STT with multiple service support
- **Translation**: Context-aware translation using premium AI services
- **Text-to-Speech**: Natural voice synthesis with emotional expression
- **Virtual Audio Routing**: Seamless integration with communication platforms

### Multi-Service Integration

- **Translation Services**: DeepL, OpenAI GPT-4o, Google Translate, Azure Translator
- **Speech Services**: Azure Speech Services, Google Cloud Speech-to-Text
- **Voice Synthesis**: Azure TTS, Google Cloud TTS with premium neural voices
- **Intelligent Fallback**: Automatic service switching for maximum reliability

### Platform Integration

- **Communication Apps**: Discord, Zoom, Microsoft Teams, Skype, Google Meet, Slack
- **Virtual Audio**: Automatic setup of VB-Audio Cable (Windows), BlackHole (macOS), PulseAudio (Linux)
- **Cross-Platform**: Full support for Windows 10/11, macOS 10.15+, Linux Ubuntu 18.04+

### Advanced Features

- **Context-Aware Translation**: Maintains conversation context for better accuracy
- **Custom Vocabulary**: Add technical terms and names for consistent translation
- **Quality Optimization**: Real-time translation quality assessment and improvement
- **Low Latency**: End-to-end processing in under 2-4 seconds
- **Offline Capabilities**: Cached translations for common phrases
- **Security First**: Local API key encryption and secure communication

## 📦 Installation

### Quick Install

#### Windows

```bash
# Download and run the installer
wget https://github.com/your-repo/universal-translator/releases/latest/download/Universal-Translator-Setup.exe
# Run installer with admin privileges for VB-Audio Cable installation
```

#### macOS

```bash
# Download and install
wget https://github.com/your-repo/universal-translator/releases/latest/download/Universal-Translator.dmg
# Mount DMG and drag to Applications folder
# BlackHole audio driver will be installed on first run
```

#### Linux

```bash
# Download AppImage
wget https://github.com/your-repo/universal-translator/releases/latest/download/Universal-Translator.AppImage
chmod +x Universal-Translator.AppImage
./Universal-Translator.AppImage

# Or install DEB package (Ubuntu/Debian)
wget https://github.com/your-repo/universal-translator/releases/latest/download/universal-translator.deb
sudo dpkg -i universal-translator.deb
```

### System Requirements

- **OS**: Windows 10/11, macOS 10.15+, or Linux (Ubuntu 18.04+)
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 500MB free space
- **Internet**: Stable broadband connection for translation services
- **Audio**: Built-in or external microphone
- **Customer Support**: Multilingual support without language barriers
- **Educational Settings**: Language learning and international classrooms
- **International Collaboration**: Seamless communication across language boundaries

## Setup Instructions

### Prerequisites

- Node.js 18 or later
- API keys for services:
  - DeepL API key
  - OpenAI API key (for GPT-4o)
  - Google Cloud API keys (Translation, Speech, TTS)
  - Azure API keys (Translator, Speech, TTS)
  - ElevenLabs API key

### Installation

1. Clone the repository
2. Install dependencies:

   ```
   npm install
   ```

3. Set up your API keys:

   ```
   node setup-config.js
   ```

   Or manually edit the `.env` file with your API keys.

### Configuration

The application uses several configuration files located in the `config` directory:

- `translation-config.json`: Main configuration for all translation services
- Individual service configs: `deepl-config.json`, `gpt4o-config.json`, etc.

### Testing

The application uses a comprehensive testing strategy to ensure quality and reliability:

#### Test Types

- **Unit Tests**: Test individual components in isolation
- **Integration Tests**: Test interactions between components
- **API Tests**: Test external service integrations
- **Performance Tests**: Measure latency, throughput, and resource usage
- **E2E Tests**: Test complete user workflows

#### Running Tests

```bash
# Run all tests
npm test

# Run specific test types
npm run test:unit
npm run test:integration
npm run test:api
npm run test:performance
npm run test:e2e

# Run tests for specific components
npm run test:translation
npm run test:stt
npm run test:tts

# Run with coverage reporting
npm run test:coverage
npm run test:coverage:report  # Generate HTML report

# Run the complete test suite with reporting
npm run test:all
```

#### Mock Testing (No API keys required)

```bash
npm run test:translation-mock
```

#### Live Testing (Requires API keys)

```
npm run test:translation
```

## Architecture

### Core Components

1. **Translation Manager**: Coordinates between different translation services
2. **Language Pair Optimizer**: Selects the best service for specific language pairs
3. **Translation Quality**: Evaluates and improves translation quality
4. **Context Manager**: Maintains conversation context for contextual translation
5. **Translation Cache**: Stores and retrieves previous translations

### Service Integrations

- **DeepL Service**: High-quality translations, especially for European languages
- **GPT-4o Translator**: Context-aware translation with cultural adaptation
- **Google Translate**: Broad language coverage with reliable performance
- **Azure Translator**: Enterprise-grade reliability and additional features

## Development

To contribute to the project:

1. Setup your development environment with the required API keys
2. Run the mock tests to ensure everything is working properly
3. Make your changes and run tests again
4. Submit a pull request with a detailed description of your changes

## License

ISC

A real-time multi-platform translation application that provides seamless translation during voice calls on any communication platform.

## Features

- Real-time speech-to-text conversion
- Multi-language translation support
- Text-to-speech output
- Cross-platform compatibility
- Intuitive user interface

## Prerequisites

- Node.js (v16 or later)
- npm (v7 or later) or yarn
- Git (for cloning the repository)

## Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd translation-app
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

   or

   ```bash
   yarn install
   ```

3. **Configure API Keys**

   - Open the application
   - Click on the settings (gear) icon
   - Enter your API keys for the translation services you want to use (Google Cloud, DeepL, or Microsoft Azure)
   - Save the settings

## Running the Application

### Development Mode

```bash
npm start
```

or

```bash
yarn start
```

### Building for Production

#### macOS

```bash
npm run package-mac
```

#### Windows

```bash
npm run package-win
```

#### Linux

```bash
npm run package-linux
```

## Usage

1. Select the source and target languages
2. Click the "Start Listening" button to begin recording
3. Speak into your microphone
4. The translated text will appear in the target language box
5. Click the speaker icon to hear the translation
6. Click "Stop" to end the recording session

## Supported Languages

The application supports over 100 languages including:

- English
- Spanish
- French
- German
- Chinese (Simplified/Traditional)
- Japanese
- Korean
- Russian
- Arabic
- And many more...

## Troubleshooting

### Microphone Access Issues

- Ensure the application has permission to access your microphone
- Check your system settings to verify the correct input device is selected
- Try disconnecting and reconnecting your microphone

### Translation Not Working

- Verify your internet connection
- Check that you've entered valid API keys in the settings
- Ensure you have sufficient credits with your translation service provider

### Audio Playback Issues

- Check your system's audio output settings
- Ensure the correct output device is selected in the application settings
- Verify that your speakers or headphones are properly connected

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please open an issue in the GitHub repository or contact the development team.
