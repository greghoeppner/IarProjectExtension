import * as vscode from 'vscode';
import * as fs from 'fs';
import * as utility from './utility';
const { parseString } = require('xml2js');

interface Entry {
	uri: vscode.Uri;
    type: vscode.FileType;
    data: any;
}

export class IarProjectProvider implements vscode.TreeDataProvider<Entry>, vscode.TextDocumentContentProvider {
    private _iarProjectData: any;
	private _onDidChangeTreeData: vscode.EventEmitter<Entry | undefined> = new vscode.EventEmitter<Entry | undefined>();
    readonly onDidChangeTreeData: vscode.Event<Entry | undefined> = this._onDidChangeTreeData.event;
    private watcher: vscode.FileSystemWatcher | undefined;

	constructor() {
        this.addProjectWatcher();
        vscode.workspace.onDidChangeConfiguration(() => { this.addProjectWatcher();});
	}

    private addProjectWatcher() {
        var forceRefresh = false;
        if (this.watcher) {
            this.watcher.dispose();
            this.watcher = undefined;
            forceRefresh = true;
        }
    
        var projectFile = utility.getProjectFile();

        if (utility.fileExists(projectFile)) {
            this.watcher = vscode.workspace.createFileSystemWatcher(projectFile, false, false, false);

            this.watcher.onDidChange((uri: vscode.Uri) => {
                this._onDidChangeTreeData.fire();
            });
        }
        if (forceRefresh) {
            this._onDidChangeTreeData.fire();
        }
    }

    readProjectData(data: any): [string, vscode.FileType, any][] | Thenable<[string, vscode.FileType, any][]> {
        return this._readProjectData(data);
    }

    async _readProjectData(data: any): Promise<[string, vscode.FileType, any][]> {
        const result: [string, vscode.FileType, any][] = [];
        if (data.hasOwnProperty("group")) {
            for (let index = 0; index < data.group.length; index++) {
                const name = data.group[index].name;
                result.push([name, vscode.FileType.Directory, data.group[index]]);
            }
        }
        if (data.hasOwnProperty("file")) {
            for (let index = 0; index < data.file.length; index++) {
                const name = data.file[index].name;
                result.push([name, vscode.FileType.File, null]);
            }
        }
        return Promise.resolve(result);
    }

	async getChildren(element?: Entry): Promise<Entry[]> {
        if (element) {
            const children = await this.readProjectData(element.data);
            return children.map(([name, type, data]) => ({ uri: vscode.Uri.parse(name), type, data }));
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

                const children = await this.readProjectData(project);

                return children.map(([name, type, data]) => ({ uri: vscode.Uri.parse(name), type, data }));
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
		this.projectExplorer = vscode.window.createTreeView('projectExplorer', { treeDataProvider });
		vscode.commands.registerCommand('projectExplorer.openFile', (resource) => this.openResource(resource));
	}

	private openResource(resource: vscode.Uri): void {
		vscode.window.showTextDocument(resource);
	}
}