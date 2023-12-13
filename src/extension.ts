
// region[Imports]

import * as vscode from 'vscode';
import * as header_gen from './header_generation';


import * as path from "path";

import * as header_parse from "./sqf_function_header_highlighter/parsing";

import * as fs from "fs";

import * as utilities from "./utilities";

import * as stringtable_parsing from "./stringtable_previewer/parsing";



import { StringTableDataStorage } from "./stringtable_previewer/storage"


import * as stringtable_previewer from "./stringtable_previewer";

// endregion[Imports]




export async function activate(context: vscode.ExtensionContext) {


	if (!vscode.workspace.workspaceFolders) return;






	stringtable_previewer.activate_sub_extension(context);




}

// This method is called when your extension is deactivated
export async function deactivate() {
	console.log("deactivate 'Antistasi-Development' extension");
	await stringtable_previewer.deactivate_sub_extension();
}
