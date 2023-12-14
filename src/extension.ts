
// region[Imports]

import * as vscode from 'vscode';


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
