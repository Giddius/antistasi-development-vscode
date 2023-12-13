
// region[Imports]


import * as vscode from 'vscode';
import * as path from "path";
import * as fs from "fs";


// endregion[Imports]

export function get_file_check_function() {

    let sqf_language_exists: boolean = false;




    vscode.languages.getLanguages().then((languages) => {
        for (let lang of languages) {
            if (lang === "sqf") {
                sqf_language_exists = true;
                break;
            };
        };
    }).then(undefined, err => {
        console.error('I am error');
    });


    function check_if_sqf_file_by_language_id(editor: vscode.TextEditor): boolean {

        return (editor.document.languageId === "sqf");

    };

    function check_if_sqf_file_by_file_extension(editor: vscode.TextEditor): boolean {
        return (path.extname(editor.document.fileName) === ".sqf");
    };

    if (sqf_language_exists) {
        return check_if_sqf_file_by_language_id;
    } else {
        return check_if_sqf_file_by_file_extension;
    };

};


export async function* walk(directory_path: fs.PathLike): AsyncGenerator<string> {


    const dir = await fs.promises.opendir(directory_path);
    for await (const dirent of dir) {
        dirent.path = path.join(directory_path.toString(), dirent.name);

        if (dirent.isFile()) {

            yield dirent.path;
        } else if (dirent.isDirectory()) {

            for await (const sub_path of walk(dirent.path)) {
                yield sub_path
            };
        };



    };
};





export async function find_files_by_name(start_dir: fs.PathLike, file_name_to_search: string) {
    const found_files: string[] = [];


    for await (const file of walk(start_dir)) {
        if (file_name_to_search.toLowerCase() === path.basename(file).toLowerCase()) {
            found_files.push(file.toString());
        };

    };

    return found_files;

};

export function is_strict_relative_path(path_1: string, path_2: string): boolean {
    const rel_path = path.relative(path_1, path_2);
    return (rel_path !== undefined) && (!rel_path.startsWith('..')) && (!path.isAbsolute(rel_path));

};




export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));


