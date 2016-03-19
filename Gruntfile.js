module.exports = function(grunt) {
    require('load-grunt-tasks')(grunt);
    
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        eslint: {
            target: ['Gruntfile.js','test/**/*.js','lib/**/*.js']
        },

        mocha_istanbul: {
            coverage: {
                src: 'test',
                options: {
                    mask: '*.js',
                    reportFormats: ['html','lcovonly']
                }
            },
            coveralls: {
                src: 'test',
                options: {
                    coverage: true,
                    mask: '*.js',
                    reportFormats: ['html','lcovonly']
                }
            }
        }
    });

    grunt.event.on('coverage', function(lcov, done){
        require('coveralls').handleInput(lcov, done);
    });

    grunt.registerTask('lint', 'Run the linter for the code' ['eslint']);

    var testTasks = ['eslint'];
    if(process.env.TRAVIS){
        testTasks.push('mocha_istanbul:coveralls');
    }else{
        testTasks.push('mocha_istanbul:coverage');
    }
    grunt.registerTask('test', 'Run tests', testTasks);
    grunt.registerTask('default', ['lint']);

};