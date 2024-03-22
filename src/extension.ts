
// region[Imports]

import * as vscode from 'vscode';
import { ALL_SUB_EXTENSIONS, ALL_ENABLED_SUB_EXTENSIONS, activate_all_sub_extensions, deactivate_all_sub_extensions } from "./sub_extensions";

import { SubExtension } from "typings/general";

import { FreeCommand, AbstractCommand } from "#bases";

import * as utils from "#utilities";



// endregion[Imports]


class GeneralDebugCommand extends FreeCommand {
	public readonly name: string = "antistasi.generic-debug";
	public readonly config_key: string = "antistasiDevelopment";

	private _timeout?: NodeJS.Timeout;

	constructor () {
		super();

	}

	async _callback () {
		console.log(`timer triggered at ${new Date().toTimeString()}`);

		const _ = await vscode.commands.executeCommand("antistasi.only-scan-for-all-undefined-stringtable-keys");
	}
	protected async execute (...args: any[]): Promise<void> {



		if (this._timeout) {
			await vscode.window.showInformationMessage("already activated");
			return;
		}



		this._timeout = setInterval(this._callback, 90 * 1000);
	}

	public async dispose (): Promise<void> {
		if (this._timeout) {
			clearTimeout(this._timeout);
		}

	}

}


class AntistasiDevelopmentExtension implements vscode.Disposable {
	context: vscode.ExtensionContext;
	config: vscode.WorkspaceConfiguration;

	readonly available_sub_extensions: ReadonlyArray<SubExtension>;
	readonly activated_sub_extensions: SubExtension[];
	readonly is_development: boolean;
	commands: FreeCommand[];

	constructor (context: vscode.ExtensionContext) {
		this.context = context;
		this.config = this.retrieve_config();

		this.available_sub_extensions = Array.from(ALL_SUB_EXTENSIONS);
		this.activated_sub_extensions = [];
		this.is_development = (context.extensionMode === vscode.ExtensionMode.Development);
		this.commands = [new GeneralDebugCommand()];
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




	private async set_context_values (): Promise<void> {
		await vscode.commands.executeCommand('setContext', 'antistasiDevelopment.isDev', this.is_development);

	}

	async start_up (): Promise<void> {


		await this.set_context_values();

		for (const command of this.commands) {
			await command.register(this.context);
			this.context.subscriptions.push(command);
		}

		const activation_tasks: Promise<void>[] = [];

		for (const sub_extension of this.available_sub_extensions) {
			if (!sub_extension.__enabled__) { continue; }

			activation_tasks.push(this.activate_sub_extension(sub_extension));

		};

		await Promise.allSettled(activation_tasks);
	};

	async dispose () {



		await Promise.all([
			...this.activated_sub_extensions.map((sub_extension) => { return ("dispose" in sub_extension) ? sub_extension.dispose!() : sub_extension.deactivate_sub_extension!(); })
		]);

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
