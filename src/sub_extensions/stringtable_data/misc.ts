// region[Imports]

import * as vscode from "vscode";
import * as utils from "#utilities";
import { StringTableDataStorage, StringtableFileData, StringtableEntry } from "./storage";

// endregion[Imports]

interface QuickPickDataItem extends vscode.QuickPickItem {
    item: StringtableFileData;
}

async function ask_file_input (data: StringTableDataStorage, token?: vscode.CancellationToken, in_file?: vscode.Uri, current_document?: vscode.TextDocument): Promise<StringtableFileData | undefined> {
    if (in_file) {
        return await data.get_data_item_for_file(in_file);
    }

    if (token?.isCancellationRequested) {
        return;
    }

    const selection_items: QuickPickDataItem[] = [];
    if (current_document) {
        const data_item_for_current_document = await data.get_data_item_for_file(current_document.uri);
        if (data_item_for_current_document) {
            selection_items.push({
                label: "Stringtable file for current open document",
                iconPath: new vscode.ThemeIcon("file-code"),
                kind: vscode.QuickPickItemKind.Default,
                description: vscode.workspace.asRelativePath(data_item_for_current_document.file_path),
                item: data_item_for_current_document
            });
        }
    }

    selection_items.push(
        ...data.all_stringtable_file_data_items
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((item) => {
                return {
                    label: item.name,
                    iconPath: item.icon,
                    kind: vscode.QuickPickItemKind.Default,
                    description: vscode.workspace.asRelativePath(item.file_path),
                    item: item
                };
            })
    );

    const stringtable_data_item = await vscode.window.showQuickPick(
        selection_items,
        {
            title: "Stringtable file",
            canPickMany: false,
            ignoreFocusOut: false
        },
        token
    );

    if (!stringtable_data_item || token?.isCancellationRequested) {
        return;
    }
    return stringtable_data_item?.item;
}

async function ask_container_name_input (existing_container_names: string[], token?: vscode.CancellationToken, container_name?: string): Promise<string | undefined> {
    if (container_name) {
        return container_name;
    }
    if (token?.isCancellationRequested) {
        return;
    }

    container_name = await vscode.window.showQuickPick(
        ["New container name"].concat(existing_container_names),
        {
            title: "Container Name",
            canPickMany: false,
            ignoreFocusOut: true
        },
        token
    );

    if (container_name === "New container name") {
        const existing_container_names_normalized = existing_container_names.map((v) => v.trim().toLowerCase());
        container_name = await vscode.window.showInputBox(
            {
                title: "New container name",
                ignoreFocusOut: true,
                validateInput: (value) => {
                    if (value.trim().length <= 0) {
                        return "Empty name not allowed!";
                    }

                    if (existing_container_names_normalized.includes(value.toLowerCase())) {
                        return "Container name is already defined";
                    }
                    if (value.trim().includes(" ")) {
                        return "Name cannot include whitespace";
                    }
                    if (!/^[a-z0-9_]+$/gi.test(value.trim())) {
                        return "Name characters can only be of 'ABCDEFGHIJKLMNOPQRSTUVQXYZ' and '0123456789' (including lower case versions)";
                    }
                }
            },
            token
        );
    }
    if (token?.isCancellationRequested || !container_name) {
        return;
    }

    return container_name.trim();
}

const KEY_NAME_MODIFICATION_FUNCTIONS: ((key: string) => string)[] = [
    (key) => {
        return key.trim();
    },
    (key) => {
        return key.replace(/^str_/gim, "STR_");
    }
];

async function modify_key_name (key_name: string): Promise<string> {
    let modified_key_name = String(key_name);

    for (const func of KEY_NAME_MODIFICATION_FUNCTIONS) {
        modified_key_name = func(modified_key_name);
        utils.sleep(100);
    }
    return modified_key_name;
}

async function ask_key_name_input (existing_key_names: string[], token?: vscode.CancellationToken, key_name?: string): Promise<string | undefined> {
    if (key_name) {
        return key_name;
    }
    if (token?.isCancellationRequested) {
        return;
    }

    const all_existing_key_names_normalized: ReadonlyArray<string> = existing_key_names.map((v) => v.trim().toLowerCase());
    key_name = await vscode.window.showInputBox(
        {
            title: "Key Name",
            value: "STR_",
            valueSelection: [100, 100],
            ignoreFocusOut: true,
            validateInput: (value) => {
                if (value.trim().length <= 0) {
                    return "Empty name not allowed!";
                }
                if (!value.toLowerCase().startsWith("str_")) {
                    return "Key names need to start with 'STR_'!";
                }
                if (all_existing_key_names_normalized.includes(value.trim().toLowerCase())) {
                    return "Name already in defined!";
                }
                if (value.trimEnd().endsWith("_")) {
                    return "Name cannot end with '_', because this is used for dynamic keys.";
                }
                if (value.trim().includes(" ")) {
                    return "Name cannot include whitespace";
                }
                if (!/^[a-z0-9_]+$/gi.test(value.trim())) {
                    return "Name characters can only be of 'ABCDEFGHIJKLMNOPQRSTUVQXYZ' and '0123456789' (including lower case versions)";
                }
            }
        },
        token
    );

    if (token?.isCancellationRequested || !key_name) {
        return;
    }

    return await modify_key_name(key_name);
}

async function ask_original_value_input (token?: vscode.CancellationToken, original_value?: string): Promise<string | undefined> {
    if (original_value) {
        return original_value;
    }
    if (token?.isCancellationRequested) {
        return;
    }

    original_value = await vscode.window.showInputBox(
        {
            title: "English Text",
            ignoreFocusOut: true,
            validateInput: (value) => {
                if (value.trim().length <= 0) {
                    return "Empty name not allowed!";
                }
            }
        },
        token
    );
    if (token?.isCancellationRequested) {
        return;
    }

    return original_value;
}

export async function new_stringtable_key_input (
    data: StringTableDataStorage,
    token?: vscode.CancellationToken,
    in_file?: vscode.Uri,
    container_name?: string,
    key_name?: string,
    current_document?: vscode.TextDocument,
    original_value?: string
): Promise<StringtableEntry | undefined> {
    const data_item = await ask_file_input(data, token, in_file, current_document);

    if (!data_item || token?.isCancellationRequested) {
        return;
    }

    container_name = await ask_container_name_input(data_item.all_container_names, token, container_name);

    if (!container_name || token?.isCancellationRequested) {
        return;
    }

    key_name = await ask_key_name_input(data_item.all_key_names, token, key_name);

    if (!key_name || token?.isCancellationRequested) {
        return;
    }

    original_value = await ask_original_value_input(token, original_value);

    if (!original_value || token?.isCancellationRequested) {
        return;
    }

    return await data_item.insert_new_key(container_name, key_name, original_value);
}

export interface StringtableInsertParameter {
    stringtable_file_item?: StringtableFileData;
    container_name?: string;
    key_name?: string;
    original_value?: string;
}

export class StringtableInserter {
    stringtable_data: StringTableDataStorage;
    insert_parameter: StringtableInsertParameter;

    stringtable_file_item?: StringtableFileData;
    container_name?: string;
    key_name?: string;
    original_value?: string;

    constructor (stringtable_data: StringTableDataStorage, insert_parameter?: StringtableInsertParameter) {
        this.stringtable_data = stringtable_data;
        this.insert_parameter = insert_parameter || {};
    }

    resolve_and_insert = async (token?: vscode.CancellationToken) => { };
}
