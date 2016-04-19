var http = require('unirest');
var fs = require('fs');
var vs = {};
var root = {};
var impactVariable = {};
var keywords = ['env', 'doc', 'utils', 'headers'];
var executeType = -1; // -1: 'stopWhenFail', 0: 'continueWhenFail', 1: 'playOnly1'
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
		},
		null: null
	}
}

var handleBody = function(body, fcImpact){
	if(body == undefined || body == null) return {};
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
var removeSpecialInField = function(obj, isArray){
	var nobj = isArray ? [] : {};
	for(var k in obj){
		var key = k;		
		if(k.match(/[!:\*]/)){
			key = k.match(/\w+/);		
		}
		if(isArray && !(obj instanceof Array) && !(obj instanceof Object)){
			nobj.push(obj[k]);
		}else if(obj instanceof Array){
			nobj[key] = removeSpecialInField(obj[k], true);
		}else if(obj[k] instanceof Object){
			nobj[key] = removeSpecialInField(obj[k]);
		}else{
			nobj[key] = obj[k];
		}
	}
	return nobj;
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
var copyToActualDoc = function(obj, isArray){
	var rs = obj instanceof Array ? [] : {};
	for(var i in obj){
		if(obj[i] instanceof Array){
			rs[i] = copyToActualDoc(obj[i], true);
		} else if(obj[i] instanceof Object){
			rs[i] = copyToActualDoc(obj[i]);
		}else{
			rs[i] = obj[i];
		}
		if(isArray) break;
	}
	return rs;
}
var copyToDoc = function(data, docs, path, isArray){
	var getPath = function(path, key){
		if(!path) return key;
		return path + "." + key;
	}
	var getType = function(obj){
		if(obj instanceof Array)
			return "array";
		return typeof(obj);
	}
	
	var edoc = isArray ? [] : {};
	for(var i in data){
		var path0 = getPath(path, i);
		if(isArray && !(data[i] instanceof Array) && !(data[i] instanceof Object)){
			edoc[i] = {'@doc': docs[path0] ? docs[path0] : '<<< Not found] >>>', '@type': getType(data[i]) };
			var data0 = data[i];
			if((data0 instanceof Array) && data0.length > 0){
				edoc[i]["data"] = data0[0];
			}else if(data0 instanceof Object){
				edoc[i]["data"] = data0;				
			}
		}else if(data[i] instanceof Array){
			edoc[i] = {'@doc': docs[path0] ? docs[path0] : '<<< Not found] >>>', '@type': getType(data[i]) };
			var data0 = copyToDoc(data[i], docs, path0, true);
			if((data0 instanceof Array) && data0.length > 0){
				edoc[i]["@data"] = data0[0];
			}else if(data0 instanceof Object){
				edoc[i]["@data"] = data0;
			}
			if(isArray) return edoc;
		}else if(data[i] instanceof Object){
			edoc[i] = {'@doc': docs[path0] ? docs[path0] : '<<< Not found] >>>', '@type': getType(data[i]) };
			var data0 = copyToDoc(data[i], docs, path0);
			if((data0 instanceof Array) && data0.length > 0){
				edoc[i]["@data"] = data0[0];
			}else if(data0 instanceof Object){
				edoc[i]["@data"] = data0;
			}
			if(isArray) return edoc;
		}else{
			edoc[i] = {'@doc': docs[path0] ? docs[path0] : '<<< Not found] >>>', '@type': getType(data[i]) };
			var data0 = data[i];
			if((data0 instanceof Array) && data0.length > 0){
				edoc[i]["@data"] = data0[0];
			}else if(data0 instanceof Object){
				edoc[i]["@data"] = data0;
			}
		}		
	}
	return edoc;
}
var getDocBundleObject = function(item, docs){
	for(var k in item){
		if(typeof(k) == 'object'){
			docs = getDocBundleObject(item, docs);
		}else {
			var k1 = k.match(/([^@]+)/)[0];
			if(item[k] && item[k].length > 0){				
				var m = item[k].match(/\$\{(\w+)\}/);				
				if(m != null){				
					var docs1 = getDocBundle(m[1].replace('/\s/', ''));
					for(var j in docs1){
						docs[k1 + "." + j] = docs1[j];
					}
				}else{
					docs[k1] = item[k];
				}				
			}else if(!item[k]){
				docs[k1] = "<<< Not used >>>";
			}
		}
	}
	return docs;
}
var getDocBundle = function(doc){
	var docs = {};
	var idocs = doc.split('|');
	for(var i in idocs){		
		var item = eval('vs.doc.' + idocs[i].replace('/\s/', ''));
		docs = getDocBundleObject(item, docs);
	}
	return docs;
}
var request = function(fcDone, method, url, body, headers){
	try{
		body = body ? body : {};
		var api = root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex];
		url = handleUrl(url);		
		body = handleBody(body, function(impactId){
			api.resultTest.impactId = impactId;
		});	
		api._body = body;
		if(api.doc && api.doc.body){
			api['@body'] = copyToDoc(body, getDocBundle(api.doc.body));
		}
		if('post' == method.toLowerCase()){
			var req = http.post(url);
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

var error = function(des, isOnlyCheck){
	if(!isOnlyCheck){
		root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].resultTest.pass = false;
		root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].resultTest.des += typeof(des) == 'object' ? JSON.stringify(des) : des + '\n';
	}
};

var compareObj = function(o, n, isOnlyCheck){	
	for(var i in n){
		var g = i.match(/[\*!:?]+/);
		if(g != null){
			var io = i.match(/\w+/)[0];
			if(g[0] == '*'){
				if(!o[io]){
					error("Expected: " + io + " must be something, Actual: " + io + " is nothing", isOnlyCheck);
					return true;
				}
			}
			if(n[i] instanceof Array){				
				if(g[0] == ':'){
					if(i.indexOf(g[0]) == 0){
						// Actual data in array expect data
						// if(o[io] instanceof Array){
						// 	for(var j in o[io]){
						// 		if(n[i].indexOf(o[io][j]) == -1){
						// 			error("Expected: " + io + " in \"" + n[i]+"\", Actual: " + io + " = \"" + o[io] + "\"");
						// 			return false;
						// 		}	
						// 	}
						// }else{
						// 	if(n[i].indexOf(o[io]) == -1){
						// 		error("Expected: " + io + " in \"" + n[i]+"\", Actual: " + io + " = \"" + o[io] + "\"");
						// 		return false;
						// 	}
						// }
						// Expect data in array actual data
						if(n[i] instanceof Array){
							for(var j in o[io]){
								var isExisted = false;								
								for(var k in n[i]){
									if(compareObj(o[io][j], n[i][k], true)){
										isExisted = true;
										break;										
									}
								}
								if(!isExisted){
									error("Expected: Expect array data is contains actual array data, Actual: Reversed", isOnlyCheck);
									return false;
								}
							}
						}else{
							var isExisted = false;
							for(var j in o[io]){							
								if(!compareObj(o[io][j], n[i][k], true)){
									error("Expected: Expect array data is contains actual data, Actual: Reversed", isOnlyCheck);
									return false;		
								}
							}
						}
					}else{
						// Expect data in array actual data
						if(n[i] instanceof Array){
							for(var k in n[i]){
								var isExisted = false;
								for(var j in o[io]){							
									if(compareObj(o[io][j], n[i][k], true)){
										isExisted = true;
										break;										
									}
								}
								if(!isExisted){
									error("Expected: \"" + k + "\" Actual array data is contains expect array data, Actual: Reversed", isOnlyCheck);
									return false;
								}
							}
						}else{
							var isExisted = false;
							for(var j in o[io]){							
								if(compareObj(o[io][j], n[i][k], true)){
									isExisted = true;
									break;										
								}
							}
							if(!isExisted){
								error("Expected: \"" + io + "\" Actual array data is contains expect data, Actual: Reversed", isOnlyCheck);
								return false;
							}
						}
					}
				}else if(g[0] == '!:'){
					if(i.indexOf(g[0]) == 0){
						// Actual data not in array expect data
						// if(o[io] instanceof Array){
						// 	for(var j in o[io]){
						// 		if(n[i].indexOf(o[io][j]) != -1){
						// 			error("Expected: " + io + " not in \"" + n[i]+"\", Actual: " + io + " = \"" + o[io] + "\"");
						// 			return false;
						// 		}	
						// 	}
						// }else{
						// 	if(n[i].indexOf(o[io]) != -1){
						// 		error("Expected: " + io + " not in \"" + n[i]+"\", Actual: " + io + " = \"" + o[io] + "\"");
						// 		return false;
						// 	}
						// }
						// Expect data not in array actual data
						if(n[i] instanceof Array){							
							for(var j in o[io]){							
								for(var k in n[i]){
									if(compareObj(o[io][j], n[i][k], true)){
										error("Expected: \"" + i + "." + k + "\" Expect array data is not contains actual array data, Actual: \"" + io + "." + j + "\" Reversed", isOnlyCheck);
										return false;
									}
								}
							}
						}else{
							for(var j in o[io]){							
								for(var k in n[i]){
									if(compareObj(o[io][j], n[i][k], true)){
										error("Expected: \"" + i + "." + k + "\" Expect array data is not contains actual data, Actual: \"" + io + "." + j + "\" Reversed", isOnlyCheck);
										return false;
									}
								}
							}
						}
					}else{
						// Expect data not in array actual data
						if(n[i] instanceof Array){
							for(var k in n[i]){
								for(var j in o[io]){							
									if(compareObj(o[io][j], n[i][k], true)){
										error("Expected: \"" + i + "." + k + "\" Actual array data is not contains expect array data, Actual: \"" + io + "." + j + "\" Reversed", isOnlyCheck);
										return false;
									}
								}
							}
						}else{
							for(var k in n[i]){
								for(var j in o[io]){
									if(compareObj(o[io][j], n[i][k], true)){
										error("Expected: \"" + i + "." + k + "\" Actual array data is not contains expect data, Actual: \"" + io + "." + j + "\" Reversed", isOnlyCheck);
										return false;
									}
								}
							}
						}
					}
				}
			}else if(n[i] instanceof Object){
				return compareObj(o[i], n[i], isOnlyCheck);
			}else {
				if(g[0] == '!'){
					if(n[i] == o[io]){
						error("Expected: " + io + " != \"" + n[i]+"\", Actual: " + io + " = \"" + o[io] + "\"", isOnlyCheck);
						return false;
					}
				}else if(g[0] == '?'){
					if(n[i] != o[io].length){
						error("Expected: Number of items in response data is " + n[i] + ", Actual: number of items in response data is " + o[io].length, isOnlyCheck);
						return false;
					}
				}
			}
		}else{
			if(n[i] instanceof Object){				
				return compareObj(o[i], n[i], isOnlyCheck);
			}else {
				try{
					if(n[i] === undefined){
						error("There is not field \"" + i + "\" in expected data", isOnlyCheck);
						return false;
					}else if(o[i] === undefined){
						error("There is not field \"" + i + "\" in actual data", isOnlyCheck);
						return false;
					}else{ 
						if(typeof(n[i]) == 'string'){							
							var matchRegex = n[i].match(/\$\((.*?)\)/);
							if(matchRegex != null && matchRegex.length > 1){
								// if(typeof(o[i]) != 'string'){
								// 	error("Expected type of " + i + " is string, Actual: type of " + i + " is " + (o[i] instanceof Array ? "array" : typeof(o[i])));
								// 	return false;
								// }else 
								if(matchRegex[1] != '*'){
									var canNull = false;
									if(matchRegex[1].indexOf("*") != -1){
										matchRegex[1] = matchRegex[1].split('*')[0];
										canNull = true;
									}
									if(canNull && o[i] == null){
										
									}else{
										if(matchRegex[1] == 'string'){
											if(typeof(o[i]) != 'string'){
												error("Expected type of " + i + " is string, Actual: type of " + i + " is " + typeof(o[i], isOnlyCheck));
												return false;
											}
										}else if(matchRegex[1] == 'number'){
											if(typeof(o[i]) != 'number'){
												error("Expected type of " + i + " is number, Actual: type of " + i + " is " + typeof(o[i], isOnlyCheck));
												return false;
											}
										}else if(matchRegex[1] == 'object'){
											if(!(o[i] instanceof Object)){
												error("Expected type of " + i + " is object, Actual: type of " + i + " is " + (o[i] instanceof Array ? "array" : typeof(o[i])), isOnlyCheck);
												return false;
											}
										}else if(matchRegex[1] == 'array'){
											if(!(o[i] instanceof Array)){
												error("Expected type of " + i + " is array, Actual: type of " + i + " is "  + (o[i] instanceof Object ? "object" : typeof(o[i])), isOnlyCheck);
												return false;
											}
										}else {
											var regex = matchRegex[1];
											if(regex.indexOf('/') == 0){
												regex = regex.match(/\/(.*?)\/(.+)/);
												regex = new RegExp(regex[1], regex[2] ? regex[2] : '');
											}else{
												regex = new RegExp(regex);
											}
											if(!regex.test(o[i])){
												error("Expected value of " + i + " is match pattern \"" + matchRegex[1] + "\", Actual: value of " + i + " is \"" + o[i] + "\"", isOnlyCheck);
												return false;
											}
										}
									}
								}
							}else if(n[i] != o[i]){
								error("Expected: " + i + " = \"" + n[i]+"\", Actual: " + i + " = \"" + o[i] + "\"", isOnlyCheck);
								return false;
							}
						}else if(n[i] != o[i]){
							error("Expected: " + i + " = \"" + n[i]+"\", Actual: " + i + " = \"" + o[i] + "\"", isOnlyCheck);
							return false;
						}
					}
				}catch(e){
					if(o == null){
						error("Value of \"" + i + "\" is null in actual data", isOnlyCheck);
						return false;
					}else if(n == null){
						error("Value of \"" + i + "\" is null in expected data", isOnlyCheck);
						return false;
					}
					error(e, isOnlyCheck);
					return false;
				}
			}
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
	root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].resultTest = {des: ""};
	root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].resultTest.start = new Date().getTime();
	if(!root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].headers)
		root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].headers = vs.headers;
	setTimeout(function(){
		request(function(res){
			if(api.var) {
				if(impactVariable[api.var]) {
					if(!root.warning) root.warning = [];
					root.warning.push('Duplicate variable ' + api.var + " - ID: " + api.id);
				}
				impactVariable[api.var] = root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].id;					
			}
			if(res){
				root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].actual = {status: res.statusCode, data: null, html: res.raw_body};
				try{
					var rs = JSON.parse(res.raw_body.toString());
					root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].actual.data = rs;
					root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex]['#actual'] = copyToActualDoc(rs);							
				}catch(e){
					if(res.raw_body){
						root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].actual.data = res.raw_body.toString();
						root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex]['#actual'] = copyToActualDoc(res.raw_body.toString());
					}
				}
				if(!res.error) {
					if(!api.expect.status){
						if(root.status) api.expect.status = root.status;
					}
					if(api.expect.status){
						if(api.expect.status instanceof Array){
							if(api.expect.status.indexOf(res.statusCode) == -1){
								error('Expected status: \"' + api.expect.status + "\", Actual status: " + "\"" + res.statusCode + "\"");					
								root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].actual.data = res.code;	
							}
						}else if(api.expect.status != res.statusCode){
							error('Expected status: \"' + api.expect.status + "\", Actual status: " + "\"" + res.statusCode + "\"");					
							root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].actual.data = res.code;
						}
					}
					if(api.expect.data){					
						if(typeof(api.expect.data) == 'object'){
							try{
								api.expect.data = handleBody(api.expect.data);														
								if(compareObj(root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].actual.data, api.expect.data)){
									if(api.var){
										if(keywords.indexOf(api.var) != -1){
											console.log('Please rename variable "' + api.var + '" to something which is not in "' + keywords.join(',') + '"');
											throw 'Variable name is same keywords';
										}
						  			vs[api.var] = root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].actual.data;
						  		}
								}
							}catch(e){
								console.error(e);
							}
						}else {
							if(res.raw_body != api.data){
								error("Expected: \"" + api.data + "\", Actual: \"" + res.raw_body + "\"");
							}else if(api.var){
								if(keywords.indexOf(api.var) != -1){
									console.log('Please rename variable "' + api.var + '" to something which is not in "' + keywords.join(',') + '"');
									throw 'Variable name is same keywords';
								}
			  				vs[api.var] = root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].actual.data;
			  			}
						}
					}				
					var updateDeepObject = function(old, update){
						for(var k in update){
							if(update[k] instanceof Array){
								updateDeepObject(old[k], update[k]);
							} else if(update[k] instanceof Object){
								updateDeepObject(old[k], update[k]);
							}else{
								old[k] = update[k];
							}
						}
						for(var i in old){
							if(update[i] == undefined)
								delete old[i];
						}
						return old;
					};
					root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex]['output'] = removeSpecialInField(api.expect);
					if(root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].resultTest.pass !== false  && api.apply){
						root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].applies = [];
						for(var o in api.apply){
							var obj = {varName: o};
							obj.oldValue = JSON.parse(JSON.stringify(vs[o]));
							var objChange = {};
							for(f in api.apply[o]){
								try{
									objChange[f] = handleBody(api.apply[o][f]);
								}catch(e){
									console.errro(e);
								}
							}								
							vs[o] = updateDeepObject(vs[o], objChange);								
							obj.newValue = vs[o];
							root.testcases[testResult.current.testcasesIndex].api[testResult.current.apiIndex].applies.push(obj);
						}
					}
					if(api.doc && api.doc.actual){
						api['@actual'] = copyToDoc(api.actual.data, getDocBundle(api.doc.actual));					
					}
				}else{						
					error(res.error.toString());
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
			if(executeType != 1)
				reqApi(apis, ++cur, fcDone);
			else if(fcDone)
				fcDone();
		}, api.method, api.url, api.body, api.headers);
	}, api.delay ? api.delay : 0)	
}

var prehandleFile = function(file, fcDone){
	var content = '';
	var lineReader = require('readline').createInterface({
	  input: fs.createReadStream(file)
	});

	lineReader.on('line', function (line) {
	  content += line + '\r\n';
	});

	lineReader.on('close', function(){
		if(fcDone) fcDone(null, JSON.parse(content));
	});
}

exports.execute = function(file, exportType){	
	console.log("Testcase file: " + file)
	prehandleFile(file, function(err, root0) {
		root = root0;
		root.start = new Date().getTime();
		root.pass = 0;
		root.fail = 0;
		
		vs.headers = root.headers;
		vs.env = root.env;
		vs.doc = root.doc;
		console.log('################### ' + root.project + ' ###################');
	  var handleLoadTestcase = function(tcs, cur, fcDone){	  	
	  	if(typeof(root.testcases[cur]) == 'object'){
	  		if(fcDone) fcDone(tcs, cur);
	  	}else{
	  		prehandleFile(root.testcases[cur], function(err, root0) {
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
		  		if(executeType == 1 && fcDone)
		  			fcDone();
		  		else
		  			runTestCase(tcs, ++cur, fcDone);
		  	});
			});			
	  }
	  runTestCase(root.testcases, 0, function(){	  	
	  	root.stop = new Date().getTime();
	  	if(exportType == 'doc'){
		  	fs.readFile(__dirname + '/_doc.template', 'utf-8', function(err, data){
		  		if(err) return console.error(err);
		  		data = data.replace('$data', JSON.stringify(root));
		  		fs.writeFile(root.project + ".doc.html", data, function(err) {
				    if(err) return console.error(err);
				    console.log('\n\n***** Please see test result in "' + root.project + '.doc.html".');
				    var open = require('open');
				    open(root.project + '.doc.html');
					}); 
		  	});
		  }else {
		  	fs.readFile(__dirname + '/_result.template', 'utf-8', function(err, data){
		  		if(err) return console.error(err);
		  		data = data.replace('$data', JSON.stringify(root));
		  		fs.writeFile(root.project + ".result.html", data, function(err) {
				    if(err) return console.error(err);
				    console.log('\n\n***** Please see test result in "' + root.project + '.result.html".');

				    require('http').createServer(function(req, res){			    					    	
				      if(req.url == '/result'){
								res.writeHead(200, {
				         	'Content-Type': 'application/json',
				         	'Access-Control-Allow-Origin': '*',
				         	'Access-Control-Request-Method': 'GET'
				      	});
				      	res.end(JSON.stringify(root));
				      }else if(req.url == '/exportDoc'){
				      	fs.readFile(__dirname + '/_doc.template', 'utf-8', function(err, data){
						  		if(err) return console.error(err);
						  		data = data.replace('$data', JSON.stringify(root));
						  		fs.writeFile(root.project + ".doc.html", data, function(err) {
								    if(err) return console.error(err);
								    console.log('\n\n***** Please see test result in "' + root.project + '.doc.html".');
								    var open = require('open');
				    				open(root.project + '.doc.html');
				    				res.end(root.project + '.doc.html');
									}); 
						  	});
				      }else {
				      	executeType = 1;
				      	var regex = req.url.toString().match(/\/request\/([^\/]+)\/([^\/]+)/);
				      	testResult.current.testcasesIndex = parseInt(regex[1]);
				      	reqApi(root.testcases[testResult.current.testcasesIndex].api, parseInt(regex[2]), function(){
						  		res.writeHead(200, {
				         	'Content-Type': 'application/json',
				         	'Access-Control-Allow-Origin': '*',
				         	'Access-Control-Request-Method': 'GET'
					      	});
					      	res.end(JSON.stringify(root));
						  	});
				      }
				    }).listen(61188);
				    console.log('Start server at 127.0.0.1:61188');
				    var open = require('open');
				    open(root.project + '.result.html');
					}); 
		  	});
		  }
	  });
	});
};

initUtilsVariable();