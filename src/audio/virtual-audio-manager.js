/**
 * Virtual Audio Device Manager
 * Handles VB-Audio Cable installation and configuration
 */

const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const os = require('os');
const https = require('https');

class VirtualAudioManager {
    constructor() {
        this.platform = os.platform();
        this.vbCableInstalled = false;
        this.virtualDeviceId = null;
        this.downloadUrls = {
            win32: 'https://download.vb-audio.com/Download_CABLE/VBCABLE_Driver_Pack43.zip',
            darwin: 'https://github.com/ExistentialAudio/BlackHole/releases/download/v0.4.0/BlackHole.v0.4.0.pkg',
            linux: null // Use PulseAudio virtual sink
        };
    }

    /**
     * Check if virtual audio device is available
     */
    async isVirtualDeviceAvailable() {
        try {
            switch (this.platform) {
                case 'win32':
                    return await this.checkWindowsVBCable();
                case 'darwin':
                    return await this.checkMacOSBlackHole();
                case 'linux':
                    return await this.checkLinuxPulseAudio();
                default:
                    return false;
            }
        } catch (error) {
            console.error('Error checking virtual device:', error);
            return false;
        }
    }

    /**
     * Install virtual audio device
     */
    async installVirtualDevice() {
        try {
            switch (this.platform) {
                case 'win32':
                    return await this.installWindowsVBCable();
                case 'darwin':
                    return await this.installMacOSBlackHole();
                case 'linux':
                    return await this.setupLinuxVirtualSink();
                default:
                    throw new Error(`Platform ${this.platform} not supported`);
            }
        } catch (error) {
            console.error('Error installing virtual device:', error);
            throw error;
        }
    }

    /**
     * Windows VB-Cable installation
     */
    async installWindowsVBCable() {
        const tempDir = path.join(os.tmpdir(), 'vb-cable');
        const zipPath = path.join(tempDir, 'vbcable.zip');

        // Create temp directory
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Download VB-Cable
        console.log('Downloading VB-Audio Cable...');
        await this.downloadFile(this.downloadUrls.win32, zipPath);

        // Extract and install
        console.log('Extracting VB-Audio Cable...');
        await this.extractZip(zipPath, tempDir);

        // Run installer with admin privileges
        console.log('Installing VB-Audio Cable (requires admin privileges)...');
        const installerPath = path.join(tempDir, 'VBCABLE_Setup_x64.exe');

        return new Promise((resolve, reject) => {
            const installer = spawn('powershell', [
                '-Command',
                `Start-Process -FilePath "${installerPath}" -Verb RunAs -Wait`
            ], { stdio: 'inherit' });

            installer.on('close', (code) => {
                if (code === 0) {
                    this.vbCableInstalled = true;
                    resolve(true);
                } else {
                    reject(new Error(`VB-Cable installation failed with code ${code}`));
                }
            });
        });
    }

    /**
     * macOS BlackHole installation
     */
    async installMacOSBlackHole() {
        const tempDir = path.join(os.tmpdir(), 'blackhole');
        const pkgPath = path.join(tempDir, 'BlackHole.pkg');

        // Create temp directory
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Download BlackHole
        console.log('Downloading BlackHole...');
        await this.downloadFile(this.downloadUrls.darwin, pkgPath);

        // Install package
        console.log('Installing BlackHole (requires admin password)...');

        return new Promise((resolve, reject) => {
            const installer = spawn('sudo', ['installer', '-pkg', pkgPath, '-target', '/'], {
                stdio: 'inherit'
            });

            installer.on('close', (code) => {
                if (code === 0) {
                    this.vbCableInstalled = true;
                    resolve(true);
                } else {
                    reject(new Error(`BlackHole installation failed with code ${code}`));
                }
            });
        });
    }

    /**
     * Linux PulseAudio virtual sink setup
     */
    async setupLinuxVirtualSink() {
        console.log('Setting up PulseAudio virtual sink...');

        return new Promise((resolve, reject) => {
            // Create virtual sink
            const createSink = spawn('pactl', [
                'load-module',
                'module-null-sink',
                'sink_name=virtual_translation_sink',
                'sink_properties=device.description="Translation_Virtual_Sink"'
            ]);

            createSink.on('close', (code) => {
                if (code === 0) {
                    // Create virtual source (loopback)
                    const createSource = spawn('pactl', [
                        'load-module',
                        'module-loopback',
                        'source=virtual_translation_sink.monitor',
                        'sink=@DEFAULT_SINK@'
                    ]);

                    createSource.on('close', (sourceCode) => {
                        if (sourceCode === 0) {
                            this.vbCableInstalled = true;
                            resolve(true);
                        } else {
                            reject(new Error(`Virtual source creation failed with code ${sourceCode}`));
                        }
                    });
                } else {
                    reject(new Error(`Virtual sink creation failed with code ${code}`));
                }
            });
        });
    }

    /**
     * Check Windows VB-Cable
     */
    async checkWindowsVBCable() {
        return new Promise((resolve) => {
            exec('wmic sounddev get name', (error, stdout) => {
                if (error) {
                    resolve(false);
                    return;
                }

                const devices = stdout.toLowerCase();
                const hasVBCable = devices.includes('cable input') || devices.includes('cable output');
                this.vbCableInstalled = hasVBCable;
                resolve(hasVBCable);
            });
        });
    }

    /**
     * Check macOS BlackHole
     */
    async checkMacOSBlackHole() {
        return new Promise((resolve) => {
            exec('system_profiler SPAudioDataType', (error, stdout) => {
                if (error) {
                    resolve(false);
                    return;
                }

                const hasBlackHole = stdout.toLowerCase().includes('blackhole');
                this.vbCableInstalled = hasBlackHole;
                resolve(hasBlackHole);
            });
        });
    }

    /**
     * Check Linux PulseAudio virtual sink
     */
    async checkLinuxPulseAudio() {
        return new Promise((resolve) => {
            exec('pactl list sinks short', (error, stdout) => {
                if (error) {
                    resolve(false);
                    return;
                }

                const hasVirtualSink = stdout.includes('virtual_translation_sink');
                this.vbCableInstalled = hasVirtualSink;
                resolve(hasVirtualSink);
            });
        });
    }

    /**
     * Get available audio devices
     */
    async getAudioDevices() {
        switch (this.platform) {
            case 'win32':
                return await this.getWindowsDevices();
            case 'darwin':
                return await this.getMacOSDevices();
            case 'linux':
                return await this.getLinuxDevices();
            default:
                return { input: [], output: [] };
        }
    }

    /**
     * Get Windows audio devices
     */
    async getWindowsDevices() {
        return new Promise((resolve) => {
            exec('wmic sounddev get name,deviceid', (error, stdout) => {
                if (error) {
                    resolve({ input: [], output: [] });
                    return;
                }

                const devices = this.parseWindowsDevices(stdout);
                resolve(devices);
            });
        });
    }

    /**
     * Get macOS audio devices
     */
    async getMacOSDevices() {
        return new Promise((resolve) => {
            exec('system_profiler SPAudioDataType -json', (error, stdout) => {
                if (error) {
                    resolve({ input: [], output: [] });
                    return;
                }

                try {
                    const data = JSON.parse(stdout);
                    const devices = this.parseMacOSDevices(data);
                    resolve(devices);
                } catch (parseError) {
                    resolve({ input: [], output: [] });
                }
            });
        });
    }

    /**
     * Get Linux audio devices
     */
    async getLinuxDevices() {
        return new Promise((resolve) => {
            exec('pactl list sources short && pactl list sinks short', (error, stdout) => {
                if (error) {
                    resolve({ input: [], output: [] });
                    return;
                }

                const devices = this.parseLinuxDevices(stdout);
                resolve(devices);
            });
        });
    }

    /**
     * Download file helper
     */
    async downloadFile(url, outputPath) {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(outputPath);

            https.get(url, (response) => {
                response.pipe(file);

                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            }).on('error', (error) => {
                fs.unlink(outputPath, () => { }); // Delete file on error
                reject(error);
            });
        });
    }

    /**
     * Extract ZIP file helper
     */
    async extractZip(zipPath, extractPath) {
        return new Promise((resolve, reject) => {
            const extract = spawn('powershell', [
                '-Command',
                `Expand-Archive -Path "${zipPath}" -DestinationPath "${extractPath}" -Force`
            ]);

            extract.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Extraction failed with code ${code}`));
                }
            });
        });
    }

    /**
     * Parse device lists for different platforms
     */
    parseWindowsDevices(output) {
        const lines = output.split('\n').filter(line => line.trim());
        const devices = { input: [], output: [] };

        lines.forEach(line => {
            if (line.includes('Name')) return;

            const parts = line.trim().split(/\s+/);
            if (parts.length > 0) {
                const deviceName = parts.join(' ');

                // Classify as input or output based on name patterns
                if (deviceName.toLowerCase().includes('microphone') ||
                    deviceName.toLowerCase().includes('input') ||
                    deviceName.toLowerCase().includes('cable output')) {
                    devices.input.push({
                        id: deviceName,
                        name: deviceName,
                        type: 'input'
                    });
                } else if (deviceName.toLowerCase().includes('speakers') ||
                    deviceName.toLowerCase().includes('output') ||
                    deviceName.toLowerCase().includes('cable input')) {
                    devices.output.push({
                        id: deviceName,
                        name: deviceName,
                        type: 'output'
                    });
                }
            }
        });

        return devices;
    }

    parseMacOSDevices(data) {
        const devices = { input: [], output: [] };

        // Parse macOS audio device data
        if (data.SPAudioDataType) {
            data.SPAudioDataType.forEach(device => {
                if (device._name) {
                    const deviceInfo = {
                        id: device._name,
                        name: device._name,
                        type: device._name.toLowerCase().includes('input') ? 'input' : 'output'
                    };

                    if (deviceInfo.type === 'input') {
                        devices.input.push(deviceInfo);
                    } else {
                        devices.output.push(deviceInfo);
                    }
                }
            });
        }

        return devices;
    }

    parseLinuxDevices(output) {
        const devices = { input: [], output: [] };
        const lines = output.split('\n');

        lines.forEach(line => {
            if (line.trim()) {
                const parts = line.split('\t');
                if (parts.length >= 2) {
                    const deviceInfo = {
                        id: parts[1],
                        name: parts[1],
                        type: line.includes('source') ? 'input' : 'output'
                    };

                    if (deviceInfo.type === 'input') {
                        devices.input.push(deviceInfo);
                    } else {
                        devices.output.push(deviceInfo);
                    }
                }
            }
        });

        return devices;
    }

    /**
     * Configure virtual device for translation
     */
    async configureVirtualDevice() {
        if (!this.vbCableInstalled) {
            throw new Error('Virtual audio device not installed');
        }

        // Get virtual device ID
        const devices = await this.getAudioDevices();

        // Find virtual device
        let virtualDevice = null;

        switch (this.platform) {
            case 'win32':
                virtualDevice = devices.output.find(d =>
                    d.name.toLowerCase().includes('cable input')
                );
                break;
            case 'darwin':
                virtualDevice = devices.output.find(d =>
                    d.name.toLowerCase().includes('blackhole')
                );
                break;
            case 'linux':
                virtualDevice = devices.output.find(d =>
                    d.name.includes('virtual_translation_sink')
                );
                break;
        }

        if (!virtualDevice) {
            throw new Error('Virtual audio device not found');
        }

        this.virtualDeviceId = virtualDevice.id;
        return virtualDevice;
    }

    /**
     * Get status of virtual device
     */
    getStatus() {
        return {
            platform: this.platform,
            installed: this.vbCableInstalled,
            virtualDeviceId: this.virtualDeviceId,
            supported: this.platform in this.downloadUrls || this.platform === 'linux'
        };
    }
}

module.exports = VirtualAudioManager;
