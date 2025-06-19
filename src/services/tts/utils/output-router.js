/**
 * Output Router - Routes audio to different output devices
 * Handles audio output to virtual devices and system speakers
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { Speaker } = require('speaker');
const logger = require('../../../utils/logger');

class OutputRouter {
    constructor(config = {}) {
        this.config = {
            useVirtualDevice: true,
            deviceName: 'VirtualCable',
            useSystemSpeaker: true,
            ...config
        };

        this.virtualDevices = [];
        this.systemDevices = [];
        this.initialized = false;

        // Initialize the device list
        this.init();
    }

    /**
     * Initialize output devices
     */
    async init() {
        try {
            await this.detectOutputDevices();
            this.initialized = true;
        } catch (error) {
            logger.error('Error initializing output router:', error);
            this.initialized = false;
        }
    }

    /**
     * Detect available output devices
     */
    async detectOutputDevices() {
        try {
            // This is a simplified implementation
            // In a real-world app, use a more robust audio device detection system

            // For demonstration, simulate device detection
            this.virtualDevices = [
                { id: 'virtual1', name: 'VirtualCable', isVirtual: true },
                { id: 'virtual2', name: 'VB-Cable A', isVirtual: true },
                { id: 'virtual3', name: 'VB-Cable B', isVirtual: true }
            ];

            this.systemDevices = [
                { id: 'system1', name: 'System Default', isVirtual: false },
                { id: 'system2', name: 'Built-in Speaker', isVirtual: false }
            ];

            logger.info(`Detected ${this.virtualDevices.length} virtual devices and ${this.systemDevices.length} system devices`);
        } catch (error) {
            logger.error('Error detecting output devices:', error);
            this.virtualDevices = [];
            this.systemDevices = [{ id: 'default', name: 'System Default', isVirtual: false }];
        }
    }

    /**
     * Route audio to configured output devices
     * @param {Buffer} audioData - The audio data to play
     * @param {string} format - Audio format (mp3, wav, etc)
     * @param {Object} options - Routing options
     * @returns {Promise<boolean>} Success status
     */
    async routeAudio(audioData, format = 'mp3', options = {}) {
        if (!this.initialized) {
            await this.init();
        }

        const opts = { ...this.config, ...options };
        const routingPromises = [];

        // Create a temporary file for the audio
        const tempFile = path.join(os.tmpdir(), `audio-${Date.now()}.${format}`);
        await fs.promises.writeFile(tempFile, audioData);

        try {
            // Route to virtual device if enabled
            if (opts.useVirtualDevice) {
                routingPromises.push(this.routeToVirtualDevice(tempFile, format, opts.deviceName));
            }

            // Route to system speaker if enabled
            if (opts.useSystemSpeaker) {
                routingPromises.push(this.routeToSystemSpeaker(tempFile, format));
            }

            await Promise.all(routingPromises);
            return true;
        } catch (error) {
            logger.error('Error routing audio:', error);
            return false;
        } finally {
            // Clean up temp file
            try {
                await fs.promises.unlink(tempFile);
            } catch (error) {
                logger.warn('Error removing temp audio file:', error);
            }
        }
    }

    /**
     * Route audio to a virtual device
     * @param {string} audioFile - Path to audio file
     * @param {string} format - Audio format
     * @param {string} deviceName - Name of virtual device
     * @returns {Promise<boolean>} Success status
     */
    async routeToVirtualDevice(audioFile, format, deviceName) {
        try {
            // The implementation depends on the OS and virtual audio setup
            const platform = os.platform();

            if (platform === 'darwin') {
                // macOS implementation
                await this.routeAudioOnMac(audioFile, deviceName);
            } else if (platform === 'win32') {
                // Windows implementation
                await this.routeAudioOnWindows(audioFile, deviceName);
            } else {
                // Linux implementation
                await this.routeAudioOnLinux(audioFile, deviceName);
            }

            return true;
        } catch (error) {
            logger.error(`Error routing to virtual device ${deviceName}:`, error);
            // Fall back to system speaker
            await this.routeToSystemSpeaker(audioFile, format);
            return false;
        }
    }

    /**
     * Route audio to system speaker
     * @param {string} audioFile - Path to audio file
     * @param {string} format - Audio format
     * @returns {Promise<boolean>} Success status
     */
    async routeToSystemSpeaker(audioFile, format) {
        return new Promise((resolve, reject) => {
            try {
                // Use system sound library to play audio
                const ffplay = spawn('ffplay', [
                    '-nodisp',
                    '-autoexit',
                    '-loglevel', 'quiet',
                    audioFile
                ]);

                ffplay.on('close', (code) => {
                    if (code === 0) {
                        resolve(true);
                    } else {
                        reject(new Error(`ffplay exited with code ${code}`));
                    }
                });

                ffplay.on('error', (err) => {
                    reject(err);
                });
            } catch (error) {
                logger.error('Error playing through system speaker:', error);
                reject(error);
            }
        });
    }

    /**
     * Route audio on macOS using native commands
     * @param {string} audioFile - Path to audio file
     * @param {string} deviceName - Name of virtual device
     */
    async routeAudioOnMac(audioFile, deviceName) {
        return new Promise((resolve, reject) => {
            // Find the device ID by name
            const getDeviceCmd = spawn('ffmpeg', ['-f', 'avfoundation', '-list_devices', 'true', '-i', '""']);

            getDeviceCmd.stderr.on('data', (data) => {
                // Parsing ffmpeg device list output
                const output = data.toString();
                const lines = output.split('\n');
                let deviceId = null;

                for (const line of lines) {
                    if (line.includes(deviceName) && line.includes('AVFoundation audio devices')) {
                        const match = line.match(/\[(\d+)\]/);
                        if (match && match[1]) {
                            deviceId = match[1];
                            break;
                        }
                    }
                }

                if (deviceId) {
                    // Play to the virtual device
                    const playCmd = spawn('ffmpeg', [
                        '-i', audioFile,
                        '-f', 'avfoundation',
                        '-device_index', deviceId,
                        'NULL'
                    ]);

                    playCmd.on('close', (code) => {
                        if (code === 0) {
                            resolve();
                        } else {
                            reject(new Error(`ffmpeg play exited with code ${code}`));
                        }
                    });

                    playCmd.on('error', reject);
                } else {
                    reject(new Error(`Virtual device ${deviceName} not found`));
                }
            });

            getDeviceCmd.on('error', reject);
        });
    }

    /**
     * Route audio on Windows using native commands
     * @param {string} audioFile - Path to audio file
     * @param {string} deviceName - Name of virtual device
     */
    async routeAudioOnWindows(audioFile, deviceName) {
        return new Promise((resolve, reject) => {
            // On Windows, we can use PowerShell to play to a specific device
            const ps = spawn('powershell', [
                '-Command',
                `$player = New-Object System.Media.SoundPlayer; $player.SoundLocation = "${audioFile}"; $player.PlaySync();`
            ]);

            ps.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`PowerShell exited with code ${code}`));
                }
            });

            ps.on('error', reject);
        });
    }

    /**
     * Route audio on Linux using native commands
     * @param {string} audioFile - Path to audio file
     * @param {string} deviceName - Name of virtual device
     */
    async routeAudioOnLinux(audioFile, deviceName) {
        return new Promise((resolve, reject) => {
            // On Linux, we can use PulseAudio to route to a specific device
            const aplay = spawn('paplay', ['--device', deviceName, audioFile]);

            aplay.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`paplay exited with code ${code}`));
                }
            });

            aplay.on('error', reject);
        });
    }

    /**
     * Play audio data directly to system speaker
     * @param {Buffer} audioData - Audio data
     * @param {Object} format - Audio format details
     * @returns {Promise<boolean>} Success status
     */
    playAudioDirectly(audioData, format = { sampleRate: 24000, channels: 1, bitDepth: 16 }) {
        return new Promise((resolve, reject) => {
            try {
                const speaker = new Speaker({
                    channels: format.channels,
                    bitDepth: format.bitDepth,
                    sampleRate: format.sampleRate
                });

                // Once speaker is done, resolve
                speaker.on('close', () => {
                    resolve(true);
                });

                speaker.on('error', (err) => {
                    reject(err);
                });

                // Write audio data to speaker
                speaker.write(audioData);
                speaker.end();
            } catch (error) {
                logger.error('Error playing audio directly:', error);
                reject(error);
            }
        });
    }

    /**
     * Get available output devices
     * @returns {Array<Object>} List of available devices
     */
    getAvailableDevices() {
        if (!this.initialized) {
            this.init();
        }

        return {
            virtual: this.virtualDevices,
            system: this.systemDevices
        };
    }

    /**
     * Update configuration
     * @param {Object} newConfig - New configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
}

module.exports = OutputRouter;
