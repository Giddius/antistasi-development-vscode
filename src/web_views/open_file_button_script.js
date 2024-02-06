

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
    const vscode = acquireVsCodeApi();

    // const oldState = vscode.getState() || { colors: [] };


    const _button = document.querySelector('.open-file-button');
    _button.addEventListener('click', () => {
        vscode.postMessage({command:"vscode.open",text:_button.dataset.path});
    });
}());