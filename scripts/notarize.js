/**
 * Notarization script for macOS builds
 * This script handles the notarization process for macOS app distribution
 */

const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
    const { electronPlatformName, appOutDir } = context;

    if (electronPlatformName !== 'darwin') {
        return;
    }

    // Skip notarization in development
    if (process.env.NODE_ENV === 'development') {
        console.log('Skipping notarization in development mode');
        return;
    }

    // Check for required environment variables
    const appleId = process.env.APPLE_ID;
    const appleIdPassword = process.env.APPLE_ID_PASSWORD;
    const teamId = process.env.APPLE_TEAM_ID;

    if (!appleId || !appleIdPassword || !teamId) {
        console.warn('Skipping notarization: Missing Apple ID credentials');
        console.warn('Set APPLE_ID, APPLE_ID_PASSWORD, and APPLE_TEAM_ID environment variables');
        return;
    }

    const appName = context.packager.appInfo.productFilename;
    const appPath = `${appOutDir}/${appName}.app`;

    console.log(`Notarizing ${appPath}...`);

    try {
        await notarize({
            appBundleId: 'com.universaltranslator.app',
            appPath: appPath,
            appleId: appleId,
            appleIdPassword: appleIdPassword,
            teamId: teamId,
        });

        console.log('Notarization completed successfully');
    } catch (error) {
        console.error('Notarization failed:', error);
        throw error;
    }
};
