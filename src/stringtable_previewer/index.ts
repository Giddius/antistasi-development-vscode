
// region[Imports]

import * as vscode from 'vscode';
import { parse_xml_file } from "./parsing";



import * as path from "path";


import * as fs from "fs";

import * as utilities from "../utilities";


// endregion[Imports]



class StringTableHoverProvider implements vscode.HoverProvider {
    key_map: Map<string, string> = new Map<string, string>();


    provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {

        if (token.isCancellationRequested) return;

        const word_range = document.getWordRangeAtPosition(position)
        let curr_word = document.getText(word_range);

        const data = this.key_map.get(curr_word);

        if (!data) return;


        return new vscode.Hover(data, word_range);

    }

};