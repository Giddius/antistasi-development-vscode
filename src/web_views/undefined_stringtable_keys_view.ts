
// region[Imports]

import * as vscode from 'vscode';
import * as path from "path";
import * as fs from "fs-extra";
import * as utilities from "../utilities";

import { FoundKey } from "../sub_extensions/stringtable_data/provider";
import { text } from "node:stream/consumers";
import { TIMEOUT } from "dns";

// endregion[Imports]


// class UndefinedStringtableKeyViewProvider implements vscode.WebviewViewProvider {
//     public static readonly viewType = 'calicoColors.colorsView';

//     async resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext<unknown>, token: vscode.CancellationToken): Promise<void> {

//     }
// };

function getNonce () {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}


async function _to_undefined_key_map (in_undefinded_keys: FoundKey[]): Promise<Map<string, FoundKey[]>> {
    const _undefined_key_map: Map<string, FoundKey[]> = new Map();

    for await (const key of in_undefinded_keys) {
        if (!_undefined_key_map.has(key.text.toUpperCase())) {
            _undefined_key_map.set(key.text.toUpperCase(), []);
        };

        _undefined_key_map.get(key.text.toUpperCase())!.push(key);
    };




    return _undefined_key_map;
};


async function _get_pretty_path (in_path: string): Promise<string> {
    // let pretty_path = in_path.replace(path.resolve(utilities.get_base_workspace_folder()?.uri.fsPath || ""), "");
    // if (pretty_path.startsWith(path.sep)) {
    //     pretty_path = pretty_path.substring(1);
    // }

    let pretty_path = vscode.workspace.asRelativePath(in_path, false);

    return pretty_path;
};



async function _create_button (in_found_key: FoundKey): Promise<string> {

    let text = `<button class="open-file-button" data-path="${in_found_key.file}" data-spec='${in_found_key.json_string_data}'>Open File</button>`;

    return text;
};

async function _create_html (webview: vscode.Webview, undefined_keys: FoundKey[]): Promise<string> {

    const style_sheet_uri = webview.asWebviewUri(vscode.Uri.file(path.join(__dirname, "std_style_sheet.css")));

    const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(__dirname, "open_file_button_script.js")));


    const found_key_map = await _to_undefined_key_map(undefined_keys);

    let _body: string = "<h1>All Undefined Stringtable Keys</h1>\n";
    _body += `\n<div class="misc-buttons-box">
                    <button class="copy-all-key-names-button">copy to clipboard</button>
                    <button class="save-to-file-button">save to file</button>
                </div>\n\n`;
    for (const key_name of found_key_map.keys()) {

        _body += `<div class="keyList"><div class="keyListTitle">${key_name}</div>\n`;
        _body += `<ul>\n`;
        for (const _key of found_key_map.get(key_name)!) {
            _body += `
            <li>
                file: <code>${await _get_pretty_path(_key.file)}</code>, line number: <code>${_key.range.start.line + 1}</code>, character: <code>${_key.range.start.character + 1}</code>   ${await _create_button(_key)}
            </li>\n`;
        };

        _body += `</ul></div>`;
    };


    // <meta http - equiv="Content-Security-Policy" content = "default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${getNonce()}';" >

    let _html = `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">



				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link rel="stylesheet" type="text/css" href="${style_sheet_uri}">
				<title>Undefined Stringtable Keys</title>
			</head>
			<body>


                ${_body}

                <script>
                (function () {
    const vscode = acquireVsCodeApi();



    console.log(vscode);
    console.log("doing the button thing");

    const copy_button = document.querySelector(".copy-all-key-names-button");

    copy_button.addEventListener('click', (event)=> {vscode.postMessage({command:"copy_all_names",text:''});});


    const save_button = document.querySelector(".save-to-file-button");

    save_button.addEventListener('click', (event)=> {vscode.postMessage({command:"save_to_file",text:''});});


    const _buttons = document.querySelectorAll('.open-file-button');
    console.log("_buttons");
    console.dir(_buttons);
    for (const _button of _buttons) {
    _button.addEventListener('click', (event) => {
        console.log(event);
        console.dir(event);
        console.log(_button.dataset.spec);
        vscode.postMessage({command:"vscode.open",text:_button.dataset.spec});
    });
};
}());</script>
			</body>
			</html>`;




    return _html;
};


export async function create_undefined_stringtable_keys_result_web_view (undefined_keys: FoundKey[]) {

    const column = vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.viewColumn
        : undefined;

    const view = vscode.window.createWebviewPanel("undefinedStringtableKeys",
        "Undefined Stringtable Keys",
        column || vscode.ViewColumn.One,
        { enableScripts: true, localResourceRoots: [vscode.Uri.file(__dirname)] });

    view.webview.html = await _create_html(view.webview, undefined_keys);

    view.iconPath = { light: vscode.Uri.parse("https://github.com/Giddius/antistasi-development-vscode/blob/main/images/antistasi_development_icon.png?raw=true"), dark: vscode.Uri.parse("https://github.com/Giddius/antistasi-development-vscode/blob/main/images/antistasi_development_icon.png?raw=true") };

    view.webview.onDidReceiveMessage(async (message) => {
        // console.dir(message);

        switch (message.command) {



            case "vscode.open":

                const spec_data = JSON.parse(message.text);


                const uri = vscode.Uri.file(spec_data.file);


                vscode.window.showTextDocument(uri, { selection: new vscode.Range(spec_data.start_line, spec_data.start_char, spec_data.end_line, spec_data.end_char) });
                break;


            case "copy_all_names":

                const all_names: string[] = Array.from(new Set(undefined_keys.map((item) => { return item.text; })));
                all_names.sort((a, b) => { return a.toLowerCase().localeCompare(b.toLowerCase()); });
                const all_names_text = all_names.join("\n");
                await vscode.env.clipboard.writeText(all_names_text).then(() => {
                    vscode.window.showInformationMessage("all undefined Stringtable keys copied to clipboard!");
                });
                break;


            case "save_to_file":

                const workspace_uri = utilities.get_base_workspace_folder()?.uri;
                let default_path = workspace_uri;
                if (workspace_uri) {
                    default_path = vscode.Uri.file(path.join(workspace_uri.fsPath, "undefined_keys"));
                }
                const target = await vscode.window.showSaveDialog({
                    title: "Save List of undefined Stringtable keys",
                    defaultUri: default_path,
                    filters: {
                        "text": ["txt"], "table": ["csv"], "html": ["html"],
                    },
                    saveLabel: "create"
                });
                if (!target) { return; };
                let text: string = "";
                switch (path.extname(target.fsPath)) {

                    case ".txt":
                        text = Array.from(new Set(undefined_keys.map((item) => { return item.text; }))).sort((a, b) => { return a.toLowerCase().localeCompare(b.toLowerCase()); }).join("\n");
                        break;

                    case ".csv":
                        text = `"Key", "File", "Line", "Character"\n`;
                        for await (const undef_key of undefined_keys) {
                            text += `"${undef_key.text}", "${undef_key.file}", ${undef_key.range.start.line + 1}, ${undef_key.range.start.character + 1}\n`;
                        };
                        break;

                    case ".html":
                        text = view.webview.html.replace(/\<button.*\<\/button\>/gm, "");
                        break;
                };

                await fs.writeFile(target.fsPath, text, "utf-8");
                await vscode.window.showTextDocument(target);
                break;

        };


    });

    view.reveal(column);
};