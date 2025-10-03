const CracoEsbuildPlugin = require('craco-esbuild');

module.exports = {
  eslint: {
    enable: false,
  },
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.plugins = webpackConfig.plugins.filter(
        (plugin) => !(plugin && plugin.constructor && plugin.constructor.name === 'ForkTsCheckerWebpackPlugin')
      );

      webpackConfig.resolve = webpackConfig.resolve || {};
      webpackConfig.resolve.fallback = {
        ...(webpackConfig.resolve.fallback || {}),
        fs: false,
        path: false,
      };

      return webpackConfig;
    },
  },
  plugins: [
    {
      plugin: CracoEsbuildPlugin,
      options: {
        esbuildLoaderOptions: {
          loader: 'tsx',
          target: 'es2015',
        },
        esbuildMinimizerOptions: {
          target: 'es2015',
          css: true,
        },
        skipEsbuildJest: false,
      },
    },
  ],
};
