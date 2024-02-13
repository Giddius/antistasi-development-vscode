

const vscode = acquireVsCodeApi();


function open_file_butten_eh(event) {
    vscode.postMessage({ command: "open_in_editor", text: event.target.dataset.spec });
};


function copy_all_names_eh(event) {
    vscode.postMessage({ command: "copy_all_names", text: '' });
};


function save_to_file_eh(event) {
    vscode.postMessage({ command: "save_to_file", text: '' });
};





(function () {



    const copy_button = document.querySelector(".copy-all-key-names-button");

    copy_button.addEventListener('click', copy_all_names_eh);


    const save_button = document.querySelector(".save-to-file-button");

    save_button.addEventListener('click', save_to_file_eh);


    const _buttons = document.querySelectorAll('.open-file-button');

    for (const _button of _buttons) {
        _button.addEventListener('click', open_file_butten_eh);
    };
}());