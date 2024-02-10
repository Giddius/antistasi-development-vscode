// region[Imports]

import * as vscode from 'vscode';
import * as path from "path";
import * as fs from "fs-extra";
import * as utilities from "../utilities";
import { StringtableFileData, StringTableDataStorage } from "../sub_extensions/stringtable_data/storage";

// endregion[Imports]



export interface SubExtension {

    readonly __enabled__: boolean;

    readonly __name__: string;

    readonly __pretty_name__: string;

    readonly __priority__: number;

    activate_sub_extension (context: vscode.ExtensionContext): Promise<void>;
    deactivate_sub_extension?(): Promise<void>;

    dispose?(): Promise<void>;
}

export interface StringtableDataLoadedEvent {

    readonly changed_files: ReadonlyArray<StringtableFileData>;

}


export interface API {

    readonly sub_extensions: any[];

    get_stringtable_data (): StringTableDataStorage | undefined;

}

export interface CustomCommand extends vscode.Disposable {
    readonly name: string;



    callSync?(...args: any[]): any;

    callAsync (...args: any[]): Promise<any>;

    callAsyncFromContext?(...args: any[]): Promise<any>;

    register (context: vscode.ExtensionContext): Promise<vscode.Disposable[]>;

    dispose (): void;
}


interface FoundString {
    text: string;

    start_line: number;
    start_character: number;

    end_line: number;
    end_character: number;
}

