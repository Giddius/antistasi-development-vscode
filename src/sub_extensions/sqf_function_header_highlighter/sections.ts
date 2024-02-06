
import * as vscode from 'vscode';




export class HeaderSection {
    name: string;
    text: string;
    start: number;
    end: number;
    title: string;
    title_end: number;
    title_start: number;
    content_text: string;

    constructor(name: string, match: RegExpExecArray) {
        this.name = name;
        this.text = match[0].trimEnd();
        this.start = match.index;
        this.end = this.start + (this.text.length);
        this.title = match.groups!["title"];
        this.title_end = this.start + this.title.length;
        this.title_start = this.title_end - this.title.length;
        this.content_text = match.groups!["content"];
    };

    get_trimmed_content(): string {
        let trimmed_text = this.content_text.split(/\r\n|\r|\n/).map(line => line.trim()).join("\n");

        trimmed_text = trimmed_text.replace(new RegExp("\<", "g"), "\`");
        trimmed_text = trimmed_text.replace(new RegExp("\>", "g"), "\`");


        return trimmed_text;

    };
    get_title_ranges(editor: vscode.TextEditor, start_index: number = 0): vscode.DecorationOptions[] {
        const title_ranges: vscode.DecorationOptions[] = [];

        const line = this.title.trimStart();



        const line_start_index = this.start + (this.text.indexOf(line));
        const line_end_index = line_start_index + line.length;



        const start = editor.document.positionAt(start_index + line_start_index);
        const end = editor.document.positionAt(start_index + line_end_index);

        title_ranges.push({ range: new vscode.Range(start, end), hoverMessage: this.title });

        return title_ranges;
    };



    get_content_ranges(editor: vscode.TextEditor, start_index: number = 0): vscode.DecorationOptions[] {
        const content_ranges: vscode.DecorationOptions[] = [];


        let last_line_end_index: number = 0;
        const trimmed_text: string = this.get_trimmed_content();

        for (let raw_line of (this.content_text.split(/\r\n|\r|\n/))) {

            if (raw_line.trim().length <= 0) {
                continue;
            };

            const line = raw_line.trimStart();



            const line_start_index = this.start + (this.text.indexOf(line, last_line_end_index));
            const line_end_index = line_start_index + line.length;

            last_line_end_index = (this.text.indexOf(line) + line.length)

            const start = editor.document.positionAt(start_index + line_start_index);
            const end = editor.document.positionAt(start_index + line_end_index);

            const hover_message = new vscode.MarkdownString(trimmed_text);
            hover_message.supportHtml = true;
            content_ranges.push({ range: new vscode.Range(start, end), hoverMessage: hover_message });

        };

        return content_ranges;
    };
};


export class AuthorSection extends HeaderSection {

    constructor(match: RegExpExecArray) {
        super("author", match);

    };
    get_trimmed_content(): string {
        let trimmed_text = this.content_text.split(/\r\n|\r|\n/).map(line => line.trim()).join("\n");

        let authors = trimmed_text.split(new RegExp("\r?\n|\, *", "gm")).filter((word) => (word !== undefined) && (word.length >= 2));


        trimmed_text = authors.map((author_name) => `**${author_name}**`).join(", ")
        return trimmed_text;

    };
};


export class ExampleSection extends HeaderSection {

    constructor(match: RegExpExecArray) {
        super("example", match);

    };

    get_trimmed_content(): string {
        const lines = this.content_text.split(/\r\n|\r|\n/)

        let indent_amounts = lines.map((line) => (line.length - line.trimStart().length)).filter((line_indent) => line_indent > 0)


        let min_indent = Math.min(...indent_amounts)


        let trimmed_text = lines.map((line) => (line.length >= min_indent) ? line.slice(min_indent) : line).join("\n")

        trimmed_text = "```" + trimmed_text + "```"

        return trimmed_text;

    };

};