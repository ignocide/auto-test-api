var http = require('unirest');
var jsonfile = require('jsonfile');
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

var initUtilsVariable = function(){
	vs.utils = {
		uniqueId: function() {
			return new Date().getTime();
		}
	}
}

var handleBody = function(body, fcImpact){
	if(!body) return "";
	for(var k in body){		
		if(typeof(body[k]) == 'string'){			
			while((regex = /\$\{([^\}]+)\}/.exec(body[k])) != null){
				var varName = regex[1];				
				try{						
					if(/^\$\{([^\}]+)\}$/.exec(body[k]) != null){
						if(varName.indexOf('this.') == 0){
							body[k] = body[varName.substr(5)];
						} else {
							body[k] = eval('vs.' + varName);
						}
					} else {
						if(varName.indexOf('this.') == 0){
							body[k] = body[k].replace(/\$\{([^\}]+)\}/, body[varName.substr(5)]);
						} else{
							body[k] = body[k].replace(/\$\{([^\}]+)\}/, eval('vs.' + varName));
						}
					}
				}catch(e){
					if(fcImpact) fcImpact(impactVariable[varName.split('.')[0]]);
					throw 'Variable "' + varName + '" was not resolved: ' + e;
				}
			}
		}else{
			body[k] = handleBody(body[k]);
		}
	}	
	return body;
}
var handleUrl = function(url){
	while((regex = /\$\{([^\}]+)\}/.exec(url)) != null){		
		var varName = regex[1];
		try{
			url = url.replace(/\$\{([^\}]+)\}/, eval('vs.' + varName));
			root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex]._url = url;
		}catch(e){
			throw 'Variable "' + varName + '" in url "' + url + '" has problem ' + e;
		}
	}	
	return url;
}
var request = function(fcDone, method, url, body, headers){
	try{
		url = handleUrl(url);
		body = handleBody(body, function(impactId){
			root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].resultTest.impactId = impactId;
		});	
		root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex]._body = body;
		if('post' == method.toLowerCase()){
			var req = http.post(url);
			headers = headers || vs.headers;
			if(headers) req.headers(headers);
			req.send(new Buffer(JSON.stringify(body))).end(function(res){
				if(fcDone)
					fcDone(res);
			});
		}else if('put' == method.toLowerCase()){
			var req = http.put(url);
			headers = headers || vs.headers;
			if(headers) req.headers(headers);
			req.send(new Buffer(JSON.stringify(body))).end(function(res){
				if(fcDone)
					fcDone(res);
			});
		}else if('delete' == method.toLowerCase()){
			var req = http.delete(url);
			headers = headers || vs.headers;
			if(headers) req.headers(headers);
			req.send(new Buffer(JSON.stringify(body))).end(function(res){
				if(fcDone)
					fcDone(res);
			});
		}else if('head' == method.toLowerCase()){
			var req = http.head(url);
			headers = headers || vs.headers;
			if(headers) req.headers(headers);
			req.end(function(res){
				if(fcDone)
					fcDone(res);
			});
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

var error = function(des){
	root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].resultTest.pass = false;
	root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].resultTest.des = typeof(des) == 'object' ? JSON.stringify(des) : des;
};

exports.execute = function(file){	
	console.log("Testcase file: " + file)
	jsonfile.readFile(file, function(err, root0) {
		root = root0;
		root.pass = 0;
		root.fail = 0;
		var compareObj = function(o, n, fcDone){
			for(var i in n){
				if(typeof(n[i]) == 'object'){
					return compareObj(o[i], n[i]);
				}else if(n[i] != o[i]){
					error("Expected: " + i + " = \"" + n[i]+"\", Actual: " + i + " = \"" + o[i] + "\"");
					return false;
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
			console.log('> ' + api.method + ' ' + api.url);
			testResult.current.apiIndex = cur;
			root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].id = "N-" + testResult.current.apiUniqueId++;
			root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].resultTest = {};
			root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].resultTest.start = new Date().getTime();
			request(function(res){
				if(api.var) {
					if(impactVariable[api.var]) {
						if(!root.warning) root.warning = [];
						root.warning.push('Duplicate variable ' + api.var);
					}
					impactVariable[api.var] = root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].id;					
				}
				if(res){
					if(!res.error){
						if(!api.expect.status){
							if(root.status) api.expect.status = root.status;
						}
						if(api.expect.status){
							if(api.expect.status instanceof Array){
								if(api.expect.status.indexOf(res.statusCode) == -1){
									error('Expected status: \"' + api.expect.status + "\", Actual status: " + "\"" + res.statusCode + "\"");					
									root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].actual = res.code;	
								}
							}else if(api.expect.status != res.statusCode){
								error('Expected status: \"' + api.expect.status + "\", Actual status: " + "\"" + res.statusCode + "\"");					
								root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].actual = res.code;
							}
						}
						if(api.expect.data){
							if(typeof(api.expect.data) == 'object'){
								api.expect.data = handleBody(api.expect.data);
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
									error("Expected: \"" + api.data + "\", Actual: \"" + rs + "\"");
								}else if(api.var){
				  				vs[api.var] = rs;		  				
				  			}
							}
						}		
						var updateDeepObject = function(old, update){
							for(var k in update){
								if(typeof(update[k]) == 'object'){
									updateDeepObject(old[k], update[k]);
								}else{
									old[k] = update[k];
								}
							}
							return old;
						};
						if(api.apply){
							root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].applies = [];
							for(var o in api.apply){
								var obj = {varName: o};
								obj.oldValue = JSON.parse(JSON.stringify(vs[o]));
								var objChange = {};
								for(f in api.apply[o]){
									objChange[f] = handleBody(api.apply[o][f]);
								}								
								vs[o] = updateDeepObject(vs[o], objChange);								
								obj.newValue = vs[o];
								root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].applies.push(obj);
							}
						}
					}else{
						error('Error ' + res.statusCode + ': "' + res.statusMessage + '"');
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
		vs.env = root.env;
		console.log('################### ' + root.project + ' ###################');
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
				console.log("\n##### " + tcs[cur].title);
				testResult.current.testcasesIndex = cur;
				root.testcases[testResult.current.testcasesIndex].pass = 0;
				root.testcases[testResult.current.testcasesIndex].fail = 0;
		  	reqApi(root.testcases[cur].api, 0, function(){
		  		runTestCase(tcs, ++cur, fcDone);
		  	});
			});			
	  }
	  runTestCase(root.testcases, 0, function(){	  
	  	fs.readFile(__dirname + '/_result.template', 'utf-8', function(err, data){
	  		if(err) return console.error(err);
	  		data = data.replace('$data', JSON.stringify(root));
	  		fs.writeFile(root.project + ".result.html", data, function(err) {
			    if(err) return console.error(err);
			    console.log('\n\n***** Please see test result in "' + root.project + '.result.html".');
			    var open = require('open');
					open(root.project + '.result.html');
				}); 
	  	});		
	  });
	});
};

initUtilsVariable();