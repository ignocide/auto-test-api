var http = require('unirest');
var jsonfile = require('jsonfile');
var file = 'testcases/main.json';
var fs = require('fs');
var vs = {};
var root = {};
var impactVariable = {};
var testResult = {
	current: {
		testcasesIndex: 0,
		apiIndex: 0,
		apiUniqueId: 0
	}
};

var handleBody = function(body){
	if(!body) return "";
	for(var k in body){		
		if(typeof(body[k]) == 'string' &&  body[k].indexOf('$') == 0){
			var regex = /\$\{([^\>]+)\}/.exec(body[k]);
			if(regex != null){
				var varName = regex[1];				
				try{					
					try{
						body[k] = eval('vs.' + varName);
					}catch(e){
						throw 'Variable "' + varName + '" in url "' + url + '" has problem ' + e;
					}
				}catch(e){
					root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].resultTest.impactId = impactVariable[varName.split('.')[0]];
					throw "Variable " + varName + " was not resolved";				
				}
			}
		}		
	}	
	root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex]._body = body;
	return body;
}
var handleUrl = function(url){
	var regex = /\$\{([^\>]+)\}/.exec(url);	
	if(regex != null){
		var varName = regex[1];
		try{
			url = url.replace(/\$\{([^\>]+)\}/, eval('vs.' + varName));
			root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex]._url = url;
		}catch(e){
			throw 'Variable "' + varName + '" in url "' + url + '" has problem ' + e;
		}
	}	
	return url;
}
var request = function(fcDone, method, url, body, headers){
	try{
		body = handleBody(body);
		url = handleUrl(url);				
		if('post' == method.toLowerCase()){
			var req = http.post(url);
			headers = headers || vs.headers;
			if(headers) req.headers(headers);
			req.send(new Buffer(JSON.stringify(body))).end(function(res){
				if(fcDone)
					fcDone(res);
			});
		}else if('put' == method.toLowerCase()){

		}else if('delete' == method.toLowerCase()){
			
		}else if('head' == method.toLowerCase()){
			
		}else{
			var req = http.get(url);
			headers = headers || vs.headers;
			if(headers) req.headers(headers);
			req.send(new Buffer(JSON.stringify(body))).end(function(res){
				if(fcDone)
					fcDone(res);
			});
		}
	}catch(e){
		error(e);
		if(fcDone) fcDone();
	}
};

var log = function(des){
	console.error('# ' + des);
};

var error = function(des){
	root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].resultTest.pass = false;
	root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].resultTest.des = typeof(des) == 'object' ? JSON.stringify(des) : des;
};

var handleFile = function(file){
	jsonfile.readFile(file, function(err, root0) {
		root = root0;
		root.pass = 0;
		root.fail = 0;
		var compareObj = function(o, n, fcDone){
			for(var i in n){
				if(n[i] != o[i]){
					error("Expected: " + i + " = \"" + n[i]+"\" #" + JSON.stringify(n) + ", Actual: " + i + " = \"" + o[i] + "\" #" + JSON.stringify(o));
					return false;
				}else if(typeof(n[i]) == 'object'){
					return compareObj(o[i], n[i]);
				}
			}
			return true;
		}
		var reqApi = function(apis, cur, fcDone){
			var api = apis[cur];
			if(cur >= apis.length){
				if(fcDone) fcDone()
				return;
			}
			log("Api: " + api.url);
			testResult.current.apiIndex = cur;
			root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].id = "N-" + testResult.current.apiUniqueId++;
			root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].resultTest = {};
			root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].resultTest.start = new Date().getTime();
			request(function(res){
				if(api.var) {
					if(!impactVariable[api.var])
						impactVariable[api.var] = root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].id;
					else{
						if(!root.warning) root.warning = [];
						root.warning.push('Duplicate variable ' + api.var);
					}
				}
				if(res){
					if(api.expect.status && api.expect.status != res.statusCode){
						error('Expected status: \"' + api.expect.status + "\", Actual status: " + "\"" + res.statusCode + "\"");					
						root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].actual = res.code;
					}
					if(api.expect.data){
						if(typeof(api.expect.data) == 'object'){
							var rs = JSON.parse(res.raw_body.toString());  					
							root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].actual = rs;
							if(compareObj(rs, api.expect.data)){
								if(api.var){
					  			vs[api.var] = rs;				  							  			
					  		}
							}
						}else {
							var rs = res.raw_body;
							root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].actual = rs;
							if(rs != api.data){
								error("Expected: \"" + api.data+"\", Actual: \"" + rs + "\"");
							}else if(api.var){
			  				vs[api.var] = rs;		  				
			  			}
						}
					}
				}			
				root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].resultTest.stop = new Date().getTime();			
				root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].resultTest.duration = root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].resultTest.stop - root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].resultTest.start;			
				if(root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].resultTest.pass == undefined){
					root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].resultTest.pass = true;
					root.testcases[testResult.current.testcasesIndex].pass++;
					root.pass++;
				}else {
					root.testcases[testResult.current.testcasesIndex].fail++;
					root.fail++;
				}
				reqApi(apis, ++cur, fcDone);
			}, api.method, api.url, api.body, api.headers);
		}
		vs.headers = root.headers;
	  log("Testing project " + root.project);
	  var handleLoadTestcase = function(tcs, cur, fcDone){	  	
	  	if(typeof(root.testcases[cur]) == 'object'){
	  		if(fcDone) fcDone(tcs, cur);
	  	}else{
	  		jsonfile.readFile(root.testcases[cur], function(err, root0) {
	  			if(err) return console.log(err);
	  			root.testcases[cur] = root0;
	  			if(fcDone) fcDone(tcs, cur);
	  		});
	  	}
	  }
	  var runTestCase = function(tcs, cur, fcDone){
	  	if(cur >= tcs.length){
				if(fcDone) fcDone();
				return;
			}
			handleLoadTestcase(tcs, cur, function(tcs, cur){
				log("#Testcase: " + tcs[cur].title);
				testResult.current.testcasesIndex = cur;
				root.testcases[testResult.current.testcasesIndex].pass = 0;
				root.testcases[testResult.current.testcasesIndex].fail = 0;
		  	reqApi(root.testcases[cur].api, 0, function(){
		  		runTestCase(tcs, ++cur, fcDone);
		  	});
			});			
	  }
	  runTestCase(root.testcases, 0, function(){	  
	  	fs.readFile('_result.html', 'utf-8', function(err, data){
	  		data = data.replace('$data', JSON.stringify(root));
	  		fs.writeFile(root.project + ".result.html", data, function(err) {
			    if(err) return console.log(err);
			    console.log("The file was saved!");
				}); 
	  	});		
	  });
	});
};

handleFile(file);