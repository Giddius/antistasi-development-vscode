
// region[Imports]

import * as vscode from 'vscode';

import { ALL_SUB_EXTENSIONS, ALL_ENABLED_SUB_EXTENSIONS, activate_all_sub_extensions, deactivate_all_sub_extensions } from "./sub_extensions";
import * as stringtable_data from "./sub_extensions/stringtable_data/index";
import { SubExtension } from "typings/general";

import * as utils from "#utilities";


// endregion[Imports]



class Extension implements vscode.Disposable {
	context: vscode.ExtensionContext;
	config: vscode.WorkspaceConfiguration;

	readonly available_sub_extensions: SubExtension[];
	readonly activated_sub_extensions: SubExtension[];

	constructor (context: vscode.ExtensionContext) {
		this.context = context;
		this.config = this.get_config();

		this.available_sub_extensions = Array.from(ALL_SUB_EXTENSIONS);
		this.activated_sub_extensions = [];
	}

	get_config (): vscode.WorkspaceConfiguration {
		return vscode.workspace.getConfiguration("antistasiDevelopment");
	}

	get subscriptions (): vscode.Disposable[] {
		return this.context.subscriptions;
	};

	async dispose () {
		return Promise.all(this.activated_sub_extensions.map((sub_extension) => { return ("dispose" in sub_extension) ? sub_extension.dispose!() : sub_extension.deactivate_sub_extension!(); }));
	};
};


export async function activate (context: vscode.ExtensionContext): Promise<any> {



	if (!utils.is_inside_workspace()) { return; };

	await activate_all_sub_extensions(context);



}

// This method is called when your extension is deactivated
export async function deactivate () {

	await deactivate_all_sub_extensions();

}
