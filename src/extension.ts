
// region[Imports]

import * as vscode from 'vscode';


import * as stringtable_data from "./stringtable_data";

// endregion[Imports]

const SUB_EXTENSIONS = [stringtable_data]


export async function activate(context: vscode.ExtensionContext) {


	if (!vscode.workspace.workspaceFolders) return;

	await Promise.all(SUB_EXTENSIONS.map((value) => value.activate_sub_extension(context)))




}

// This method is called when your extension is deactivated
export async function deactivate() {
	await Promise.all(SUB_EXTENSIONS.map((value) => value.deactivate_sub_extension()))

}
