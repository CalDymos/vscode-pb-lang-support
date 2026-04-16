const path = require('path');

// Shared resolve config for all bundles.
//
// - extensions: resolves TypeScript and JavaScript modules without requiring
//   explicit file extensions in imports.
// - mainFields: ['module', 'main'] prefers ESM entry points before CommonJS.
//   This is important for packages such as jsonc-parser, whose non-ESM builds
//   can leave internal requires like './impl/format' unresolved in packaged
//   VSIX bundles.
// - fallback: these Node.js built-ins are available natively for target:'node'.
//   Setting them to false avoids accidental browser polyfill injection.
const sharedResolve = {
    extensions: ['.ts', '.js'],
    mainFields: ['module', 'main'],
    fallback: {
        fs: false,
        path: false,
        crypto: false,
    },
};

const tsRule = {
    test: /\.ts$/,
    exclude: /node_modules/,
    use: [{ loader: 'ts-loader' }],
};

module.exports = (env, argv) => [
    // ── Extension Host ──────────────────────────────────────────────────────
    {
        target: 'node',
        entry: './src/extension.ts',
        output: {
            filename: 'extension.js',
            path: path.resolve(__dirname, 'out'),
            libraryTarget: 'commonjs2',
            devtoolModuleFilenameTemplate: '../[resource-path]',
        },
        devtool: 'source-map',
        externals: {
            vscode: 'commonjs vscode',
        },
        resolve: {
            ...sharedResolve,
            alias: {
                'jsonc-parser$': require.resolve('jsonc-parser/lib/esm/main.js'),
            },
        },
        module: { rules: [tsRule] },
        optimization: { minimize: argv.mode === 'production' },
    },
    // ── Language Server ──────────────────────────────────────────────────────
    //
    // Runs as a separate Node.js process started by the extension host.
    // The output path must match the serverModule path used in extension.ts.
    {
        target: 'node',
        entry: './src/server/server.ts',
        output: {
            filename: 'server.js',
            path: path.resolve(__dirname, 'out', 'server'),
            libraryTarget: 'commonjs2',
            devtoolModuleFilenameTemplate: '../../[resource-path]',
        },
        devtool: 'source-map',
        externals: {
            vscode: 'commonjs vscode',
        },
        resolve: sharedResolve,
        module: { rules: [tsRule] },
        optimization: { minimize: argv.mode === 'production' },
    },
    // ── Debug Adapter ────────────────────────────────────────────────────────
    //
    // Runs as a standalone Node.js child process for debugger integration.
    {
        target: 'node',
        entry: './src/debug/debugAdapter.ts',
        output: {
            filename: 'debugAdapter.js',
            path: path.resolve(__dirname, 'out', 'debug'),
            libraryTarget: 'commonjs2',
            devtoolModuleFilenameTemplate: '../../[resource-path]',
        },
        devtool: 'source-map',
        externals: {
            vscode: 'commonjs vscode',
        },
        resolve: sharedResolve,
        module: { rules: [tsRule] },
        optimization: { minimize: argv.mode === 'production' },
    },
];