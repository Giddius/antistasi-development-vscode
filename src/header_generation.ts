import * as vscode from 'vscode';

import * as fs from 'fs';

import * as path from "path";



class DocumentHeaderData {
    document: vscode.TextDocument;
    file_name: string;
    file_text: string;
    params: Array<string>;

    constructor(document: vscode.TextDocument) {
        this.document = document;
        this.file_name = path.parse(document.uri.fsPath).name;
        this.file_text = document.getText();
        this.params = this.find_params(document.getText());
    };

    toString(): string {
        return JSON.stringify(this, ["file_name", "params"], '  ');
    };

    find_params(text: string): Array<string> {

        const regex_pattern = /params *\[(.*?)\]\;/gm;
        const regex_result = regex_pattern.exec(text)

        if (regex_result === null) {
            return [];
        }

        const raw_param_text = regex_result[1].replace(/"|'/g, "")
        let param_array = raw_param_text.split(",").map(s => s.trim());

        return param_array;
    };
}


function headerTextFromData(data: DocumentHeaderData): string {
    let argument_text_parts: Array<string> = []

    for (let param_name of data.params) {
        argument_text_parts.push(`    <ANY>${param_name}: `);
    }

    let argument_text = argument_text_parts.join("\n")
    const text = `
/*
Maintainer:

    Calculates the logarithmic mean of the arguments.
    Places a marker on the map where Petros is not standing.
    Finally, concludes whether the player will win the next lottery.

Arguments:
${argument_text}

Return Value:
    <ANY>

Scope: Server/Server&HC/Clients/Any, Local Arguments/Global Arguments, Local Effect/Global Effect
Environment: Scheduled/Unscheduled/Any
Public: Yes/No
Dependencies:


Example:

*/
`


    return text
};






function create_header_text(document: vscode.TextDocument): string {

    let data: DocumentHeaderData = new DocumentHeaderData(document)



    let text = headerTextFromData(data)

    vscode.window.showInformationMessage(text);
    return text

}


export function create_sqf_header(document: vscode.TextDocument | undefined): string {

    if (!document) {
        return ""
    };

    return create_header_text(document)




}