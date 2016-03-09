module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        mochacov: {
            options: {
                files: ['test/**/*.js']
            },
            
            main: {
                options:{
                    reporter: 'spec'
                }
            },
            
            coverage: {
                options: {
                    reporter: 'html-cov',
                    output: 'coverage/coverage.html'
                }
            },

            coveralls: {
                options: {
                    coveralls: true
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-mocha-cov');

    grunt.registerTask('default', ['test']);
    if(process.env.TRAVIS){
        grunt.registerTask('test', 'Run tests', ['mochacov:main','mochacov:coveralls']);
    }else{
        grunt.registerTask('test', 'Run tests', ['mochacov:main','mochacov:coverage']);
    }
};