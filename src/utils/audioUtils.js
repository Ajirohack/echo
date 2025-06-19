const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const logger = require('./logger');

class AudioUtils {
  constructor() {
    this.platform = os.platform();
    this.audioDevices = [];
    this.virtualDevices = [];
  }

  /**
   * Get audio devices for the current platform
   */
  async getAudioDevices() {
    try {
      switch (this.platform) {
        case 'darwin': // macOS
          return await this.getMacAudioDevices();
        case 'win32': // Windows
          return await this.getWindowsAudioDevices();
        case 'linux':
          return await this.getLinuxAudioDevices();
        default:
          logger.warn(`Unsupported platform: ${this.platform}`);
          return { inputDevices: [], outputDevices: [], virtualDevices: [] };
      }
    } catch (error) {
      logger.error('Error getting audio devices:', error);
      return { inputDevices: [], outputDevices: [], virtualDevices: [], error: error.message };
    }
  }

  /**
   * Get audio devices on macOS
   */
  async getMacAudioDevices() {
    try {
      // Use system_profiler to get audio devices on macOS
      const { stdout } = await execPromise('system_profiler SPAudioDataType -json');
      const audioData = JSON.parse(stdout);
      
      const inputDevices = [];
      const outputDevices = [];
      const virtualDevices = [];
      
      if (audioData.SPAudioDataType && Array.isArray(audioData.SPAudioDataType)) {
        audioData.SPAudioDataType.forEach(device => {
          const isInput = device._items.some(item => item.coreaudio_device_input);
          const isOutput = device._items.some(item => item.coreaudio_device_output);
          const isVirtual = device._name.match(/VB-Audio|BlackHole|SoundFlower|Loopback/i);
          
          const deviceInfo = {
            id: device._name.replace(/\s+/g, '_').toLowerCase(),
            name: device._name,
            manufacturer: device.coreaudio_device_manufacturer || 'Unknown',
            sampleRate: device.coreaudio_sample_rate || 44100,
            isDefault: false, // Need additional logic to determine default
            isVirtual
          };
          
          if (isInput) {
            inputDevices.push(deviceInfo);
          }
          
          if (isOutput) {
            outputDevices.push(deviceInfo);
          }
          
          if (isVirtual) {
            virtualDevices.push(deviceInfo);
          }
        });
      }
      
      return { inputDevices, outputDevices, virtualDevices };
    } catch (error) {
      logger.error('Error getting macOS audio devices:', error);
      return { inputDevices: [], outputDevices: [], virtualDevices: [], error: error.message };
    }
  }

  /**
   * Get audio devices on Windows
   */
  async getWindowsAudioDevices() {
    try {
      // PowerShell command to get audio devices using Windows Core Audio APIs
      const psCommand = `
      $ErrorActionPreference = 'Stop'
      
      # Get all audio devices
      $devices = Get-AudioDevice -List | Where-Object { $_.Type -eq 'Playback' -or $_.Type -eq 'Recording' }
      
      $result = @{
        inputDevices = @()
        outputDevices = @()
        virtualDevices = @()
      }
      
      foreach ($device in $devices) {
        $isVirtual = $device.Name -match 'VB-Audio|CABLE|Voicemeeter|Virtual Audio|Loopback'
        $deviceInfo = @{
          id = $device.ID
          name = $device.Name
          type = $device.Type
          isDefault = $device.Default
          isVirtual = $isVirtual
          state = $device.State
        }
        
        if ($device.Type -eq 'Recording') {
          $result.inputDevices += $deviceInfo
        } else {
          $result.outputDevices += $deviceInfo
        }
        
        if ($isVirtual) {
          $result.virtualDevices += $deviceInfo
        }
      }
      
      # Convert to JSON and output
      $result | ConvertTo-Json -Depth 10
      `;
      
      // Execute the PowerShell command
      const { stdout } = await execPromise(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCommand}"`);
      const devices = JSON.parse(stdout || '{}');
      
      // Convert to our standard format
      const formatDevices = (devs) => {
        return (devs || []).map(dev => ({
          id: dev.id,
          name: dev.name,
          type: dev.type,
          isDefault: dev.isDefault,
          isVirtual: dev.isVirtual,
          state: dev.state || 'active'
        }));
      };
      
      return {
        inputDevices: formatDevices(devices.inputDevices),
        outputDevices: formatDevices(devices.outputDevices),
        virtualDevices: formatDevices(devices.virtualDevices)
      };
    } catch (error) {
      logger.error('Error getting Windows audio devices:', error);
      return { 
        inputDevices: [], 
        outputDevices: [], 
        virtualDevices: [], 
        error: error.message 
      };
    }
  }

  /**
   * Get audio devices on Linux
   */
  async getLinuxAudioDevices() {
    try {
      // Use pacmd to get audio devices on Linux
      const { stdout } = await execPromise('pacmd list-sources | grep -e "name:" -e "device.description"');
      
      const inputDevices = [];
      const outputDevices = [];
      const virtualDevices = [];
      
      // Process the output to extract device information
      const lines = stdout.split('\n');
      let currentDevice = null;
      
      for (const line of lines) {
        if (line.includes('name:')) {
          const nameMatch = line.match(/name: <([^>]+)>/);
          if (nameMatch && nameMatch[1]) {
            const isInput = !line.includes('.monitor');
            const isVirtual = line.toLowerCase().includes('virtual') || 
                            line.toLowerCase().includes('null') ||
                            line.toLowerCase().includes('pulseaudio');
            
            currentDevice = {
              id: nameMatch[1],
              name: '',
              isInput,
              isVirtual
            };
            
            if (isInput) {
              inputDevices.push(currentDevice);
            } else {
              outputDevices.push(currentDevice);
            }
            
            if (isVirtual) {
              virtualDevices.push(currentDevice);
            }
          }
        } else if (currentDevice && line.includes('device.description')) {
          const nameMatch = line.match(/device.description = "([^"]+)"/);
          if (nameMatch && nameMatch[1]) {
            currentDevice.name = nameMatch[1];
          }
        }
      }
      
      return { inputDevices, outputDevices, virtualDevices };
    } catch (error) {
      logger.error('Error getting Linux audio devices:', error);
      return { inputDevices: [], outputDevices: [], virtualDevices: [], error: error.message };
    }
  }

  /**
   * Check if a virtual audio device is installed
   * @param {string} deviceName - Name of the virtual device to check for
   */
  async isVirtualDeviceInstalled(deviceName) {
    try {
      const { inputDevices, outputDevices } = await this.getAudioDevices();
      const allDevices = [...inputDevices, ...outputDevices];
      
      return allDevices.some(device => 
        device.name && 
        device.name.toLowerCase().includes(deviceName.toLowerCase())
      );
    } catch (error) {
      logger.error(`Error checking for virtual device ${deviceName}:`, error);
      return false;
    }
  }

  /**
   * Get installation instructions for virtual audio devices
   */
  getVirtualDeviceInstallationInstructions() {
    switch (this.platform) {
      case 'darwin': // macOS
        return {
          name: 'BlackHole',
          instructions: [
            '1. Download BlackHole from https://github.com/ExistentialAudio/BlackHole',
            '2. Open the downloaded .pkg file',
            '3. Follow the installation instructions',
            '4. Restart your computer',
            '5. Open Audio MIDI Setup to verify installation'
          ]
        };
      
      case 'win32': // Windows
        return {
          name: 'VB-Cable',
          instructions: [
            '1. Download VB-Cable from https://www.vb-audio.com/Cable/',
            '2. Run the installer as administrator',
            '3. Follow the installation instructions',
            '4. Restart your computer',
            '5. Set VB-Cable as your default playback device in Sound Settings'
          ]
        };
      
      case 'linux':
        return {
          name: 'PulseAudio',
          instructions: [
            '1. Install PulseAudio if not already installed:',
            '   - Ubuntu/Debian: sudo apt install pulseaudio',
            '   - Fedora: sudo dnf install pulseaudio',
            '2. Install module-null-sink:',
            '   - Run: pactl load-module module-null-sink sink_name=VirtualSink',
            '3. Make it persistent by adding to /etc/pulse/default.pa'
          ]
        };
      
      default:
        return {
          name: 'Virtual Audio Device',
          instructions: ['Unsupported platform for virtual audio devices']
        };
    }
  }
}

module.exports = new AudioUtils();
