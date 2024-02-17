
// region[Imports]

import * as vscode from 'vscode';
import * as path from "path";
import * as fs from "fs-extra";
import * as utilities from "../utilities";

import { FoundKey } from "../sub_extensions/stringtable_data/provider";
import { text } from "node:stream/consumers";
import { TIMEOUT } from "dns";
import { prototype } from "events";

// endregion[Imports]


// class UndefinedStringtableKeyViewProvider implements vscode.WebviewViewProvider {
//     public static readonly viewType = 'calicoColors.colorsView';

//     async resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext<unknown>, token: vscode.CancellationToken): Promise<void> {

//     }
// };


function _found_keys_sort_func (a: FoundKey, b: FoundKey): number {

    return a.text.toLowerCase().localeCompare(b.text.toLowerCase());
};

type format_function = () => Promise<string>;

interface OutputFormatSpec {
    descriptive_name: string;
    target_file_extension: string;
    importance: number;
    format: format_function;
};

function output_format (descriptive_name: string, target_file_extension: string, importance: number = 100) {

    return function (target: any, propertyKey: string, descriptor?: PropertyDescriptor) {



        if (!descriptor) {
            throw Error(`unable to set output-format-function, because "descriptor"=${descriptor}`);
        }

        target_file_extension = target_file_extension.trim().replace(/^\./gm, "").toLowerCase();

        target.constructor.available_output_formats.push({ descriptive_name: descriptive_name, target_file_extension: target_file_extension, importance: importance, format: descriptor.value });

    };
};

class FoundKeysWriter {

    readonly found_keys: FoundKey[];

    static available_output_formats: OutputFormatSpec[] = [];

    constructor (found_keys: FoundKey[]) {
        this.found_keys = Array.from(found_keys).sort(_found_keys_sort_func);

    };


    public get_output_formats (): Array<OutputFormatSpec> {
        const klass = Object.getPrototypeOf(this);

        return Array.from(klass.constructor.available_output_formats);
    }



    public get output_format_map (): ReadonlyMap<string, format_function> {
        const format_map = new Map<string, format_function>();
        for (const output_spec of this.get_output_formats()) {
            format_map.set(output_spec.target_file_extension, output_spec.format.bind(this));
        };

        return format_map;
    }


    public get_filters () {
        let filters: {
            [name: string]: string[];
        } = {};
        for (const output_spec of Array.from(this.get_output_formats()).sort((a, b) => { return a.importance - b.importance; })) {
            if (!(output_spec.descriptive_name in filters)) {
                filters[output_spec.descriptive_name] = [];
            }

            filters[output_spec.descriptive_name].push(output_spec.target_file_extension);
        };


        return filters;
    };

    @output_format("Markdown", "md")
    private async as_md () {
        const md_actual_space = "\n\n";
        let text = "# Undefined Stringtable Keys" + md_actual_space;

        const found_key_map = await _to_undefined_key_map(this.found_keys);

        for (const key_name of found_key_map.keys()) {

            text += `## ${key_name}${md_actual_space}`;

            for (const _key of found_key_map.get(key_name)!) {

                text += `- \`${_key.relative_path}\`\n`;
                text += `    - line number: \`${_key.range.start.line + 1}\`\n`;
                text += `    - character: \`${_key.range.start.character + 1}\`\n`;

            }
            text += md_actual_space;
        }
        return text;
    };

    @output_format("JSON", "json", 2)
    private async as_json () {
        return JSON.stringify(this.found_keys.map((item) => {
            const json_data = item.json_data;
            return {
                name: json_data.name,
                relative_path: json_data.relative_path,
                start_char: json_data.start_char + 1,
                end_char: json_data.end_char + 1,
                start_line: json_data.start_line + 1,
                end_line: json_data.end_line + 1,
            };
        }), undefined, 4);
    };
    @output_format("Text", "txt", 1)
    private async as_text () {

        return Array.from(new Set(this.found_keys.map((item) => { return item.text; }))).sort((a, b) => { return a.toLowerCase().localeCompare(b.toLowerCase()); }).join("\n");

    };
    @output_format("Table", "csv")
    private async as_csv () {
        let text = `"Key", "File", "Line", "Character"\n`;
        for await (const undef_key of this.found_keys) {
            text += `"${undef_key.text}", "${vscode.workspace.asRelativePath(undef_key.file, true)}", ${undef_key.range.start.line + 1}, ${undef_key.range.start.character + 1}\n`;
        };
        return text;
    };

    get_output_format (target_path: string): CallableFunction | undefined {
        const _extension = path.extname(target_path);

        const _normalized_extension = _extension.trim().replace(/^\./gm, "").toLowerCase();

        return this.output_format_map.get(_normalized_extension);
    };

    async write (target_path: string) {
        const output_format = this.get_output_format(target_path);
        if (!output_format) { return; }


        const text = await output_format();


        await fs.writeFile(target_path, text, "utf-8");
    };
};




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


    let pretty_path = vscode.workspace.asRelativePath(in_path, false);

    return pretty_path;
};



async function _create_button (in_found_key: FoundKey): Promise<string> {

    let text = `<button class="open-file-button" data-path="${in_found_key.file}" data-spec='${in_found_key.json_string_data}'>Open File</button>`;

    return text;
};

async function _create_html (webview: vscode.Webview, undefined_keys: FoundKey[]): Promise<string> {
    const nonce = getNonce();
    const style_sheet_uri = webview.asWebviewUri(vscode.Uri.file(path.join(__dirname, "std_style_sheet.css")));

    const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(__dirname, "open_file_button_script.js")));

    const found_key_map = await _to_undefined_key_map(undefined_keys);

    let _body: string = "<h1>All Undefined Stringtable Keys</h1>\n";
    _body += `\n<div class="misc-buttons-box">
                    <button class="copy-all-key-names-button">copy to clipboard</button>
                    <button class="save-to-file-button">save to file</button>
                </div>\n\n`;


    for (const key_name of found_key_map.keys()) {

        _body += `<div class="keyList"><details><summary class="keyListTitle" id="${key_name.toLowerCase()}">${key_name}</summary>\n`;
        _body += `<ul>\n`;
        for (const _key of found_key_map.get(key_name)!) {
            _body += `
            <li>
                file: <code class="path-code">${await _get_pretty_path(_key.file)}</code>, line number: <code>${_key.range.start.line + 1}</code>, character: <code>${_key.range.start.character + 1}</code>   ${await _create_button(_key)}
            </li>\n`;
        };

        _body += `</ul></details></div>`;
    };



    const _html = `<!DOCTYPE html>
			<html lang="en">

                <head>
                    <meta charset="UTF-8">

				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">

                    <meta name="viewport" content="width=device-width, initial-scale=1.0">

                    <link rel="stylesheet" type="text/css" href="${style_sheet_uri}">
                    <title>Undefined Stringtable Keys</title>

                </head>

                <body>

                    ${_body}

                <script nonce="${nonce}" src="${scriptUri}"></script>

                </body>

			</html>`;




    return _html;
};


export async function create_undefined_stringtable_keys_result_web_view (undefined_keys: FoundKey[]) {
    const writer = new FoundKeysWriter(undefined_keys);


    const sorted_undefined_keys = Array.from(undefined_keys).sort(_found_keys_sort_func);

    const column = vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.viewColumn
        : undefined;


    const resource_roots = [vscode.Uri.file(__dirname)];
    const view = vscode.window.createWebviewPanel("undefinedStringtableKeys",
        "Undefined Stringtable Keys",
        column || vscode.ViewColumn.One,
        { enableScripts: true, localResourceRoots: resource_roots, enableFindWidget: true, retainContextWhenHidden: true });

    view.webview.html = await _create_html(view.webview, sorted_undefined_keys);

    view.iconPath = {
        light: vscode.Uri.parse("https://github.com/Giddius/antistasi-development-vscode/blob/main/images/antistasi_development_icon.png?raw=true"),
        dark: vscode.Uri.parse("https://github.com/Giddius/antistasi-development-vscode/blob/main/images/antistasi_development_icon.png?raw=true")
    };


    const message_listener = view.webview.onDidReceiveMessage(async (message) => {

        switch (message.command) {

            case "do_log":
                console.log(`do_log: ${message.text}`);
                break;


            case "open_in_editor":

                const spec_data = JSON.parse(message.text);


                const uri = vscode.Uri.file(spec_data.file);


                vscode.window.showTextDocument(uri, { selection: new vscode.Range(spec_data.start_line, spec_data.start_char, spec_data.end_line, spec_data.end_char) });
                break;


            case "copy_all_names":

                const all_names: string[] = Array.from(new Set(sorted_undefined_keys.map((item) => { return item.text; })));
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
                    filters: writer.get_filters(),

                });
                if (!target) { return; };

                writer.write(target.fsPath).then(() => vscode.window.showTextDocument(target));



        };


    });


    view.onDidDispose((e) => { message_listener.dispose(); console.log(`webview ${view} was disposed`); });

    view.reveal(column);

};