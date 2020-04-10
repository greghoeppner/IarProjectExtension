# IAR Project

This visual studio code extension is to allow making changes to an IAR project without having to open the IAR tool. Currently this only supports adding files to the project.

## Features

Adding files to the IAR project.

## Requirements

Must be using IAR and have added the IAR project file to the settings.json.

## Extension Settings

To allow this extension to function, please add the IAR project to the settings.json.

* `iarproject.projectFile`: The full path to the IAR project file.

## Known Issues

File renaming does not update the IAR project.

## Release Notes

### 0.0.2

* Added the ability to select and add multiple files to the project.
* Allows adding files of type .c, .h, .cpp, .s, .a, and .lib.

### 0.0.1

* Initial release.
