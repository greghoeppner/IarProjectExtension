import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function getProjectFile(): string {
    const config = vscode.workspace.getConfiguration('iarproject', null);
    var workspaceFolder = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : "";
    return config.get<string>('projectFile')?.replace("${workspaceFolder}", workspaceFolder) ?? "";
}

export function getProjectFolder(projectFile: string): string {
    return path.win32.dirname(projectFile);
}

export function fileExists(path: string): boolean {
    return fs.existsSync(vscode.Uri.file(path).fsPath);
}
