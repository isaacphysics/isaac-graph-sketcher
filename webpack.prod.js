const path = require('path');
const DashboardPlugin = require('webpack-dashboard/plugin');

module.exports = (_env, argv) => { return {
  entry: './dist/src/GraphSketcher.js',
  devtool: argv.mode === 'development' ? 'source-map' : false,
  optimization: {
    usedExports: true,
  },
  plugins: [
    // new DashboardPlugin(),
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        use: [
          { loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env']
            }
          }
        ],
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    modules: [path.resolve(__dirname), 'node_modules'],
    extensions: [ '.tsx', '.ts', '.js' ],
    // alias: {
    //   'p5': 'p5/lib/p5.min.js'
    // }
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    library: 'isaac-graph-sketcher',
    libraryTarget: 'commonjs'
  },
  externals: [
    /^lodash\/?.*$/,
    /^p5\/?.*$/
  ]
}};