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