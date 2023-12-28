
// region[Imports]

import * as vscode from 'vscode';




import * as path from "path";


import * as fs from "fs";

import * as utilities from "../utilities";

import { StringTableDataStorage } from "./storage";

import { StringTableProvider } from "./provider";

import { API as GitAPI, GitExtension, APIState } from '../typings/git';

// endregion[Imports]



let STRINGTABLE_PROVIDER: StringTableProvider | undefined;

let STRINGTABLE_DATA: StringTableDataStorage | undefined;



export async function activate_sub_extension (context: vscode.ExtensionContext): Promise<void> {

    // console.profile();
    if (!utilities.is_inside_workspace()) return;

    const root_workspace_folder: vscode.WorkspaceFolder = utilities.get_base_workspace_folder()!;

    const config = vscode.workspace.getConfiguration("antistasiDevelopment.stringtable_data", root_workspace_folder);



    STRINGTABLE_DATA = new StringTableDataStorage();
    STRINGTABLE_PROVIDER = new StringTableProvider(STRINGTABLE_DATA);


    vscode.commands.executeCommand('setContext', 'antistasiDevelopment.supportedFileextensions', STRINGTABLE_PROVIDER.allowed_file_name_extensions);


    const disposables: Array<vscode.Disposable[]> = await Promise.all([STRINGTABLE_DATA.register(), STRINGTABLE_PROVIDER.register()]);

    for (let disposable of disposables.flat()) {
        context.subscriptions.push(disposable);
    };


    await STRINGTABLE_DATA.load_all();
    await STRINGTABLE_PROVIDER!.reload_problems();


    STRINGTABLE_DATA.register_loading_listener(STRINGTABLE_PROVIDER.on_data_reloaded);


};



export async function deactivate_sub_extension () {
    await STRINGTABLE_DATA?.clear();
    await STRINGTABLE_PROVIDER?.clear();

    STRINGTABLE_DATA = undefined;
    STRINGTABLE_PROVIDER = undefined;


    // console.profileEnd();

};