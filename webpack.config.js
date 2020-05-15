const path = require('path');
const DashboardPlugin = require('webpack-dashboard/plugin');

module.exports = (_env, argv) => { return {
  entry: './src/GraphSketcher.ts',
  devtool: argv.mode === 'development' ? 'source-map' : false,
  optimization: {
    usedExports: true,
  },
  plugins: [
    new DashboardPlugin(),
  ],
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        use: [{ loader: 'babel-loader', options: { presets: ['@babel/preset-env'], plugins: ["@babel/plugin-proposal-class-properties", "@babel/plugin-transform-typescript"]}}],
        exclude: /node_modules/
      },
      {
        test: /\.tsx?$/,
        use: [{ loader: 'babel-loader', options: { presets: ['@babel/preset-env'] } }, 'ts-loader'],
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
    extensions: [ '.tsx', '.ts', '.js' ],
    alias: {
      'p5': 'node_modules/p5/lib/p5.min.js'
    }
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    library: 'isaac-graph-sketcher',
    libraryTarget: 'umd'
  }
}};