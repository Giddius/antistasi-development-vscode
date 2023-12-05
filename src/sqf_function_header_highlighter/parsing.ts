import * as vscode from 'vscode';

import * as fs from 'fs';

import * as path from "path";

import * as section_classes from "./sections";

const rough_header_regex_pattern = /\/\*(.*?)\*\//gmsu;


const section_regex_map: ReadonlyMap<string, RegExp> = new Map([
    ["author",
        new RegExp(/(?<=^( |\t)*)(?<title>((Author(s)?)|(Maintainer(s)?)):) *(?<content>.*?)(?=(?:^[ \w]+:)|(?:^ *\*\/))/, "gimsu")],
    ["description",
        new RegExp(/^ *(?<title>Description:) *(?<content>.*?)(?=(?:^[ \w]+:)|(?:^ *\*\/))/, "gimsu")],
    ["arguments",
        new RegExp(/^ *(?<title>((Argument(s)?)|(Parameter(s)?)):) *(?<content>.*?)(?=(?:^[ \w]+:)|(?:^ *\*\/))/, "gimsu")],
    ["scope",
        new RegExp(/^ *(?<title>Scope:) *(?<content>.*?)(?=(?:^[ \w]+:)|(?:^ *\*\/))/, "gimsu")],
    ["environment",
        new RegExp(/^ *(?<title>Environment:) *(?<content>.*?)(?=(?:^[ \w]+:)|(?:^ *\*\/))/, "gimsu")],
    ["public",
        new RegExp(/^ *(?<title>Public:) *(?<content>.*?)(?=(?:^[ \w]+:)|(?:^ *\*\/))/, "gimsu")],
    ["example",
        new RegExp(/^ *(?<title>Example(s)?:) *(?<content>.*?)(?=(?:^[ \w]+:)|(?:^ *\*\/))/, "gimsu")],
    ["license",
        new RegExp(/^ *(?<title>License:) *(?<content>.*?)(?=(?:^[ \w]+:)|(?:^ *\*\/))/, "gimsu")],
    ["return_value",
        new RegExp(/^( |\t)*(?<title>((Return Value(s?))|(Returns)):) *(?<content>.*?)(?=(?:^[ \w]+:)|(?:^ *\*\/))/, "gimsu")],
    ["dependencies",
        new RegExp(/^ *(?<title>Dependencies:) *(?<content>.*?)(?=(?:^[ \w]+:)|(?:^\*\/))/, "gimsu")]
]);



function _create_title_decorators(): any {
    let data = [];

    const names: string[] = Array.from(section_regex_map.keys());

    for (let name of names) {
        const _title_name = name + "_title";
        const _sub_data = [_title_name, vscode.window.createTextEditorDecorationType({
            backgroundColor: "#7f7f7f20",
            cursor: "help",
            overviewRulerColor: "green",
            color: "black",
            isWholeLine: false,
            light: {
                color: "black",
                backgroundColor: "#00000020"
            },
            dark: {
                color: "white",
                backgroundColor: "#ffffff20"
            }
        })];

        data.push(_sub_data);
    };

    return data;
};

const title_decoration_type_map: ReadonlyMap<string, vscode.TextEditorDecorationType> = new Map(_create_title_decorators());



const _default_decorater_type = vscode.window.createTextEditorDecorationType({});

const decoration_type_map: ReadonlyMap<string, vscode.TextEditorDecorationType> = new Map([
    ["overall",
        vscode.window.createTextEditorDecorationType({
            backgroundColor: "#ffffff10",
            cursor: "help",

            color: "white",
            isWholeLine: true,

        })],
    ["author",
        vscode.window.createTextEditorDecorationType({
            backgroundColor: "#00ff0060",
            color: "#ff00ffe6",
            isWholeLine: false,
            light: {
                color: "black",
            },
            dark: {
                color: "white",
            }
        })],
    ["description",
        vscode.window.createTextEditorDecorationType({
            backgroundColor: "#ce7d7d60",
            color: "#ff00ffe6",
            isWholeLine: false,
            light: {
                color: "black",
            },
            dark: {
                color: "white",
            }
        })],
    ["arguments",
        vscode.window.createTextEditorDecorationType({
            backgroundColor: "#ff0096d9",
            fontWeight: "900",
            color: "#ff00ffe6",
            isWholeLine: false,
            light: {
                color: "black",
            },
            dark: {
                color: "white",
            }
        })],
    ["scope",
        vscode.window.createTextEditorDecorationType({
            backgroundColor: "#64000060",
            color: "#ff00ffe6",
            isWholeLine: false,
            light: {
                color: "black",
            },
            dark: {
                color: "white",
            }
        })],
    ["environment",
        vscode.window.createTextEditorDecorationType({
            backgroundColor: "#64640060",
            color: "#ff00ffe6",
            isWholeLine: false,
            light: {
                color: "black",
            },
            dark: {
                color: "white",
            }
        })],
    ["public",
        vscode.window.createTextEditorDecorationType({
            backgroundColor: "#6464c860",
            color: "#ff00ffe6",
            isWholeLine: false,
            light: {
                color: "black",
            },
            dark: {
                color: "white",
            }
        })],
    ["example",
        vscode.window.createTextEditorDecorationType({
            backgroundColor: "#c864c860",
            color: "#ff00ffe6",
            isWholeLine: false,
            light: {
                color: "black",
            },
            dark: {
                color: "white",
            }
        })],
    ["license",
        vscode.window.createTextEditorDecorationType({
            backgroundColor: "#9632ff60",
            color: "#ff00ffe6",
            isWholeLine: false,
            light: {
                color: "black",
            },
            dark: {
                color: "white",
            }
        })],
    ["return_value",
        vscode.window.createTextEditorDecorationType({
            backgroundColor: "#ff329660",
            color: "#ff00ffe6",
            isWholeLine: false,
            light: {
                color: "black",
            },
            dark: {
                color: "white",
            }
        })],
    ["dependencies",
        vscode.window.createTextEditorDecorationType({
            backgroundColor: "#af7d4b60",
            color: "#ff00ffe6",
            isWholeLine: false,
            light: {
                color: "black",
            },
            dark: {
                color: "white",
            }
        })]
]);




class HeaderMatch {
    text: string;
    start: number;
    end: number;
    sections: Map<string, section_classes.HeaderSection> = new Map<string, section_classes.HeaderSection>();

    constructor(match: RegExpExecArray) {
        this.text = match[0];
        this.start = match.index;
        this.end = this.start + this.text.length;



    };

    parse_sections(): void {
        for (let entry of section_regex_map.entries()) {
            let section_match = new RegExp(entry[1]).exec(this.text);
            if (!section_match) {
                continue;
            };

            if (entry[0] === "example") {
                let header_section = new section_classes.ExampleSection(section_match);
                this.sections.set(header_section.name, header_section);

            } else if (entry[0] === "author") {
                let header_section = new section_classes.AuthorSection(section_match)
                this.sections.set(header_section.name, header_section);

            } else {
                let header_section = new section_classes.HeaderSection(entry[0], section_match);
                this.sections.set(header_section.name, header_section);

            }
        };

    };
    toString(): string {
        return JSON.stringify(Object.fromEntries(this.sections));
    };
}

function find_possible_header(text: string): HeaderMatch | undefined {
    const regex_result = new RegExp(rough_header_regex_pattern).exec(text);

    if (!regex_result) {

        return;
    };


    let header = new HeaderMatch(regex_result);


    header.parse_sections();

    if (header.sections.size <= 0) {
        vscode.window.showInformationMessage("section size (" + header.sections.size.toString() + ") is 0");

        return;
    };

    return header



};

function create_decoration_type(name: string): vscode.TextEditorDecorationType {

    let _decorator = decoration_type_map.get(name);


    if (!_decorator) {
        if (name.endsWith("_title")) {
            _decorator = title_decoration_type_map.get(name)!;
        } else {
            _decorator = _default_decorater_type;
        };
    };



    return _decorator
};


function apply_decorators(editor: vscode.TextEditor, header_data: HeaderMatch): void {

    const header_decorations: vscode.DecorationOptions[] = [];

    let overall_type = create_decoration_type("overall");

    const overall_start_pos = editor.document.positionAt(header_data.start);
    const overall_end_pos = editor.document.positionAt(header_data.end);

    let hover_message: string | vscode.MarkdownString = path.basename(editor.document.fileName, path.extname(editor.document.fileName))
    let workspace_folder = vscode.workspace.getWorkspaceFolder(editor.document.uri)


    if (workspace_folder) {
        hover_message = new vscode.MarkdownString("$(file-code) **__" + path.relative(workspace_folder.uri.fsPath, editor.document.fileName) + "__**", true)
    }
    const overall_decoration: vscode.DecorationOptions = { range: new vscode.Range(overall_start_pos, overall_end_pos), hoverMessage: hover_message };

    header_decorations.push(overall_decoration);

    editor.setDecorations(overall_type, header_decorations);

    for (let section_data of header_data.sections.values()) {

        editor.setDecorations(create_decoration_type(section_data.name + "_title"), section_data.get_title_ranges(editor, header_data.start));

        const decoration_type = create_decoration_type(section_data.name);
        const decorations: vscode.DecorationOptions[] = section_data.get_content_ranges(editor, header_data.start);


        editor.setDecorations(decoration_type, decorations);
    };

};



export function highlight_sqf_header(editor: vscode.TextEditor): any {
    const document = editor.document;
    if (!document) {

        return;

    };
    let header = find_possible_header(document.getText());

    if (!header) {

        return;
    };

    apply_decorators(editor, header);





}



