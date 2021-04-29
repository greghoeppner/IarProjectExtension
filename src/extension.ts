// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { SSL_OP_NO_SESSION_RESUMPTION_ON_RENEGOTIATION } from 'constants';
import { stringify } from 'querystring';
import { ProjectExplorer } from './projectExplorer';
import * as utility from './utility';
import * as iarProject from './iarProject';
import { settings } from 'cluster';
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
	
	let addToMenu = vscode.commands.registerCommand("extension.addToProjectInclude", (...args) => { handleAddToProjectInclude(args); });

	context.subscriptions.push(addToMenu);
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

function handleAddToProjectInclude(args: any[]) {
	let configs = getProjectConfigurations();
	
	if (configs.length === 0) {
		vscode.window.showInformationMessage("No configurations found in the IAR project file");
		return;
	}

	let items: vscode.QuickPickItem[] = [];
	for (let index = 0; index < configs.length; index++) {
		let item = configs[index];
		items.push({ label: item });
	}
	items.push({ label: 'All', description: 'Adds to all configurations.' });

	vscode.window.showQuickPick(items).then(selection => {
		if (!selection) {
			return;
		}

		var includeFolders = getIncludeFolders(args);

		if (includeFolders.length === 0) {
			vscode.window.showInformationMessage("No folders selected to add to the IAR project.");
			return;
		}

		addIncludesToProject(selection.label, includeFolders);
	});
}

function getProjectConfigurations(): string[] {
	const projectFile = utility.getProjectFile();
	let xml_string = fs.readFileSync(projectFile, "utf8");
	var configurations: string[] = [];
	parseString(xml_string, function (error: null, result: any) {
		if (error !== null) {
			console.log(error);
			return;
		}

		if (result.hasOwnProperty("project")) {
			let project = result.project;
			if (project.hasOwnProperty("configuration")) {
				for (const configuration of project.configuration) {
					if (configuration.hasOwnProperty("name")) {
						configurations.push(configuration.name[0]);
					}
				}
			}
		}
	});

	return configurations;
}

function getIncludeFolders(args: any[]): string[] {
	const projectFile = utility.getProjectFile();
	const projectFolder = utility.getProjectFolder(projectFile);
	var includeFolders: string[] = [];

	if (args.length > 1) {
		for (let index = 0; index < args[1].length; index++) {
			const uri = args[1][index] as vscode.Uri;

			if (isDirectory(uri.fsPath)) {
				if (uri.fsPath.startsWith(projectFolder)) {
					var includePath = "$PROJ_DIR$" + uri.fsPath.substring(projectFolder.length);
					includeFolders.push(includePath);
				}
			}
		}
	}

	return includeFolders;
}

function isDirectory(path: string) {
    try {
        var stat = fs.lstatSync(path);
        return stat.isDirectory();
    } catch (e) {
        // lstatSync throws an error if path doesn't exist
        return false;
    }
}
function addIncludesToProject(selectedConfiguration: string, includeFolders: string[]) {
	iarProject.getProjectData()
		.then(projectData => {
			var configurations = getSelectedConfigurations(projectData, selectedConfiguration);
			var projectModified: boolean = false;

			for (const configuration of configurations) {
				var includeFolderObject = getIncludeFolderObject(configuration);

				for (const includeFolder of includeFolders) {
					if (!includeFolderExists(includeFolderObject, includeFolder)) {
						console.log('Include folder ' + includeFolder + ' added');
						if (includeFolderObject.hasOwnProperty('state')) {
							includeFolderObject.state.push(includeFolder);
							projectModified = true;
						}
					}
				}
			}

			if (projectModified) {
				const projectFile = utility.getProjectFile();
				var builder = new xml2js.Builder({ rootName: "project", renderOpts: { "pretty": true, "indent": "    ", "newline": "\r\n" } });
				var xml = builder.buildObject(projectData.project);
				fs.writeFile(projectFile, xml, function (err: any, data: any) {
					if (err) {
						console.log(err);
					}
					else {
						vscode.window.showInformationMessage("Added include folder(s) to the IAR project");
					}
				});
			}
		});
}

function getSelectedConfigurations(projectData: any, selection: string): any[] {
	var configurations: any[] = [];

	if (projectData.hasOwnProperty('project')) {
		let project = projectData.project;
		if (project.hasOwnProperty("configuration")) {
			for (const configuration of project.configuration) {
				if (configuration.hasOwnProperty("name")) {
					if ((selection === configuration.name[0]) || (selection === 'All')) {
						configurations.push(configuration);
					}
				}
			}
		}
	}

	return configurations;
}

function getIncludeFolderObject(configuration: any): any {
	var includeFolderObject: any = undefined;

	if (configuration.hasOwnProperty('settings')) {
		for (const setting of configuration.settings) {
			if (setting.name[0] === 'ICCARM') {
				if (setting.hasOwnProperty('data') && setting.data[0].hasOwnProperty('option')) {
					for (const option of setting.data[0].option) {
						if (option.hasOwnProperty('name') && option.name[0] === 'CCIncludePath2') {
							includeFolderObject = option;
							break;
						}
					}
				}
			}
		}
	}

	return includeFolderObject;
}

function includeFolderExists(includeFolderObject: any, includeFolder: string): boolean {
	if (includeFolderObject.hasOwnProperty('state')) {
		for (const folder of includeFolderObject.state) {
			if (folder.toUpperCase() === includeFolder.toUpperCase()) {
				return true;
			}
		}
	}

	return false;
}

// this method is called when your extension is deactivated
export function deactivate() {}
