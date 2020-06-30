import * as vscode from 'vscode';
import * as iarProject from './iarProject';
import { promises } from 'dns';
import * as utility from './utility';

export class ConfigurationProvider implements vscode.TreeDataProvider<Setting> {
	private _onDidChangeTreeData: vscode.EventEmitter<Setting | undefined> = new vscode.EventEmitter<Setting | undefined>();
    readonly onDidChangeTreeData: vscode.Event<Setting | undefined> = this._onDidChangeTreeData.event;
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
        console.log("Refreshing Configuration Explorer");
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: Setting): vscode.TreeItem {
        return element;
    }

    getChildren(element?: Setting): Thenable<Setting[]> {
        if (element) {
            return element.getChildren();
        } else {
            return iarProject.getProjectData()
                .then(projectData => {
                    if (projectData.project.hasOwnProperty("configuration")) {
                        return Promise.resolve(projectData.project.configuration.map((item: any) => new ConfigurationSetting(item)));
                    }
                    return Promise.resolve([]);
                });
        }
    }
}

export class Setting extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
    }

    public getChildren(): Thenable<Setting[]> {
        return Promise.resolve([]);
    }
}

class ConfigurationSetting extends Setting {
    constructor(readonly configuration: any) {
        super(configuration.name[0], vscode.TreeItemCollapsibleState.Collapsed);
    }

    public getChildren(): Thenable<Setting[]> {
        var children: Setting[] = [];
        if (this.configuration.hasOwnProperty('settings')) {
            var iccarm = this.configuration.settings.find((e: any) => e.name[0] === 'ICCARM');
            if (iccarm !== undefined) {
                children.push(new CompilerSettings(this.label + '/' + iccarm.name[0], iccarm));
            }
            var aarm = this.configuration.settings.find((e: any) => e.name[0] === 'AARM');
            if (aarm !== undefined) {
                children.push(new AssemblerSettings(this.label + '/' + aarm.name[0], aarm));
            }            
        }

        return Promise.resolve(children);
    }
}

class CompilerSettings extends Setting {
    constructor(readonly config: string, readonly compilerConfig: any) {
        super("C/C++ Compiler", vscode.TreeItemCollapsibleState.Collapsed);
    }

    public getChildren(): Thenable<Setting[]> {
        var includes = this.compilerConfig.data[0].option.find((e: any) => e.name[0] === 'CCIncludePath2');

        if (includes !== undefined) {
            return Promise.resolve([new IncludeRootSetting(this.config + '/' + includes.name[0], includes)]);
        }
            
        return Promise.resolve([]);
    }
}

class AssemblerSettings extends Setting {
    constructor(readonly config: string, readonly assemblerConfig: any) {
        super("Assembler", vscode.TreeItemCollapsibleState.Collapsed);
    }

    public getChildren(): Thenable<Setting[]> {
        var includes = this.assemblerConfig.data[0].option.find((e: any) => e.name[0] === 'AUserIncludes');

        if (includes !== undefined) {
            return Promise.resolve([new IncludeRootSetting(this.config + '/' + includes.name[0], includes)]);
        }
            
        return Promise.resolve([]);
    }
}

class IncludeRootSetting extends Setting {
    constructor(readonly config: string, readonly includes: any) {
        super("Includes", vscode.TreeItemCollapsibleState.Collapsed);
    }

    public getChildren(): Thenable<Setting[]> {
        return Promise.resolve(this.includes.state.map((item: string) => new IncludeSetting(this.config, item)));
    }
    
}

class IncludeSetting extends Setting {
    constructor(readonly config: string, readonly label: string) {
        super(label, vscode.TreeItemCollapsibleState.None);
    }
}