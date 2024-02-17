
// region[Imports]

import * as vscode from 'vscode';

import { ALL_SUB_EXTENSIONS, ALL_ENABLED_SUB_EXTENSIONS, activate_all_sub_extensions, deactivate_all_sub_extensions } from "./sub_extensions";
import * as stringtable_data from "./sub_extensions/stringtable_data/index";
import { SubExtension } from "typings/general";

import * as utils from "#utilities";
import { error } from "console";


// endregion[Imports]



class AntistasiDevelopmentExtension implements vscode.Disposable {
	context: vscode.ExtensionContext;
	config: vscode.WorkspaceConfiguration;

	readonly available_sub_extensions: ReadonlyArray<SubExtension>;
	readonly activated_sub_extensions: SubExtension[];
	readonly is_development: boolean;

	constructor (context: vscode.ExtensionContext) {
		this.context = context;
		this.config = this.retrieve_config();

		this.available_sub_extensions = Array.from(ALL_SUB_EXTENSIONS);
		this.activated_sub_extensions = [];
		this.is_development = (context.extensionMode === vscode.ExtensionMode.Development);
	}

	retrieve_config (): vscode.WorkspaceConfiguration {
		return vscode.workspace.getConfiguration("antistasiDevelopment");
	}



	get subscriptions (): vscode.Disposable[] {
		return this.context.subscriptions;
	};

	private async activate_sub_extension (sub_extension: SubExtension): Promise<void> {
		await sub_extension.activate_sub_extension(this.context);

		this.activated_sub_extensions.push(sub_extension);

	}

	dev_command = async (...args: any[]) => {

		await vscode.window.showInformationMessage("Debug command triggered");
	};

	async start_up (): Promise<void> {

		await vscode.commands.executeCommand('setContext', 'antistasiDevelopment.isDev', this.is_development);


		this.subscriptions.push(vscode.commands.registerCommand("antistasi.generic-debug", this.dev_command, this));

		const activation_tasks: Promise<void>[] = [];

		for (const sub_extension of this.available_sub_extensions) {
			if (!sub_extension.__enabled__) { continue; }

			activation_tasks.push(this.activate_sub_extension(sub_extension));
		};

		await Promise.allSettled(activation_tasks);
	};

	async dispose () {
		try {
			await Promise.allSettled(this.activated_sub_extensions.map((sub_extension) => { return ("dispose" in sub_extension) ? sub_extension.dispose!() : sub_extension.deactivate_sub_extension!(); }));
		} catch (e) {
			console.log(e);
			throw (e);
		}
		console.log("done disposing 'AntistasiDevelopmentExtension'");
	};
};


export async function activate (context: vscode.ExtensionContext): Promise<any> {



	if (!utils.is_inside_workspace()) { return; };

	const antistasi_dev_extension = new AntistasiDevelopmentExtension(context);
	context.subscriptions.push(antistasi_dev_extension);

	await antistasi_dev_extension.start_up();


}

// This method is called when your extension is deactivated
export async function deactivate () {

	// await deactivate_all_sub_extensions();

}
