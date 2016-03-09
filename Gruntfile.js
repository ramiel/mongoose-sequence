module.exports = function(grunt) {
    require('load-grunt-tasks')(grunt);
    
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        eslint: {
            target: ['Gruntfile.js','test/**/*.js','lib/**/*.js']
        },

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

    grunt.registerTask('lint', 'Run the linter for the code' ['eslint']);

    var testTasks = ['eslint', 'mochacov:main'];
    if(process.env.TRAVIS){
        testTasks.push('mochacov:coveralls');
    }else{
        testTasks.push('mochacov:coverage');
    }
    grunt.registerTask('test', 'Run tests', testTasks);
    grunt.registerTask('default', ['lint']);

};