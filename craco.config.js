const path = require('path');

module.exports = {
    webpack: {
        alias: {},
        plugins: [],
        configure: {
            resolve: {
                fallback: {
                    "stream": require.resolve("stream-browserify"),
                    "util": require.resolve("util/")
                }
            }
        }
    }
};
