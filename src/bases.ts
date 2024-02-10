
// region[Imports]

import * as vscode from 'vscode';
import * as path from "path";
import * as fs from "fs-extra";
import * as utils from "#utilities";

// endregion[Imports]



export abstract class BaseCommand<T> implements vscode.Disposable {
    protected config: vscode.WorkspaceConfiguration;


    constructor () {
        this.config = this.load_config();
    };




    abstract get name (): string;

    get enabled (): boolean {
        return true;
    };

    abstract get config_key (): string;

    protected load_config (): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration(this.config_key);
    };

    protected abstract execute (...args: any[]): Promise<T | undefined>;


    public async call (...args: any[]) {
        if (this.enabled === false) {
            await this.show_command_disabled_message();
            return;
        };
        return await this.execute(...args);
    };


    protected show_command_disabled_message = async (): Promise<void> => {
        const text: string = `Command ${this.name} is disabled!`;
        await vscode.window.showInformationMessage(text, { modal: true });
    };

    public async register (context: vscode.ExtensionContext): Promise<vscode.Disposable[]> {
        const disposables: vscode.Disposable[] = [];

        disposables.push(vscode.commands.registerCommand(this.name, this.call, this));



        return disposables;
    };


    dispose () {

    };
}