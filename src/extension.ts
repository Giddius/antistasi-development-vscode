
// region[Imports]

import * as vscode from 'vscode';


import * as stringtable_data from "./stringtable_data";

// endregion[Imports]




export async function activate(context: vscode.ExtensionContext) {


	if (!vscode.workspace.workspaceFolders) return;


	stringtable_data.activate_sub_extension(context);




}

// This method is called when your extension is deactivated
export async function deactivate() {
	await stringtable_data.deactivate_sub_extension();
}
