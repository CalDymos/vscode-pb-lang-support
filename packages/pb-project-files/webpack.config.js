// webpack.config.js
const path = require("path");

/** @type {import('webpack').Configuration} */
const extensionConfig = {
  name: "extension",
  target: "node",

  entry: "./src/extension.ts",
  output: {
    path: path.resolve(__dirname, "out"),
    filename: "extension.js",
    libraryTarget: "commonjs2",
    devtoolModuleFilenameTemplate: "../[resource-path]",
  },

  devtool: "source-map",

  externals: {
    vscode: "commonjs vscode",
  },

  resolve: {
    extensions: [".ts", ".js"],
  },

  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
            options: {
              transpileOnly: true,
              configFile: "tsconfig.json",
            },
          },
        ],
      },
      {
        enforce: "pre",
        test: /\.js$/,
        loader: "source-map-loader",
      },
    ],
  },

  infrastructureLogging: {
    level: "log",
  },
};

/** @type {import('webpack').Configuration} */
const webviewConfig = {
  name: "webview",
  target: "web",

  entry: "./src/webview/pbp-editor-view.ts",
  output: {
    path: path.resolve(__dirname, "out/webview"),
    filename: "pbp-editor-view.js",
    devtoolModuleFilenameTemplate: "../../[resource-path]",
  },

  devtool: "source-map",

  // No 'vscode' external — the webview has no access to the VS Code API.
  // acquireVsCodeApi() is declared locally in the source file.

  resolve: {
    extensions: [".ts", ".js"],
  },

  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
            options: {
              transpileOnly: true,
              configFile: "tsconfig.webview.json",
            },
          },
        ],
      },
    ],
  },

  infrastructureLogging: {
    level: "log",
  },
};

module.exports = [extensionConfig, webviewConfig];