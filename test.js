var test = require('./index.js');
var file = process.argv[2] ? ('testcases/' + process.argv[2] + '/main.json') : 'testcases/main.json';

test.execute(file);