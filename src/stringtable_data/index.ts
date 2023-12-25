
// region[Imports]

import * as vscode from 'vscode';




import * as path from "path";


import * as fs from "fs";

import * as utilities from "../utilities";

import { StringTableDataStorage } from "./storage";

import { StringTableProvider } from "./provider";


// endregion[Imports]



let STRINGTABLE_PROVIDER: StringTableProvider | undefined;

let STRINGTABLE_DATA: StringTableDataStorage | undefined;



export async function activate_sub_extension (context: vscode.ExtensionContext): Promise<void> {

    // console.profile();
    const root_workspace_folder: vscode.WorkspaceFolder | undefined = vscode.workspace.workspaceFolders?.at(0);

    const config = vscode.workspace.getConfiguration("antistasiDevelopment.stringtable_data", root_workspace_folder);



    STRINGTABLE_DATA = new StringTableDataStorage();
    STRINGTABLE_PROVIDER = new StringTableProvider(STRINGTABLE_DATA);





    const disposables: Array<vscode.Disposable[]> = await Promise.all([STRINGTABLE_PROVIDER.register(), STRINGTABLE_DATA.register()]);

    for (let disposable of disposables.flat()) {
        context.subscriptions.push(disposable);
    };







};



export async function deactivate_sub_extension () {
    await STRINGTABLE_DATA?.clear();
    await STRINGTABLE_PROVIDER?.clear();

    STRINGTABLE_DATA = undefined;
    STRINGTABLE_PROVIDER = undefined;


    // console.profileEnd();

};