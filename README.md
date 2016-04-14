# AutoTestAPI

Used to test APIs via testcases files which is formated by json. 

Some features:

  - Export to specific APIs document which's extension is .doc.html and you can view it offline
  - Auto play test via npm, you can integrate into jenkin...
  - Use variable to store response data which will be reuse for the testcases 
  - See variable value via console log in browser by click on variable which you want to debug
  - Generate [result file] to html which so easy to view and debug

### Version
1.1.0

### Technologies

AutoTestAPI uses a number of open source projects to work properly:

* [AngularJS] - HTML enhanced for web apps!
* [node.js] - evented I/O for the backend
* [unirest] - A set of lightweight HTTP libraries
* [open] - Open a file or url in the user's preferred application

And of course AutoTestAPI itself is open source with a [git-repo-url]
 on GitHub.

### Installation

You need Gulp installed globally:

```sh
$ git clone [git-repo-url] autotestapi
$ cd autotestapi
$ npm install
```

### Plugins

AutoTestAPI is currently extended with the following plugins

* Github

Readmes, how to use them in your own application can be found here:

* [plugins/github/README.md] [PlGh]

### Todos

 - Write Testcase in [testcases/main.js] [PlTc]
 
For testing:
 - Run ``$ npm run test `` or ``$ npm run test {testcase.json} ``
 - View and debug testing result which is {project name}.result.html
 - You can export to specific document on this page too

For export special APIs document:
 - Run ``$ npm run doc `` or ``$ npm run doc {testcase.json} ``
 - View special APIs document which is {project name}.doc.html 

### Write testcase
Main testcase: testcases/main.json

```
{
	"project": "Prject name", // which will be displayed in header on the pages
	"team": "Just4developments Team", // which will be displayed in footer on the pages
	"headers" : { // Headers you want add in the request
		"content-type": "application/json" 
	},
	"env": { // Global variable which you want to use for all testcases
		"url": "http://localhost", // used in testcases as "${env.url}"
		"port": 8080,
		"login": {
			"username": "user@gmail.com", // used in testcases as "${env.login.username}"
			"password": "12345"
		}, 
		"types": ["type1", "type2", "type3"] // used in testcases as "${env.types[0]}" to get the first item
	},
	"doc": {
	    "user": {
	        "userName": "Name description",
	        "passWord": "Password description",
	        "hobby.0": "Hopy description" // When hobby field which is in response data is array, you need get item 0 to map doc for it
	    }
	},
	"status": [200, 201], // If response status is not in these, it'll be marked fail
	"testcases": [ // your testcase files
		"testcases/login.json", // The login testcase will be executed first
		"testcases/account.json" // The next is account testcase
		... // more
	]
}
```

Your testcase: testcases/login.json
```
{
	"title": "User APIs", // title testcase
	"api": [
		{   // Declare API
			"des": "Login", // API Description
			"method": "POST", // Http method: POST, GET, PUT, DELETE, HEAD
			"url": "http://localhost:8080/nanacloset/account/login", // URL Request
			"body": { // Request data body
			    "userName": "user@gmail.com",
			    "passWord": "123456"
			},
			"var": "currentUser",// variable which will be stored response data to use for others
			"expect": { // Expected response which will validate testcase pass or fail
				"status": 200,// http response status code must be 200 -> passed
				"data": {// response data
					"code": "OK" // It'll check response data must have a field "code" and its value is "OK" 
				}
			}
		},
		{
			"des": "Add account",
			"method": "PUT",
			"url": "${env.url}:${env.port}/nanacloset/account/addAccount",
			"body": {
		    "userName": "thanh-${utils.uniqueId()}",// utils.uniqueId() will autoincrements which used for ID
		    "passWord": "123aA",
		    "email": "${this.userName}@gmail.com",// "this."// used by local variable which in a object
		    "displayName": "${this.userName}",
		    "mobilePhone": "0973363999",
		    "homePhone": "0973363999",
		    "deviceId": []
			},
			"var": "newUser",
			"expect": {
				"status": 200,
				"data": {
					"code": "OK"
				}
			}
		},
		{
			"des": "Get all campaign",
			"method": "POST",
			"url" : "http://localhost:8080/nanacloset/campaign/getListCampaign",
			"var": "listCampaign",
			"body": {
		    "aid": "${currentUser.baseClass[0].aid}", // used currentUser variable which was declared in the previous api testing
		    "token": "${currentUser.baseClass[0].token}"
			},
			"expect": {
				"status": [200, 201], // http response status code must be in 200 or 201 -> passed
				"data": {
					":code": ["OK", "NOT_FOUND"], // Check code value in response data must be IN "OK" or "NOT_FOUND". Syntax: ":[FIELD_NAME]" -> actual data have to be in expect data, "[FIELD_NAME]:" -> expect data have to be in actual data
					"campaign": {
						"status!:": [1, 2], // Check status value in response data must NOT be IN 1 or 2. Syntax: "[FIELD_NAME]!:"
						"name!": "Restaurants" // Check name value in response data must NOT be "Restaurants". Syntax: "[FIELD_NAME]!"
					}
				}	
			},
			"apply": {// set new value for variables. After responsed , currentUser variable will be updated something. You can update many variables
				"currentUser": { // It's variable which was declared in the testcase API Login
					"baseClass": [// Property in currentUser variable
						"name": "name_after_updated", // set name for currentUser variable
						"email": "${this.name}@gmail.com" // It's "name_after_updated@gmail.com". "this" will be reference the a object which contains it
					]
				}
			}
		}
	]
}
```

### Format to export document for APIs:

Your testcase: testcases/login.json
```
    {
	"title": "API Login",
	"api": [
		{
			"des": "Login",
			"method": "POST",
			"url": "${env.url}:${env.port}/hugelist/account/login",
			"body": {
		        "userName": "${env.login.username}", 
		        "passWord": "${env.login.password}" 
			},
			"doc": "res|user", // Doc will be mapped by "res" and "user" variables in doc which declared in main.json
			"var": "currentUser",
			"expect": {
				"status": 200, 
				"data": { 
					"code!": "NG"
				}
			}
		}
	]
}
```

JUST declare it in "body" tag (request data) and "expect" tag (response data) in "api" tag.

```
    "userName": "${env.login.username}", ///(string) account id which you want to sent to server
    
    In that: 
    /// : symbol to declare doc config
    (string) : symbol to declare variable type which can be anything like (integer, number, string, object ...)
    account id...: field description
```

Some operator in new update

In expect field
```
"username": "user" // Check username must be "user"
"username": "uname" // Check username must be NOT "user"
":menu": ["food", "warter", "rice"] // ":" at the first means that IN. Check actual data(response data) must be in food, warter or rice
"!:menu": ["food", "warter", "rice"] // check actual data must be NOT in food, warter, rice
"menu:": ["food", "warter"] // ":" at the last means that IN. It will check food, warter must existed in actual data(response data)
"hobby?": 3 // Hobby in response is array. "?" mean that LENGTH. It'll check number of items in hoppy is 3 items

```

License
----

MIT


**Free Software, Hell Yeah!**

   [result file]: <https://github.com/just4developments/autotestapi/blob/master/What%20seat.result.html>
   [git-repo-url]: <https://github.com/just4developments/autotestapi.git>
   [node.js]: <http://nodejs.org>
   [AngularJS]: <http://angularjs.org>
   [unirest]: <http://unirest.io/nodejs.html>
   [open]: <https://www.npmjs.com/package/open>

   [PlGh]:  <https://github.com/just4developments/autotestapi/blob/master/README.md>
   [PlTc]: <https://github.com/just4developments/autotestapi/blob/master/testcases/main.json>

