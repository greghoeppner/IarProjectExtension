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

### 0.0.6

* Fixed sorting in the IAR Explorer.

### 0.0.5

* Updated the project file watcher to not care about file case.
* Updated the IAR Explorer to sort the Treeview.

### 0.0.4

* Added a refresh button to the explorer bar in the event that the auto refresh does not work.

### 0.0.3

* Fixed issue where duplicate files were being added to the root folder.
* Added a new view to show the contents of the IAR project file and allow the removal of files from the IAR projects.

### 0.0.2

* Added the ability to select and add multiple files to the project.
* Allows adding files of type .c, .h, .cpp, .s, .a, and .lib.

### 0.0.1

* Initial release.
