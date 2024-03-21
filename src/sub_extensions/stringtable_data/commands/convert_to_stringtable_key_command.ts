
// region[Imports]

import * as vscode from 'vscode';
import * as path from "path";

import * as utils from "#utilities";


import { StringTableDataStorage, StringtableEntry } from "../storage";



import { SubExtensionCommand, AbstractCommand } from "#bases";
import { new_stringtable_key_input } from "../misc";
// endregion[Imports]





export class ConvertToStringtableKeyCommand extends AbstractCommand {
    protected readonly data: StringTableDataStorage;

    public readonly name: string = "antistasi.convert-to-stringtable-key";
    public readonly config_key: string = "antistasiDevelopment.stringtable_data";

    constructor (data: StringTableDataStorage) {
        super();
        this.data = data;
    };


    protected async execute (...args: any[]): Promise<void | undefined> {
        const editor = vscode.window.activeTextEditor;


        if (!editor) { return; }

        let selection: vscode.Range | vscode.Selection = editor.selection;



        if (selection.isEmpty) {
            let line = editor.document.lineAt(selection.start.line);
            if (line.isEmptyOrWhitespace) { return; }
            if ((!line.text.includes('"')) && (!line.text.includes("'"))) { return; }



            let regex = /((?<quotes>["']).*?\k<quotes>)/gm;
            let m;
            let found = [];
            while ((m = regex.exec(line.text)) !== null) {

                if (m.index === regex.lastIndex) {
                    regex.lastIndex++;
                }


                found.push([m.index, regex.lastIndex]);
            };
            if (found.length <= 0) { return; }
            for (const indexes of found) {
                if ((indexes[0] <= selection.start.character) && (indexes[1] >= selection.end.character)) {
                    selection = new vscode.Selection(selection.start.line, indexes[0], selection.end.line, indexes[1]);
                    break;
                }
            }

            if (selection.start.character < 0) { return; }





        };

        const raw_text = editor.document.getText(selection);


        if ((!raw_text.startsWith('"'))
            && (!raw_text.endsWith('"'))
            && (!raw_text.startsWith("'"))
            && (!raw_text.endsWith("'"))) { return; }

        const text = utils.resolve_sqf_string(raw_text);

        const result = await new_stringtable_key_input(this.data, undefined, editor.document.uri, undefined, undefined, editor.document, text);

        const key_name = result?.key_name;

        if (!key_name) { return; }

        editor.edit((editBuilder) => {
            switch (path.extname(editor.document.uri.fsPath).toLowerCase()) {
                case ".sqf":
                    editBuilder.replace(selection, `(localize "${key_name}")`);
                    break;

                default:
                    editBuilder.replace(selection, `$${key_name}`);
                    break;


            };


        }).then(() => { editor.document.save(); });
    }
};