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
	console.log('Extension "iarproject" is now active!');

	let disposable = vscode.commands.registerCommand('extension.addToIarProject', (uri:vscode.Uri) => {
		var workspaceFolder = vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath ?? "";
		var filePath = uri.fsPath.replace(workspaceFolder, "$PROJ_DIR$");
		console.log("Attempting to add '" + filePath + "' to the IAR project");
		
		const config = vscode.workspace.getConfiguration('iarproject', null);
		const projectFile = config.get<string>('projectFile');
		
		let xml_string = fs.readFileSync(projectFile, "utf8");

		parseString(xml_string, function(error: null, result: any) {
			if (error === null) {
				var output = { modified: false };

				lookInGroup(result.project.group, "$PROJ_DIR$", filePath, output);

				if (output.modified) {
					var builder = new xml2js.Builder({renderOpts: { "pretty": true, "indent": "    ", "newline": "\r\n"}});
					var xml = builder.buildObject(result);

					fs.writeFile(projectFile, xml, function(err: any, data: any) {
						if (err) {
							console.log(err);
						} else {
							vscode.window.showInformationMessage("Added '" + filePath + "' to the IAR project");
						}
					});
				}
			}
			else {
				console.log(error);
			}
		});
	});

	context.subscriptions.push(disposable);
}

function lookInGroup(root: any, path: string, fileToAdd: string, output: {modified: boolean}) {
	var folderFound = false;
	root.forEach((element: any) => {
		var folderName = path === "" ? element.name : path + "\\" + element.name;
		var fileToAddPath = getFilePath(fileToAdd);
		if (folderName.toUpperCase() === fileToAddPath.toUpperCase()) {
			folderFound = true;
		}
		
		var fileFound = false;
		for (const key in element) {
			if (element.hasOwnProperty(key)) {
				if (key === "group") {
					if (lookInGroup(element[key], folderName, fileToAdd, output)) {
						folderFound = true;
					}
				} else if (key === "file") {
					if (folderName.toUpperCase() === fileToAddPath.toUpperCase() && lookInFile(element[key], folderName, fileToAdd)) {
						fileFound = true;
					}
				}
			}
		}

		if (!folderFound && (folderName.toUpperCase() !== fileToAddPath.toUpperCase()) && hasBasePath(fileToAddPath, folderName)) {
			var folder = fileToAddPath.substring(folderName.length + 1).split("\\")[0];
			var newGroup = { name: [folder] };
			if (element.hasOwnProperty("group")) {
				element.group.push(newGroup);
			} else {
				element.group = [newGroup];
			}
			lookInGroup(element.group, folderName, fileToAdd, output);
			folderFound = true;
		}

		if (!fileFound && folderName.toUpperCase() === fileToAddPath.toUpperCase()) {
			console.log("Adding file '" + fileToAdd + "' to folder '" + folderName + "'");

			var newFile = {name: [fileToAdd]};
			if (element.hasOwnProperty("file")) {
				element.file.push(newFile);
			} else {
				element.file = [newFile];
			}

			output.modified = true;
		}


	});
	return folderFound;
}

function hasBasePath(path: string, basePath: any) {
	var basePathFolders = basePath.toUpperCase().split("\\");
	var pathFolders = path.toUpperCase().split("\\");

	if (pathFolders.length < basePathFolders.length) { 
		return false; 
	}

	for (let index = 0; index < basePathFolders.length; index++) {
		if (basePathFolders[index] !== pathFolders[index]) {
			return false;
		}
	}

	return true;
}

function getFilePath(fileToAdd: string) {
	var fileStartIndex = fileToAdd.lastIndexOf("\\");
	return (fileStartIndex >= 0) ? fileToAdd.substr(0, fileStartIndex) : "";
}

function lookInFile(root: any, path: string, fileToAdd: string) {
	var found = false;
	root.forEach((element: any) => {
		if (fileToAdd.toUpperCase() === element.name[0].toUpperCase()) {
			console.log("Found file '" + fileToAdd + "' in folder '" + path + "'");
			found = true;
		}
	});

	return found;
}

// this method is called when your extension is deactivated
export function deactivate() {}
