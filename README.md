# ANTISTASI-DEVELOPMENT VSCode Extension

VSCode extension to help with the development of the Arma 3 mod [__Antistasi__](https://antistasi.de/).

Each sub-extension can be turned on and off separetely.



## Sub-Extensions

- Stringtable-Data


## Features

### Stringtable-Data

- Get the english text when hovering over a Stringtable Key.
- Get the location of where the Text for a Stringtable Key is defined on `right-click`->`Go to Definition`.
    - see [Hover Data](#hover-data)


- Command `scan-for-all-undefined-stringtable-keys` to check all files for undefined stringtable-keys and present them in a special view that also has the ability to save this data in multiple formats.
    - see [Showcase Command `scan-for-all-undefined-stringtable-keys`](#command-scan-for-all-undefined-stringtable-keys)


- Command `convert-to-stringtable-key` to convert a selected string to a stringtable key. This puts the string into the `Stringtable.xml`-file and also replaces the string in the original file with a `translate` + the new stringtable-key.
    - see [Showcase Command `convert-to-stringtable-key`](#command-convert-to-stringtable-key)


- Command `insert-stringtable-key` to create a new stringtable-key in the `Stringtable.xml`-file. This is also available as `Quick fix` when encountering undefined stringtable-keys.
    - see [Showcase Command `insert-stringtable-key`](#command-insert-stringtable-key)


### Snippets

- Interactive snippet for the sqf-function header-comment (snippet-name: `header_comment`)
    - see [Showcase Header Comment Snippet](#header-comment-snippet)







## Showcase


### Hover Data

![Key Hover](https://github.com/Giddius/antistasi-development-vscode/blob/main/images/stringtable_key_hover_presentation.png?raw=true)


---


### Command `scan-for-all-undefined-stringtable-keys`

![Scan for undefined keys Command](https://github.com/Giddius/antistasi-development-vscode/blob/main/images/gifs/undefined_key_scan_command_presentation.gif?raw=true)


---


### Command `convert-to-stringtable-key`

![Convert to key Command](https://github.com/Giddius/antistasi-development-vscode/blob/main/images/gifs/convert_to_key_command_presentation.gif?raw=true)

---

### Command `insert-stringtable-key`

![Insert key Command](https://github.com/Giddius/antistasi-development-vscode/blob/main/images/gifs/insert_key_command_presentation.gif?raw=true)

---

### Header Comment Snippet

![Header Comment Snippet](https://github.com/Giddius/antistasi-development-vscode/blob/main/images/gifs/header_comment_snippet_presentation.gif?raw=true)
