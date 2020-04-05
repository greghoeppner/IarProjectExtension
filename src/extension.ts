// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
const { parseString } = require('xml2js');
const xml2js = require("xml2js");
const fs = require('fs');

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "iarproject" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('extension.helloWorld', () => {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World!');
	});

//    "iarproject.projectFile": "home_system.ewp"

	//vscode.commands.executeCommand('setContext', 'jsonOutlineEnabled', enabled);
	
	context.subscriptions.push(disposable);

	let disposable2 = vscode.commands.registerCommand('extension.addToIarProject', (uri:vscode.Uri) => {
		var workspaceFolder = vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath ?? "";
		var filePath = uri.fsPath.replace(workspaceFolder, "$PROJ_DIR$");
		console.log(filePath);
		
		const config = vscode.workspace.getConfiguration('iarproject', null);
		const projectFile = config.get<string>('projectFile');
		
		let xml_string = fs.readFileSync(projectFile, "utf8");

		parseString(xml_string, function(error: null, result: any) {
			if(error === null) {
				var output = { modified: false};
				lookInGroup(result.project.group, "$PROJ_DIR$", filePath, output);

				if (output.modified) {
					var builder = new xml2js.Builder({renderOpts: { "pretty": true, "indent": "    ", "newline": "\r\n"}});
					var xml = builder.buildObject(result);

					fs.writeFile(projectFile, xml, function(err: any, data: any) {
						if (err) {
							console.log(err);
						}
					});
				}
			}
			else {
				console.log(error);
			}
		});
	});

	context.subscriptions.push(disposable2);
}

function lookInGroup(root: any, path: string, fileToAdd: string, output: {modified: boolean}) {
	root.forEach((element: any) => {
		var folderName;
		if (path === "") {
			folderName = element.name;
		} else {
			folderName = path + "\\" + element.name;
		}
		//console.log("Folder: " + folderName);
		for (const key in element) {
			if (element.hasOwnProperty(key)) {
				if (key === "group") {
					lookInGroup(element[key], folderName, fileToAdd, output);
				} else if (key === "file") {
					var fileToAddPath;
					var fileStartIndex = fileToAdd.lastIndexOf("\\");
					if (fileStartIndex >= 0) {
						fileToAddPath = fileToAdd.substr(0, fileStartIndex);
					} else {
						fileToAddPath = "";
					}
					if (folderName.toUpperCase() === fileToAddPath.toUpperCase()) {
						if (!lookInFile(element[key], folderName, fileToAdd)) {
							// Add file to this spot.
							console.log("Adding file '" + fileToAdd + "' to folder '" + folderName + "'");

							var newElement = {name: [fileToAdd]};
							element[key].push(newElement);

							output.modified = true;
						}
					}
				}
			}
		}
	});
}

function lookInFile(root: any, path: string, fileToAdd: string) {
	root.forEach((element: any) => {
		if (fileToAdd.toUpperCase() === element.name[0].toUpperCase()) {
			console.log("Found file '" + fileToAdd + "' in folder '" + path + "'");
			return true;
		}
		//console.log(element.name[0]);
	});

	return false;
}

// this method is called when your extension is deactivated
export function deactivate() {}
