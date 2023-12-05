
// region[Imports]

import * as vscode from 'vscode';
import * as header_gen from './header_generation';


import * as path from "path";

import * as header_parse from "./sqf_function_header_highlighter/parsing";

import * as fs from "fs";

import * as utilities from "./utilities";

import * as stringtable_parsing from "./stringtable_previewer/parsing";

// endregion[Imports]




let all_stringtable_data: Map<string, stringtable_parsing.StringtableEntry> = new Map();


class HoverProvider implements vscode.HoverProvider, vscode.DefinitionProvider {


	provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {
		if (token.isCancellationRequested) return;

		const word_range = document.getWordRangeAtPosition(position)
		let curr_word = document.getText(word_range);
		console.log(`curr_word. ${curr_word}`)
		if ((document.languageId === "ext") || (document.languageId === "cpp")) {
			console.log(`is config file, languageId: ${document.languageId}`)
			curr_word = curr_word.replace(/^\$/gm, "")
			console.log(`modified_curr_word: ${curr_word}`)
		} else {
			console.log(`is script file, languageId: ${document.languageId}`)
		};

		if (all_stringtable_data.has(curr_word)) {


			const data = all_stringtable_data.get(curr_word)!



			const markdown_text = new vscode.MarkdownString(undefined, true);

			let file: string = "";
			if (data.file) {
				file = path.relative(vscode.workspace.getWorkspaceFolder(document.uri)!.uri.fsPath, data.file)
			};
			markdown_text.appendMarkdown(`- $(file-code) ${file}\n- $(project) ${data.package_name}\n- $(database) ${data.container_name}\n`)
			markdown_text.appendMarkdown(`\n-------\n\n\n`)
			markdown_text.appendText(data.original_text)




			return new vscode.Hover(markdown_text, word_range);
		}
	};

	provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Definition | vscode.LocationLink[]> {
		if (token.isCancellationRequested) return;


		const word_range = document.getWordRangeAtPosition(position)
		let curr_word = document.getText(word_range);
		console.log(`curr_word. ${curr_word}`)

		if ((document.languageId === "ext") || (document.languageId === "cpp")) {
			console.log(`is config file, languageId: ${document.languageId}`)
			curr_word = curr_word.replace(/^\$/gm, "")
			console.log(`modified_curr_word: ${curr_word}`)

		} else {
			console.log(`is script file, languageId: ${document.languageId}`)
		};


		if (all_stringtable_data.has(curr_word)) {


			const data = all_stringtable_data.get(curr_word)!

			const _uri = vscode.Uri.file(data.file!)



			console.log(`line_num: ${data.location[0]}`)
			console.log(`char_num: ${data.location[1]}`)

			return new vscode.Location(_uri, new vscode.Range(new vscode.Position(data.location[0], data.location[1]), new vscode.Position(data.location[0], data.location[1] + data.location[2])));
		}
	};

};

export async function activate(context: vscode.ExtensionContext) {
	console.log('decorator sample is activated');
	const check_file = (_editor: vscode.TextEditor) => { return ((_editor.document.languageId === "sqf") || (path.extname(_editor.document.fileName) === ".sqf")) };
	let timeout: NodeJS.Timeout | undefined = undefined;
	let activeEditor = vscode.window.activeTextEditor;


	function updateDecorations() {
		console.log('updating decorations');
		if (!activeEditor) {
			return;
		};
		if (!check_file(activeEditor)) {
			return;
		};
		let all_stringtable_files: string[] = []
		let workspace_folder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
		if (workspace_folder) {
			utilities.find_files_by_name(workspace_folder.uri.fsPath, "Stringtable.xml").then((result) => {
				console.log(`result: ${result}`)

				for (let stringtable_file of result) {
					all_stringtable_data = new Map([...all_stringtable_data.entries(), ...stringtable_parsing.parse_xml_file(stringtable_file).entries()]);
				};
				// console.dir(all_stringtable_data);

			});


		};

		header_parse.highlight_sqf_header(activeEditor);

	};

	function triggerUpdateDecorations(throttle = false) {

		if (timeout) {
			clearTimeout(timeout);
			timeout = undefined;
		}
		if (throttle) {
			timeout = setTimeout(updateDecorations, 500);
		} else {
			updateDecorations();
		};
	};



	if (activeEditor) {
		triggerUpdateDecorations();
	}

	vscode.window.onDidChangeActiveTextEditor(editor => {
		activeEditor = editor;
		if (editor) {
			triggerUpdateDecorations();
		}
	}, null, context.subscriptions);

	vscode.workspace.onDidChangeTextDocument(event => {
		if (activeEditor && event.document === activeEditor.document) {
			triggerUpdateDecorations(true);
		}
	}, null, context.subscriptions);


	const hov = new HoverProvider()
	vscode.languages.registerHoverProvider([{ scheme: "file", language: "sqf" }, { scheme: "file", language: "cpp" }, { scheme: "file", language: "ext" }], hov)


	vscode.languages.registerDefinitionProvider([{ scheme: "file", language: "sqf" }, { scheme: "file", language: "cpp" }, { scheme: "file", language: "ext" }], hov)
}

// This method is called when your extension is deactivated
export async function deactivate() {
	console.log("deactivate 'Antistasi-Development' extension");
}
