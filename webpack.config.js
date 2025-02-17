const path = require('path');

module.exports = {
    mode: 'development',
    resolve: {
        extensions: ['*', '.mjs', '.js', '.json'],
        fallback: {
            "stream": require.resolve("stream-browserify"),
            "util": require.resolve("util/")
        }
    },
    module: {
        rules: [
            {
                test: /\.mjs$/,
                include: /node_modules/,
                type: 'javascript/auto'
            },
            {
                test: /\.m?js/,
                resolve: {
                    fullySpecified: false
                }
            },
            {
                test: /\.(js|mjs)$/,
                enforce: 'pre',
                use: ['source-map-loader'],
                include: path.resolve(__dirname, 'src'),
                exclude: /node_modules/
            }
        ]
    },
    devtool: 'source-map',
    plugins: [],
    stats: {
        errors: true,
        warnings: false,
        modules: false,
        warningsFilter: [/Failed to parse source map/]
    }
};
