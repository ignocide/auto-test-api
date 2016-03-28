# AutoTestAPI

Used to test APIs via testcases files which is formated by json. 

Some features:

  - Auto play test via npm, you can integrate into jenkin...
  - Use variable to store response data which will be reuse for the testcases 
  - See variable value via console log in browser by click on variable which you want to debug
  - Generate [result file] to html which so easy to view and debug

### Version
1.0.0

### Tech

AutoTestAPI uses a number of open source projects to work properly:

* [AngularJS] - HTML enhanced for web apps!
* [node.js] - evented I/O for the backend
* [unirest] - A set of lightweight HTTP libraries
* [jsonfile] - Read/write JSON files 
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
 - Run ``$ npm test `` or ``$ npm test {testcase.json} ``
 - View test result which extension is .result.html

### Write testcase
Main testcase: testcases/main.json

```
{
	"project": "Prject name",
	"headers" : { //Headers you want add in the request
		"content-type": "application/json" 
	},
	"env": { // Global variable which you want to use for all testcases
		"url": "http://localhost", // used in testcases is "${env.url}"
		"port": 8080,
		"login": {
			"username": "user@gmail.com",
			"password": "12345"
		}
	},
	"status": [200, 201], // If response status is not in these, it'll be marked fail
	"testcases": [
		"testcases/login.json", // your testcase file
		"testcases/account.json"
	]
}
```

Your testcase: testcases/login.json
```
{
	"title": "API Login", // title testcase
	"api": [
		{// Request to API
			"des": "Login", // Description
			"method": "POST", // Http method: POST, GET, PUT, DELETE
			"url": "http://localhost:8080/nanacloset/account/login",// URL Request
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
			"apply": {// after responsed , newPlace variable will be update something. You can update many variable
				"currentUser": { // variable which you can update
					"baseClass": [ // fields in variable which will be updated
						{
							"name" : "just 4 developments", 
							"address": "vietnam"
						}
					]
				}
			},
			"body": {
		    "aid": "${currentUser.baseClass[0].aid}", // used currentUser variable which was declared in the previous api testing
		    "token": "${currentUser.baseClass[0].token}"
			},
			"expect": {
				"data": {
					"code": "OK"
				}	
			}
		}
	]
}
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
   [jsonfile]: <https://www.npmjs.com/package/jsonfile>
   [open]: <https://www.npmjs.com/package/open>

   [PlGh]:  <https://github.com/just4developments/autotestapi/blob/master/README.md>
   [PlTc]: <https://github.com/just4developments/autotestapi/blob/master/testcases/main.json>

