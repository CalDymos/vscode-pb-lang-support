const path = require('path');

module.exports = [
    {
        target: 'node',
        entry: './src/extension.ts',
        output: {
            filename: 'extension.js',
            path: path.resolve(__dirname, 'out'),
            libraryTarget: 'commonjs2',
            devtoolModuleFilenameTemplate: '../[resource-path]',
        },
        devtool: "source-map",
        externals: {
            vscode: 'commonjs vscode',
        },
        resolve: {
            extensions: ['.ts', '.js'],
            mainFields: ['main', 'module'],
            fallback: {
                "fs": false,
                "path": false,
                "crypto": false
            }
        },
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    exclude: /node_modules/,
                    use: [
                        {
                            loader: 'ts-loader',
                        },
                    ],
                },
            ],
        },
        optimization: {
            minimize: false,
        },
    },
    {
        target: 'node',
        entry: './src/server/server.ts',
        output: {
            filename: 'server.js',
            path: path.resolve(__dirname, 'out', 'server'),
            libraryTarget: 'commonjs2',
            devtoolModuleFilenameTemplate: '../../[resource-path]',
        },
        externals: {
            vscode: 'commonjs vscode',
        },
        resolve: {
            extensions: ['.ts', '.js'],
            mainFields: ['main', 'module'],
            fallback: {
                "fs": false,
                "path": false,
                "crypto": false
            }
        },
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    exclude: /node_modules/,
                    use: [
                        {
                            loader: 'ts-loader',
                        },
                    ],
                },
            ],
        },
        optimization: {
            minimize: false,
        },
    },
    // Debug Adapter – runs as a standalone Node.js child process.
    // target: 'node' means Node.js built-ins (fs/path/crypto/...) are available,
    // so no browser polyfill fallbacks are needed here.
    {
        target: 'node',
        entry: './src/debug/debugAdapter.ts',
        output: {
            filename: 'debugAdapter.js',
            path: path.resolve(__dirname, 'out', 'debug'),
            libraryTarget: 'commonjs2',
            devtoolModuleFilenameTemplate: '../../[resource-path]',
        },
        devtool: "source-map",
        externals: {
            vscode: 'commonjs vscode',
        },
        resolve: {
            extensions: ['.ts', '.js'],
            mainFields: ['main', 'module'],
        },
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    exclude: /node_modules/,
                    use: [
                        {
                            loader: 'ts-loader',
                        },
                    ],
                },
            ],
        },
        optimization: {
            minimize: false,
        },
    }
];