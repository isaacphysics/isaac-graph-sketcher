const path = require('path');

module.exports = (_env, argv) => { return {
  entry: './src/GraphSketcher.ts',
  devtool: false,
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
              presets: ['@babel/preset-env'],
              plugins: [
                "@babel/plugin-transform-typescript",
                "@babel/plugin-proposal-class-properties",
                "@babel/plugin-transform-classes"
              ]
            }
          }
        ],
        exclude: /node_modules/
      },
      {
        test: /\.ts$/,
        use: [
          { loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env'],
              plugins: [
                "@babel/plugin-proposal-class-properties",
                "@babel/plugin-transform-classes"
              ]
            }
          },
          { loader: 'ts-loader' }
        ],
        exclude: /node_modules/
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              outputPath: 'fonts',
            },
          }
        ]
      }
    ]
  },
  resolve: {
    modules: [path.resolve(__dirname), 'node_modules'],
    extensions: [ '.tsx', '.ts', '.js' ]
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'lib'),
    library: {
      name: 'isaac-graph-sketcher',
      type: 'umd',
    }
  },
  externals: [
    /^lodash\/?.*$/,
    /^p5\/?.*$/
  ]
}};