// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { SSL_OP_NO_SESSION_RESUMPTION_ON_RENEGOTIATION } from 'constants';
import { stringify } from 'querystring';
import { ProjectExplorer } from './projectExplorer';
import * as utility from './utility';
const { parseString } = require('xml2js');
const xml2js = require("xml2js");
const fs = require('fs');

export async function activate(context: vscode.ExtensionContext) {
	await setupExtension();
	verifyExtensionSettings();

	new ProjectExplorer(context);

	vscode.workspace.onDidChangeConfiguration(() => { verifyExtensionSettings(); });

	let disposable = vscode.commands.registerCommand('extension.addToIarProject', (...args) => { handleAddToIarProject(args); });

	context.subscriptions.push(disposable);
}

async function setupExtension() {
	const config = vscode.workspace.getConfiguration('iarproject', null);
	if (config.projectFile === null) {
		await vscode.workspace.findFiles("*.ewp").then((value) => {
			config
				.update("projectFile", value[0].fsPath, vscode.ConfigurationTarget.Workspace)
				.then(undefined, (reason) => {
					console.log("Unable to update the project file setting: " + reason);
			});
		});
	}
}

function verifyExtensionSettings() {
	vscode.commands.executeCommand('setContext', 'iarProjectExtensionEnabled', utility.fileExists(utility.getProjectFile()));
}

function handleAddToIarProject(args: any[]) {
	const config = vscode.workspace.getConfiguration('iarproject', null);
	var workspaceFolder = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : "";
	const projectFile = config.get<string>('projectFile')?.replace("${workspaceFolder}", workspaceFolder);
	let xml_string = fs.readFileSync(projectFile, "utf8");
	parseString(xml_string, function (error: null, result: any) {
		if (error === null) {
			var output = { modified: false };
			if (args.length > 1) {
				for (let index = 0; index < args[1].length; index++) {
					const uri = args[1][index] as vscode.Uri;
					console.log(uri.fsPath);
					
					if (isIarFileType(uri.fsPath)) {
						processUri(uri, result, output);
					}
				}
			}
			if (output.modified) {
				var builder = new xml2js.Builder({ rootName: "project", renderOpts: { "pretty": true, "indent": "    ", "newline": "\r\n" } });
				var xml = builder.buildObject(result.project);
				fs.writeFile(projectFile, xml, function (err: any, data: any) {
					if (err) {
						console.log(err);
					}
					else {
						vscode.window.showInformationMessage("Added " + args[1].length + " file(s) to the IAR project");
					}
				});
			}
		}
		else {
			console.log(error);
		}
	});
}

function isIarFileType(path: string): boolean {
	const re = /(^.c$|^.h$|^.cpp$|^.a$|^.lib$|^.s$)/;
	var result = re.exec(getExtension(path));
	if (result) {
		return true;
	}
	return false;
}

function getExtension(path: string): string {
	const re = /(?:\.([^.]+))?$/;
	var result = re.exec(path);
	if (result) {
		return result[0];
	}
	return "";
}

function processUri(uri: vscode.Uri, iarJson: any, output: { modified: boolean; }) {
	var workspaceFolder = vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath ?? "";
	var filePath = uri.fsPath.replace(workspaceFolder, "$PROJ_DIR$");
	console.log("Attempting to add '" + filePath + "' to the IAR project");

	addFileToProject(iarJson.project, filePath, output);
}

function addFileToProject(project: any, filePath: string, output: { modified: boolean; }) {
	var found = false;
	if (project.hasOwnProperty("group")) {
		found = lookInGroup(project.group, "$PROJ_DIR$", filePath, output);
	}
	if (!found) {
		var fileToAddPath = getFilePath(filePath);
		if (fileToAddPath.toUpperCase() !== "$PROJ_DIR$") {
			addGroup(fileToAddPath, "$PROJ_DIR$", project, filePath, output);
		} else {
			if (!project.hasOwnProperty("file") || !lookInFile(project.file, "PROJ_DIR$", filePath)) {
				addFile(filePath, project, output);
			}
		}
	}
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
			addGroup(fileToAddPath, folderName, element, fileToAdd, output);
			folderFound = true;
		}

		if (!fileFound && folderName.toUpperCase() === fileToAddPath.toUpperCase()) {
			console.log("Adding file '" + fileToAdd + "' to folder '" + folderName + "'");
			addFile(fileToAdd, element, output);
		}


	});
	return folderFound;
}

function addGroup(fileToAddPath: string, folderName: any, element: any, fileToAdd: string, output: { modified: boolean; }) {
	var folder = fileToAddPath.substring(folderName.length + 1).split("\\")[0];
	var newGroup = { name: [folder] };
	if (element.hasOwnProperty("group")) {
		element.group.push(newGroup);
	}
	else {
		element.group = [newGroup];
	}
	lookInGroup(element.group, folderName, fileToAdd, output);
}

function addFile(fileToAdd: string, element: any, output: { modified: boolean; }) {
	var newFile = { name: [fileToAdd] };
	if (element.hasOwnProperty("file")) {
		element.file.push(newFile);
	}
	else {
		element.file = [newFile];
	}
	output.modified = true;
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
