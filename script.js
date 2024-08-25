function removeComments() {
    const code = document.getElementById('inputCode').value;
    const uncommentedCode = code
        .replace(/\/\*[\s\S]*?\*\
        .replace(/\/\/.*/g, ''); 

    document.getElementById('outputCode').value = uncommentedCode.trim();
}

function resetForm() {
    document.getElementById('inputCode').value = '';
    document.getElementById('outputCode').value = '';
}

function copyToClipboard() {
    const outputCode = document.getElementById('outputCode');
    outputCode.select();
    outputCode.setSelectionRange(0, 99999); 
    document.execCommand('copy');
    alert('Code copied to clipboard!');
}
