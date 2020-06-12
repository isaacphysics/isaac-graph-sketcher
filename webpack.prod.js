const path = require('path');

module.exports = (_env, argv) => { return {
    entry: './dist/src/GraphSketcher.js',
    optimization: {
    usedExports: true,
  },
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
    alias: {
      'p5': 'node_modules/p5/lib/p5.min.js'
    }
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    library: 'isaac-graph-sketcher',
    libraryTarget: 'commonjs'
  }
}};