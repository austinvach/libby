const path = require('path');

const CopyPlugin = require('copy-webpack-plugin');
const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');

/**
 * Microsoft Edge (Chromium, Manifest V3) build.
 *
 * Shares the popup and processing code with the Firefox build, but uses a
 * service worker background script, content scripts to capture response
 * bodies, and an offscreen document to run the download/processing work.
 */
module.exports = merge(common, {
    mode: 'production',
    devtool: 'source-map',
    entry: {
        background: './src/background.edge.ts',
        popup: './src/popup.ts',
        offscreen: './src/offscreen.ts',
        interceptor: './src/content/interceptor.ts',
        bridge: './src/content/bridge.ts',
    },
    output: {
        path: path.resolve(__dirname, 'dist-edge'),
    },
    plugins: [
        // Edge specific files (Manifest V3 manifest and offscreen document)
        // replace the Firefox files copied from static/
        new CopyPlugin({
            patterns: [
                { from: 'edge', force: true },
            ],
        }),
    ],
});
