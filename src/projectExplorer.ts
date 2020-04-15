import * as vscode from 'vscode';
import * as fs from 'fs';
import * as utility from './utility';
const { parseString } = require('xml2js');
import * as iarProject from './iarProject';
import { promises } from 'dns';

interface Entry {
	uri: vscode.Uri;
    type: vscode.FileType;
    originalName: string;
    data: any;
}

export class IarProjectProvider implements vscode.TreeDataProvider<Entry>, vscode.TextDocumentContentProvider {
    private _iarProjectData: any;
	private _onDidChangeTreeData: vscode.EventEmitter<Entry | undefined> = new vscode.EventEmitter<Entry | undefined>();
    readonly onDidChangeTreeData: vscode.Event<Entry | undefined> = this._onDidChangeTreeData.event;
    private watcher: vscode.FileSystemWatcher = vscode.workspace.createFileSystemWatcher("**/*.ewp", false, false, false);;

	constructor() {
        vscode.workspace.onDidChangeConfiguration(() => { this.refresh();});
        this.watcher.onDidChange((e: vscode.Uri) => this.checkForProjectChange(e));
	}

    private checkForProjectChange(e: vscode.Uri) {
        console.log("The IAR project file '" + e.fsPath + "' changed");

        var projectFile = utility.getProjectFile();
        if (projectFile.toUpperCase() === e.fsPath.toUpperCase()) {
            this.refresh();
        }
    }

    public refresh() {
        console.log("Refreshing IAR Explorer");
        this._onDidChangeTreeData.fire();
    }

    readProjectData(data: any, basePath: string): [string, vscode.FileType, string, any][] | Thenable<[string, vscode.FileType, string, any][]> {
        return this._readProjectData(data, basePath);
    }

    async _readProjectData(data: any, basePath: string): Promise<[string, vscode.FileType, string, any][]> {
        const result: [string, vscode.FileType, string, any][] = [];
        if (data.hasOwnProperty("group")) {
            for (let index = 0; index < data.group.length; index++) {
                const path = basePath !== "" ? basePath + "\\" + data.group[index].name[0] : data.group[index].name[0];
                result.push([data.group[index].name[0], vscode.FileType.Directory, path, data.group[index]]);
            }
        }
        if (data.hasOwnProperty("file")) {
            const projectFile = utility.getProjectFile();
            const projectPath = utility.getProjectFolder(projectFile);
            for (let index = 0; index < data.file.length; index++) {
                const name = data.file[index].name[0].replace("$PROJ_DIR$", projectPath);
                result.push([name, vscode.FileType.File, data.file[index].name[0], null]);
            }
        }
        return Promise.resolve(result);
    }

	async getChildren(element?: Entry): Promise<Entry[]> {
        if (element) {
            const children = await this.readProjectData(element.data, element.originalName);
            return children.map(([name, type, originalName, data]) => ({ uri: vscode.Uri.file(name), type, originalName, data }));
        }

        var projectFile = utility.getProjectFile();

        if (utility.fileExists(projectFile)) {
            let xml_string = fs.readFileSync(projectFile, "utf8");
            parseString(xml_string, (error: null, result: any) => {
                if (error !== null) {
                    console.log(error);
                    return;
                }
                
                this._iarProjectData = result;
            });
            if (this._iarProjectData) {
                var project = this._iarProjectData.project;

                const children = await this.readProjectData(project, "");
                children.sort((a, b) => {
                    if (a[1] === b[1]) {
                        return a[0].localeCompare(b[0]);
                    }
                    return a[1] === vscode.FileType.Directory ? -1 : 1;
                });
                return children.map(([name, type, originalName, data]) => ({ uri: vscode.Uri.file(name), type, originalName, data }));
            }
        }

		return [];
	}

	getTreeItem(element: Entry): vscode.TreeItem {
		const treeItem = new vscode.TreeItem(element.uri, element.type === vscode.FileType.Directory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
		if (element.type === vscode.FileType.File) {
			treeItem.command = { command: 'projectExplorer.openFile', title: "Open File", arguments: [element.uri], };
			treeItem.contextValue = 'file';
		}
		return treeItem;
    }
    
    public provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<string> {
		return ""; //this.model.getContent(uri).then(content => content);
	}
}

export class ProjectExplorer {

	private projectExplorer: vscode.TreeView<Entry>;

	constructor(context: vscode.ExtensionContext) {
        const treeDataProvider = new IarProjectProvider();
		this.projectExplorer = vscode.window.createTreeView('projectExplorer', { treeDataProvider, canSelectMany: true });
        vscode.commands.registerCommand('projectExplorer.openFile', (resource) => this.openResource(resource));
        vscode.commands.registerCommand('projectExplorer.removeFromProject', (...args) => this.removeFromProject(args));
        vscode.commands.registerCommand('projectExplorer.refresh', () => treeDataProvider.refresh());
	}

	private openResource(resource: vscode.Uri): void {
		vscode.window.showTextDocument(resource);
    }
    
    private removeFromProject(args: any) {
        console.log(args);
        iarProject.getProjectData()
            .then(projectData => {
                if (args[1]) {
                    var writeData = false;
                    for (let index = 0; index < args[1].length; index++) {
                        const entry = args[1][index];
                        if (this.handleRemove(entry, projectData)) {
                            writeData = true;
                        }
                    }
                    return writeData ? projectData : undefined;
                } else if (args[0]) {
                    return this.handleRemove(args[0], projectData);
                }
                return undefined;
            })
            .then(projectData => {
                if (projectData) {
                    iarProject.saveProjectData(projectData);
                }
            })
            .catch(reason => console.log(reason));

    }

    async handleRemove(item: any, projectData: any): Promise<any> {
        if (item.type === vscode.FileType.Directory) {
            var groups = item.originalName.split("\\");
            if (this.removeGroup(groups, projectData.project)) {
                return Promise.resolve(projectData);
            }
        }
        
        if (item.type === vscode.FileType.File) {
            if (this.removeFile(item.originalName, projectData.project)) {
                return Promise.resolve(projectData);
            }
        }

        return Promise.resolve(undefined);
    }

    private removeGroup(groups: any, data: any): boolean {
        if (data.hasOwnProperty("group")) {
            for (let index = 0; index < data.group.length; index++) {
                const group = data.group[index];
                if (group.name[0] === groups[0]) {
                    if (groups.length === 1) {
                        data.group.splice(index, 1);
                        if (data.group.length === 0) {
                            delete data.group;
                        }
                        return true;
                    } else {
                        groups.splice(0, 1);
                        return this.removeGroup(groups, group);
                    }
                }
            }
        }

        return false;
    }

    private removeFile(fileName: any, data: any): boolean {
        if (data.hasOwnProperty("file")) {
            for (let index = 0; index < data.file.length; index++) {
                if (data.file[index].name[0] === fileName) {
                    data.file.splice(index, 1);
                    if (data.file.length === 0) {
                        delete data.file;
                    }
                    return true;
                }
            }
        }
        if (data.hasOwnProperty("group")) {
            for (let index = 0; index < data.group.length; index++) {
                if (this.removeFile(fileName, data.group[index])) {
                    return true;
                }
            }
        }
        return false;
    }
}