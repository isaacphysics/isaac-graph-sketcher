const path = require('path');
const DashboardPlugin = require('webpack-dashboard/plugin');
const commonConfig = require('./webpack.config');
const {merge} = require('webpack-merge');

module.exports = (_env, argv) => { return merge(commonConfig(), {
  entry: './src/GraphSketcher.ts',
  devtool: 'source-map',
  plugins: [
    new DashboardPlugin(),
  ]
})};