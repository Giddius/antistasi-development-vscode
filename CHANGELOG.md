# Change Log

All notable changes to the "antistasi-development" extension will be documented in this file.

<!-- Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file. -->

## [0.0.1] - 2023-12-13

- Initial release


## [0.1.0] - 2023-12-14

- version bump to indicate first working version.

### Fixed

#### Stringtable-Data

- Stringtable data is now refreshed if a `Stringtable.xml` file is saved.
- Stringtable-Data features now working in Arma config files again.



## [0.1.1] - 2023-12-14

### Fixed

#### Stringtable-Data

- Malformed `Stringtable.xml`-files will now not prevent loading data from non-malformed `Stringtable.xml`-files.
- Stringtable Data is now reloaded when git-branch is changed.





## [0.2.0] - 2023-12-19

### Added

#### Stringtable-Data

- Stringtable keys that are not defined in a `Stringtable.xml`-file are now marked as problems.


## [0.2.1] - 2023-12-25

### Fixed

#### Stringtable-Data

- `<br/>` are now correctly transformed to `\n` in the preview of the stringtable-key value.

- Now also works in `.inc` files and other file extensions can be added via the setting `antistasiDevelopment.stringtable_data.extraFileNameExtensions`, but this requires a restart to take effect.


### Added

#### Stringtable-Data

- Preview now shows the amount of replacement placeholder and a list of them.