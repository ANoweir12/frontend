// Function to handle the file upload
function uploadTrees() {
    const fileInput1 = document.getElementById('fileInput1');
    const fileInput2 = document.getElementById('fileInput2');
    const files1 = fileInput1.files;
    const files2 = fileInput2.files;

    if (files1.length !== 1 || files2.length !== 1) {
        alert('Please select exactly 2 XML files');
        return;
    }

    const reader1 = new FileReader();
    const reader2 = new FileReader();

    reader1.onload = function(event) {
        const content1 = event.target.result;
        reader2.readAsText(files2[0]);
        reader2.onload = function(event) {
            const content2 = event.target.result;

            // Combine the contents with '&'
            const combinedContent = content1.trim() + '&' + content2.trim();

            // Send the combined content to the backend server
            sendTreesToServer(combinedContent);
        }
    }

    reader1.readAsText(files1[0]);
}

// Function to send the process trees to the backend server
function sendTreesToServer(content) {
    const url = new URL("http://localhost:3000")
    fetch(url + 'diff', {
        headers: {
            'Content-Type': 'text/xml'
        },
        method: 'POST',
        body: content
    })
        .then(response => response.text())
        .then(diffFile => {
            // Display the diff file
            displayDiffFile(diffFile);
        })
        .catch(error => {
            console.error('Error:', error);
            // Handle error if necessary
        });
}

// Function to display the diff file on the webpage
function displayDiffFile(diffFile) {
    const diffOutput = document.getElementById('diffOutput');
    diffOutput.textContent = diffFile;
}

function displayOldTree() {
    const fileInput = document.getElementById('fileInput1');
    const file = fileInput.files[0];

    if (!file) {
        alert('Please select an old XML file');
        console.error('No file selected.');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        const content = event.target.result;
        displayTree(content, '#oldTree', '#graphcanvas1')
        // const oldTreeOutput = document.getElementById('oldTree');
        // oldTreeOutput.textContent = content;
    }
    reader.onerror = function(event) {
        console.error('Error reading the file:', event.target.error);
    };

    reader.readAsText(file);
}

function displayNewTree() {
    const fileInput = document.getElementById('fileInput2');
    const file = fileInput.files[0];

    if (!file) {
        alert('Please select a new XML file');
        console.error('No file selected.');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        const content = event.target.result;
        displayTree(content, '#newTree', '#graphcanvas2')
        // const oldTreeOutput = document.getElementById('oldTree');
        // oldTreeOutput.textContent = content;
    }
    reader.onerror = function(event) {
        console.error('Error reading the file:', event.target.error);
    };

    reader.readAsText(file);
}

function displayTree(treeXML, divId, svgId) {
    var parser, xmlDoc;
    parser = new DOMParser();
    xmlDoc = parser.parseFromString(treeXML,"text/xml");
    let graphrealization = new WfAdaptor('http://127.0.0.1:8062/cockpit/themes/extended/theme.js',function(graphrealization){
        graphrealization.set_svg_container($(svgId));
        graphrealization.set_label_container($(divId));
        graphrealization.set_description($(xmlDoc), true);
    });
}
// https://cpee.org/flow/themes/extended/theme.js
