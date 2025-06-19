# Universal Translator - User Setup Guide

## Overview

The Universal Translator is a real-time multi-platform translation application that captures audio from your microphone or system audio, translates it in real-time, and can output the translated audio to communication platforms like Discord, Zoom, Teams, and more.

## System Requirements

### Minimum Requirements

- **Operating System**: Windows 10/11, macOS 10.15+, or Linux (Ubuntu 18.04+)
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 500MB free space
- **Internet**: Stable broadband connection for translation services
- **Audio**: Built-in or external microphone

### Supported Platforms

- **Communication Apps**: Discord, Zoom, Microsoft Teams, Skype, Google Meet, Slack
- **Translation Services**: DeepL, OpenAI GPT-4o, Google Translate, Azure Translator
- **Speech Services**: Azure Speech Services, Google Cloud Speech-to-Text

## Installation

### Windows Installation

1. **Download the Installer**
   - Download `Universal-Translator-Setup.exe` from the releases page
   - Right-click and select "Run as administrator"

2. **Installation Process**
   - Follow the installation wizard
   - When prompted, allow the installation of VB-Audio Virtual Cable
   - This may require a system restart

3. **Post-Installation Setup**
   - Launch the Universal Translator
   - Follow the setup wizard to configure audio devices
   - Enter your API keys for translation services

### macOS Installation

1. **Download the Installer**
   - Download `Universal-Translator.dmg` from the releases page
   - Double-click to mount the disk image

2. **Installation Process**
   - Drag Universal Translator to Applications folder
   - The app will prompt to install BlackHole audio driver
   - Enter your admin password when prompted

3. **Permissions Setup**
   - Go to System Preferences > Security & Privacy
   - Allow microphone access for Universal Translator
   - Allow screen recording if using system audio capture

### Linux Installation

1. **Install Dependencies**

   ```bash
   # Ubuntu/Debian
   sudo apt update
   sudo apt install pulseaudio pulseaudio-utils

   # Fedora/CentOS
   sudo dnf install pulseaudio pulseaudio-utils
   ```

2. **Install Universal Translator**

   ```bash
   # Download and install .deb package
   wget https://github.com/your-repo/universal-translator/releases/latest/download/universal-translator.deb
   sudo dpkg -i universal-translator.deb

   # Or install .AppImage
   wget https://github.com/your-repo/universal-translator/releases/latest/download/Universal-Translator.AppImage
   chmod +x Universal-Translator.AppImage
   ./Universal-Translator.AppImage
   ```

3. **Configure Audio**
   - The app will automatically set up PulseAudio virtual sinks
   - No additional drivers required

## Initial Setup

### 1. API Configuration

The Universal Translator requires API keys for translation services. You can use one or multiple services:

#### Required: At least one translation service

- **DeepL** (Recommended for European languages)
- **OpenAI GPT-4o** (Best for context-aware translation)
- **Google Translate** (Good general-purpose option)
- **Azure Translator** (Enterprise-grade option)

#### Optional: Speech services (for better quality)

- **Azure Speech Services** (Recommended)
- **Google Cloud Speech-to-Text**

### 2. Audio Device Setup

1. **Launch Universal Translator**
2. **Go to Settings > Audio**
3. **Configure Input Device**:
   - Select your microphone from the dropdown
   - Test the audio level using the "Test Input" button
   - Adjust microphone sensitivity if needed

4. **Configure Output Device**:
   - **For Communication Apps**: Select the virtual audio device
     - Windows: "CABLE Input (VB-Audio Virtual Cable)"
     - macOS: "BlackHole 2ch"
     - Linux: "virtual_translation_sink"

### 3. Communication Platform Setup

#### Discord Setup

1. Open Discord Settings (gear icon)
2. Go to Voice & Video
3. Set Input Device to your microphone
4. Set Output Device to Virtual Audio Cable
5. Test with a friend or in a voice channel

#### Zoom Setup

1. Open Zoom Settings
2. Go to Audio
3. Set Microphone to Virtual Audio Cable
4. Set Speaker to your regular speakers/headphones
5. Test using "Test Mic" feature

#### Microsoft Teams Setup

1. Open Teams Settings (gear icon)
2. Go to Devices
3. Set Microphone to Virtual Audio Cable
4. Set Speaker to your regular speakers/headphones
5. Test in a call or using the test call feature

#### Google Meet Setup

1. Join a meeting or start a test meeting
2. Click the settings gear in the call
3. Set Microphone to Virtual Audio Cable
4. Set Speakers to your regular speakers/headphones

## Usage Guide

### Basic Operation

1. **Start the Application**
   - Launch Universal Translator
   - Ensure all services show as "Connected" in the status bar

2. **Configure Translation**
   - Select source language (or enable auto-detect)
   - Select target language
   - Choose preferred translation service
   - Enable/disable text-to-speech output

3. **Start Translation**
   - Click "Start Translation" or use hotkey (Ctrl+Shift+T)
   - Speak into your microphone
   - Translated audio will be output to the virtual device

4. **Monitor Translation**
   - View real-time transcription in the main window
   - See translation confidence scores
   - Check latency indicators

### Advanced Features

#### Context-Aware Translation

- Enable "Context Mode" for better translation of conversations
- The app remembers recent translations for context
- Particularly useful for technical or domain-specific conversations

#### Multi-Service Fallback

- Configure multiple translation services
- App automatically switches if primary service fails
- Improves reliability during important calls

#### Custom Vocabulary

- Add technical terms or names to custom dictionary
- Ensures consistent translation of specific terms
- Access via Settings > Translation > Custom Vocabulary

#### Hotkeys

- **Start/Stop Translation**: Ctrl+Shift+T
- **Toggle Microphone**: Ctrl+Shift+M
- **Quick Language Switch**: Ctrl+Shift+L
- **Emergency Stop**: Ctrl+Shift+E

## Troubleshooting

### Audio Issues

#### "No Microphone Detected"

1. Check microphone is connected and working
2. Verify microphone permissions in system settings
3. Restart the application
4. Try selecting a different input device

#### "Virtual Audio Device Not Found"

1. **Windows**: Reinstall VB-Audio Cable
   - Download from: <https://vb-audio.com/Cable/>
   - Run as administrator
   - Restart computer after installation

2. **macOS**: Reinstall BlackHole
   - Download from: <https://github.com/ExistentialAudio/BlackHole>
   - Follow installation instructions
   - Restart Audio MIDI Setup

3. **Linux**: Recreate virtual sink

   ```bash
   pulseaudio -k
   pulseaudio --start
   ```

#### "Audio Quality Poor"

1. Check microphone positioning and quality
2. Reduce background noise
3. Adjust microphone sensitivity in settings
4. Enable noise suppression if available

### Translation Issues

#### "Translation Service Error"

1. Check internet connection
2. Verify API keys are correct and active
3. Check service status at provider websites
4. Try switching to a different service

#### "Poor Translation Quality"

1. Speak clearly and at moderate pace
2. Reduce background noise
3. Try a different translation service
4. Enable context mode for conversations
5. Add technical terms to custom vocabulary

#### "High Latency"

1. Check internet connection speed
2. Close unnecessary applications
3. Try a faster translation service (Google is usually fastest)
4. Reduce audio buffer size in advanced settings

### Performance Issues

#### "High CPU Usage"

1. Close unnecessary applications
2. Reduce translation quality settings
3. Disable real-time effects if not needed
4. Check for system updates

#### "Memory Issues"

1. Restart the application periodically
2. Clear translation cache (Settings > Advanced)
3. Reduce buffer sizes
4. Close other memory-intensive applications

## Support and Updates

### Getting Help

- **Documentation**: Check the docs folder for detailed guides
- **Community**: Join our Discord server for community support
- **Issues**: Report bugs on GitHub
- **Email**: <support@universaltranslator.app>

### Automatic Updates

- The app checks for updates on startup
- Updates are downloaded and installed automatically
- You can disable auto-updates in Settings > General

### Manual Updates

1. Download the latest version from releases page
2. Close Universal Translator
3. Install the new version over the existing installation
4. Your settings and API keys will be preserved

## Privacy and Security

### Data Handling

- Audio is processed in real-time and not stored locally
- Translation text may be temporarily cached for context
- No personal data is transmitted to our servers

### API Keys

- All API keys are encrypted and stored locally
- Keys are never transmitted to our servers
- You can revoke access by changing keys in service provider dashboards

### Network Security

- All communication with translation services uses HTTPS
- No telemetry data is collected without explicit consent
- App can work completely offline with cached translations

## License and Legal

Universal Translator is released under the MIT License. See LICENSE file for details.

Third-party licenses:

- VB-Audio Virtual Cable: Freeware license
- BlackHole: GPL-3.0 License
- Electron: MIT License
- Various npm packages: See package.json for individual licenses
