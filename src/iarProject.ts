import * as utility from './utility';
import * as fs from 'fs';
import * as xml2js from 'xml2js';

export function getProjectData(): any {
    var projectFile = utility.getProjectFile();
    var projectData = undefined;

    if (utility.fileExists(projectFile)) {
        let xml_string = fs.readFileSync(projectFile, "utf8");
        xml2js.parseString(xml_string, (error: Error, result: any) => {
            if (error !== null) {
                console.log(error);
                return;
            }
            
            projectData = result;
        });
    }

    return projectData;
}

export function saveProjectData(projectData: any): boolean {
    var projectFile = utility.getProjectFile();
    var builder = new xml2js.Builder({ rootName: "project", renderOpts: { "pretty": true, "indent": "    ", "newline": "\r\n" } });
    var xml = builder.buildObject(projectData.project);
    var hasError = false;
    fs.writeFile(projectFile, xml, function (err: any) {
        if (err) {
            console.log(err);
            hasError = true;
        }
    });
    return !hasError;
}