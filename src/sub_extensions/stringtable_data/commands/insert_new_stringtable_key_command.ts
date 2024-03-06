
// region[Imports]

import * as vscode from 'vscode';

import { StringTableDataStorage, StringtableEntry } from "../storage";

import { SubExtensionCommand, AbstractCommand } from "#bases";
import { new_stringtable_key_input } from "../misc";
import * as utils from "#utilities";

// endregion[Imports]


export interface InputNewStringtableKeyArguments {
    in_file?: vscode.Uri;
    container_name?: string;
    key_name?: string;
    original_value?: string;
};



function is_InputNewStringtableKeyArguments (item: any): boolean {
    const property_names: string[] = [
        "in_file",
        "container_name",
        "key_name",
        "original_value"
    ];

    for (const property_name of property_names) {
        if (property_name in item) { return true; }
    };

    return false;
};


export class InsertNewStringtableKeyCommand extends AbstractCommand {
    protected readonly data: StringTableDataStorage;

    public readonly name: string = "antistasi.insert-stringtable-key";
    public readonly config_key: string = "antistasiDevelopment.stringtable_data";

    constructor (data: StringTableDataStorage) {
        super();
        this.data = data;
    };

    protected get_argument_object_from_args (...args: any[]): InputNewStringtableKeyArguments | undefined {
        for (const arg of args) {
            if (is_InputNewStringtableKeyArguments(arg)) { return arg; }
        };
    };
    protected async execute (...args: any[]): Promise<StringtableEntry | undefined> {

        if (this.enabled === false) {
            await this.show_command_disabled_message();
            return;
        }

        const current_document = vscode.window.activeTextEditor?.document;

        const token: vscode.CancellationToken = new vscode.CancellationTokenSource().token;


        const argument_obj = this.get_argument_object_from_args(...args);
        let inserted_data: StringtableEntry | undefined;

        if (argument_obj) {
            inserted_data = await new_stringtable_key_input(this.data, token, argument_obj.in_file, argument_obj.container_name, argument_obj.key_name, current_document, argument_obj.original_value);

        } else {
            inserted_data = await new_stringtable_key_input(this.data, token, undefined, undefined, undefined, current_document, undefined);
        };
        return inserted_data;
    };






};
