var test = require('./index.js');
var file = process.argv[2] || 'testcases/main.json';

test.execute(file, 'doc');