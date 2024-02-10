
// region[Imports]

import * as vscode from 'vscode';




import * as path from "path";


import * as fs from "fs-extra";

import * as utils from "#utilities";

import { StringTableDataStorage } from "./storage";

import { StringTableProvider } from "./provider";



import { InsertNewStringtableKeyCommand, ConvertToStringtableKeyCommand } from "./commands";

// endregion[Imports]


export const __enabled__: boolean = true;


export const __name__: string = "stringtable_data";

export const __pretty_name__: string = "Stringtable-Data";


let STRINGTABLE_PROVIDER: StringTableProvider | undefined;

let STRINGTABLE_DATA: StringTableDataStorage | undefined;

let INSERT_STRINGTABLE_COMMAND: InsertNewStringtableKeyCommand | undefined;

let CONVERT_TO_STRINGTABLE_COMMAND: ConvertToStringtableKeyCommand | undefined;

let _get_stringtable_data = () => {
    return STRINGTABLE_DATA;
};







export async function activate_sub_extension (context: vscode.ExtensionContext): Promise<void> {


    // console.profile();
    if (!utils.is_inside_workspace()) { return; };

    const root_workspace_folder: vscode.WorkspaceFolder = utils.get_base_workspace_folder()!;

    const config = vscode.workspace.getConfiguration("antistasiDevelopment.stringtable_data", root_workspace_folder);



    STRINGTABLE_DATA = new StringTableDataStorage();
    STRINGTABLE_PROVIDER = new StringTableProvider(STRINGTABLE_DATA);

    INSERT_STRINGTABLE_COMMAND = new InsertNewStringtableKeyCommand(STRINGTABLE_DATA);

    CONVERT_TO_STRINGTABLE_COMMAND = new ConvertToStringtableKeyCommand(STRINGTABLE_DATA);


    await vscode.commands.executeCommand('setContext', 'antistasiDevelopment.supportedFileextensions', STRINGTABLE_PROVIDER.allowed_file_name_extensions);
    // vscode.commands.executeCommand('setContext', 'antistasiDevelopment.contextMenuEnabled', false);



    const disposables: vscode.Disposable[][] = (await Promise.all([STRINGTABLE_DATA.register(context), STRINGTABLE_PROVIDER.register(context), INSERT_STRINGTABLE_COMMAND.register(context), CONVERT_TO_STRINGTABLE_COMMAND.register(context)]));
    context.subscriptions.push(...disposables.flat());



    await STRINGTABLE_DATA.load_all();
    utils.sleep(3 * 1000).then(() => { STRINGTABLE_PROVIDER!.reload_problems(); });


    STRINGTABLE_DATA.onDataLoaded(STRINGTABLE_PROVIDER.handle_on_data_reloaded);



};



export async function deactivate_sub_extension () {
    await STRINGTABLE_PROVIDER?.clear();

    await STRINGTABLE_DATA?.dispose();

    STRINGTABLE_DATA = undefined;
    STRINGTABLE_PROVIDER = undefined;


    // console.profileEnd();

};



