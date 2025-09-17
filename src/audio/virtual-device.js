const { EventEmitter } = require('events');
const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');
const path = require('path');
const fs = require('fs');
const execAsync = promisify(exec);

class VirtualAudioDevice extends EventEmitter {
  constructor() {
    super();
    this.platform = os.platform();
    this.isInstalled = false;
    this.deviceName = this.getDefaultDeviceName();
    this.installPath = this.getInstallPath();
  }

  getDefaultDeviceName() {
    switch (this.platform) {
      case 'win32':
        return 'CABLE Input (VB-Audio Virtual Cable)';
      case 'darwin':
        return 'BlackHole 2ch';
      case 'linux':
        return 'null';
      default:
        return 'Virtual Audio Device';
    }
  }

  getInstallPath() {
    const homeDir = os.homedir();
    switch (this.platform) {
      case 'win32':
        return path.join(homeDir, 'AppData', 'Local', 'VB', 'CABLE');
      case 'darwin':
        return '/Library/Audio/Plug-Ins/HAL/BlackHole2ch.driver';
      case 'linux':
        return '/usr/share/alsa/alsa.conf.d/50-pulseaudio.conf';
      default:
        return '';
    }
  }

  /**
   * Check if the virtual audio device is installed
   * @returns {Promise<boolean>}
   */
  async checkInstallation() {
    try {
      if (this.platform === 'win32') {
        // Check if VB-Cable is installed on Windows
        const { stdout } = await execAsync(
          'reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\VB: Cable - A & VFX-software.com (64bit)" /v DisplayName'
        );
        this.isInstalled = stdout.includes('VB-Cable');
      } else if (this.platform === 'darwin') {
        // Check if BlackHole is installed on macOS
        this.isInstalled = fs.existsSync(this.installPath);
      } else if (this.platform === 'linux') {
        // Check if PulseAudio is configured for virtual devices
        const { stdout } = await execAsync('pactl list short sinks | grep -i virtual');
        this.isInstalled = stdout.trim().length > 0;
      }
      return this.isInstalled;
    } catch (error) {
      this.emit(
        'error',
        new Error(`Failed to check virtual audio device installation: ${error.message}`)
      );
      return false;
    }
  }

  /**
   * Install the virtual audio device
   * @returns {Promise<boolean>}
   */
  async install() {
    if (await this.checkInstallation()) {
      this.emit('log', 'Virtual audio device is already installed');
      return true;
    }

    try {
      if (this.platform === 'win32') {
        await this.installWindows();
      } else if (this.platform === 'darwin') {
        await this.installMacOS();
      } else if (this.platform === 'linux') {
        await this.installLinux();
      }

      this.isInstalled = true;
      this.emit('installed');
      return true;
    } catch (error) {
      this.emit('error', new Error(`Failed to install virtual audio device: ${error.message}`));
      return false;
    }
  }

  async installWindows() {
    this.emit('log', 'Downloading VB-Cable installer...');
    const downloadUrl = 'https://download.vb-audio.com/Download_CABLE/VBCABLE_Driver_Pack43.zip';
    const downloadPath = path.join(os.tmpdir(), 'vbcable_installer.zip');

    // Download the installer
    await this.downloadFile(downloadUrl, downloadPath);

    // Extract and run the installer
    this.emit('log', 'Installing VB-Cable...');
    const extractPath = path.join(os.tmpdir(), 'vbcable_installer');

    // Create extraction directory
    if (!fs.existsSync(extractPath)) {
      fs.mkdirSync(extractPath, { recursive: true });
    }

    // Extract the zip file
    await execAsync(
      `powershell -command "Expand-Archive -Path '${downloadPath}' -DestinationPath '${extractPath}' -Force"`
    );

    // Run the installer (elevated)
    const installerPath = path.join(extractPath, 'VBCABLE_Driver', 'VBCABLE_Setup_x64.exe');
    await execAsync(
      `powershell -Command "Start-Process -FilePath '${installerPath}' -ArgumentList '-i', '-s' -Verb RunAs -Wait"`
    );

    // Clean up
    fs.unlinkSync(downloadPath);
    fs.rmdirSync(extractPath, { recursive: true });

    this.emit(
      'log',
      'VB-Cable installation completed. Please restart your computer for the changes to take effect.'
    );
  }

  async installMacOS() {
    this.emit('log', 'Installing BlackHole virtual audio device...');

    // Download BlackHole
    const downloadUrl =
      'https://github.com/ExistentialAudio/BlackHole/releases/download/2.2.9/BlackHole.2.2.9.pkg';
    const downloadPath = path.join(os.tmpdir(), 'BlackHole.pkg');

    // Download the installer
    await this.downloadFile(downloadUrl, downloadPath);

    // Install BlackHole
    await execAsync(`sudo installer -pkg "${downloadPath}" -target /`);

    // Clean up
    fs.unlinkSync(downloadPath);

    this.emit(
      'log',
      'BlackHole installation completed. Please restart your computer for the changes to take effect.'
    );
  }

  async installLinux() {
    this.emit('log', 'Configuring PulseAudio for virtual audio...');

    // Install required packages
    await execAsync(
      'sudo apt-get update && sudo apt-get install -y pulseaudio pulseaudio-utils pavucontrol'
    );

    // Create a virtual sink
    await execAsync(
      'pactl load-module module-null-sink sink_name=VirtualSink sink_properties=device.description=VirtualSink'
    );

    // Make the configuration persistent
    const configDir = path.dirname(this.installPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    const configContent = `
# Virtual audio sink configuration
load-module module-null-sink sink_name=VirtualSink sink_properties=device.description=VirtualSink
`;

    fs.writeFileSync(this.installPath, configContent);

    this.emit('log', 'Virtual audio device configured. You may need to restart PulseAudio.');
  }

  async downloadFile(url, dest) {
    const https = require('https');
    const fs = require('fs');

    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);

      https
        .get(url, (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`Failed to download file: ${response.statusCode}`));
            return;
          }

          response.pipe(file);

          file.on('finish', () => {
            file.close();
            resolve();
          });

          file.on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
          });
        })
        .on('error', (err) => {
          fs.unlink(dest, () => {});
          reject(err);
        });
    });
  }

  /**
   * Set the virtual audio device as the default output
   * @returns {Promise<boolean>}
   */
  async setAsDefault() {
    if (!(await this.checkInstallation())) {
      this.emit('error', new Error('Virtual audio device is not installed'));
      return false;
    }

    try {
      if (this.platform === 'win32') {
        await execAsync(`nircmd setdefaultsounddevice "${this.deviceName}"`);
      } else if (this.platform === 'darwin') {
        await execAsync(`osascript -e 'set volume output volume 100'`);
        // Additional macOS specific commands to set default audio device
      } else if (this.platform === 'linux') {
        await execAsync(`pactl set-default-sink VirtualSink`);
      }

      this.emit('log', `Set ${this.deviceName} as default audio output`);
      return true;
    } catch (error) {
      this.emit(
        'error',
        new Error(`Failed to set virtual audio device as default: ${error.message}`)
      );
      return false;
    }
  }

  /**
   * Get the name of the virtual audio device
   * @returns {string}
   */
  getDeviceName() {
    return this.deviceName;
  }

  /**
   * Clean up resources
   */
  async destroy() {
    this.removeAllListeners();
  }
}

module.exports = VirtualAudioDevice;
